/**
 * ConfirmationPopup UI component (no data writes).
 *
 * Responsible ONLY for:
 * - Rendering modal UI
 * - Enforcing visibility rules
 * - Managing 60s countdown
 * - Emitting vote events to parent via callback
 *
 * All Firestore / data writes MUST be done by the caller via onVote callback.
 */

const TASK_CONFIRMATION_DURATION_SECONDS = 60;

export class ConfirmationPopup {
  /**
   * @param {HTMLElement} modalEl - Root modal element (#taskConfirmationModal)
   * @param {Object} options
   * @param {HTMLElement} [options.timerValueEl] - Element to display remaining seconds
   * @param {HTMLButtonElement} [options.confirmBtn]
   * @param {HTMLButtonElement} [options.abstainBtn]
   * @param {HTMLButtonElement} [options.rulesBtn]
   * @param {HTMLElement} [options.rulesPanel]
   */
  constructor(modalEl, { timerValueEl, confirmBtn, abstainBtn, rejectBtn, rulesBtn, rulesPanel } = {}) {
    this.modalEl = modalEl;
    this.timerValueEl = timerValueEl || modalEl?.querySelector("#taskConfirmationTimerValue") || null;
    this.confirmBtn = confirmBtn || modalEl?.querySelector("#taskVoteConfirmBtn") || null;
    this.abstainBtn = abstainBtn || modalEl?.querySelector("#taskVoteAbstainBtn") || null;
    this.rejectBtn = rejectBtn || modalEl?.querySelector("#taskVoteRejectBtn") || null;
    this.rulesBtn = rulesBtn || modalEl?.querySelector("#taskConfirmationRulesBtn") || null;
    this.rulesPanel = rulesPanel || modalEl?.querySelector("#taskConfirmationRulesPanel") || null;
    this.rulesOpen = false;

    /** @type {null | {
     *   taskId: string,
     *   roundId: string,
     *   provocateurId: string,
     *   targetId: string,
     *   currentUserId: string,
     *   confirmationStartedAt: Date | number | import('firebase/firestore').Timestamp,
     *   onVote?: (vote: "confirm" | "abstain" | "reject", context: object) => void
     * }} */
    this.props = null;
    this.voted = false;
    this.countdownInterval = null;
    this.deadlineMs = 0;

    this.handleConfirmClick = this.handleConfirmClick.bind(this);
    this.handleAbstainClick = this.handleAbstainClick.bind(this);
    this.handleRejectClick = this.handleRejectClick.bind(this);
    this.handleRulesClick = this.handleRulesClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.attachEventListeners();
  }

  attachEventListeners() {
    if (this.confirmBtn) {
      this.confirmBtn.addEventListener("click", this.handleConfirmClick);
    }
    if (this.abstainBtn) {
      this.abstainBtn.addEventListener("click", this.handleAbstainClick);
    }
    if (this.rejectBtn) {
      this.rejectBtn.addEventListener("click", this.handleRejectClick);
    }
    if (this.rulesBtn) {
      this.rulesBtn.addEventListener("click", this.handleRulesClick);
    }

    // Block Esc while modal is active (not dismissible без голосования/таймера)
    document.addEventListener("keydown", this.handleKeyDown, true);
  }

  detachEventListeners() {
    if (this.confirmBtn) {
      this.confirmBtn.removeEventListener("click", this.handleConfirmClick);
    }
    if (this.abstainBtn) {
      this.abstainBtn.removeEventListener("click", this.handleAbstainClick);
    }
    if (this.rejectBtn) {
      this.rejectBtn.removeEventListener("click", this.handleRejectClick);
    }
    if (this.rulesBtn) {
      this.rulesBtn.removeEventListener("click", this.handleRulesClick);
    }
    document.removeEventListener("keydown", this.handleKeyDown, true);
  }

  handleKeyDown(event) {
    if (!this.isVisible()) return;
    if (event.key === "Escape") {
      // Блокируем закрытие по Esc
      event.preventDefault();
      event.stopPropagation();
    }
  }

  handleConfirmClick() {
    this.emitVote("confirm");
  }

  handleAbstainClick() {
    this.emitVote("abstain");
  }

  handleRejectClick() {
    this.emitVote("reject");
  }

  handleRulesClick() {
    this.rulesOpen = !this.rulesOpen;
    if (this.rulesPanel) {
      this.rulesPanel.classList.toggle("hidden", !this.rulesOpen);
      this.rulesPanel.setAttribute("aria-hidden", this.rulesOpen ? "false" : "true");
    }
    if (this.rulesBtn) {
      this.rulesBtn.setAttribute("aria-expanded", this.rulesOpen ? "true" : "false");
      // Mobile Safari can leave :focus styling stuck on the last-tapped control; blur resets paint.
      requestAnimationFrame(() => {
        if (this.rulesBtn) this.rulesBtn.blur();
      });
    }
  }

  emitVote(vote) {
    if (!this.props || this.voted) {
      return;
    }

    this.voted = true;
    this.setButtonsDisabled(true);

    if (typeof this.props.onVote === "function") {
      try {
        this.props.onVote(vote, {
          taskId: this.props.taskId,
          roundId: this.props.roundId,
          provocateurId: this.props.provocateurId,
          targetId: this.props.targetId,
          currentUserId: this.props.currentUserId
        });
      } catch (err) {
        console.error("[ConfirmationPopup] onVote handler threw an error:", err);
      }
    }
  }

  /**
   * Convert any timestamp-like value to ms number.
   * Supports JS Date, Firestore Timestamp, or ms/seconds numbers.
   */
  toMillis(value) {
    if (!value) return Date.now();
    if (typeof value === "number") {
      // Heuristic: treat > 10^12 as ms, otherwise as seconds
      return value > 1e12 ? value : value * 1000;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }
    if (typeof value.seconds === "number") {
      return value.seconds * 1000;
    }
    return Date.now();
  }

  /**
   * Show popup with given props.
   * NO writes here, only UI + таймер.
   *
   * @param {object} props
   * @param {string} props.taskId
   * @param {string} props.roundId
   * @param {string} props.provocateurId
   * @param {string} props.targetId
   * @param {string} props.currentUserId
   * @param {any} props.confirmationStartedAt
   * @param {(vote: "confirm" | "abstain" | "reject", ctx: object) => void} [props.onVote]
   * @param {() => void} [props.onTimeout] - called when countdown reaches 0 (e.g. to auto-abstain)
   * @param {string} [props.status] - текущий статус задания
   * @param {string} [props.taskText] - actual task text from Firestore (not UI label)
   * @param {string} [props.provocateurName] - name of player who claimed completion
   * @param {string} [props.assignmentId] - assignment document id
   */
  show(props) {
    const {
      taskId,
      roundId,
      provocateurId,
      targetId,
      completedByUserId,
      currentUserId,
      confirmationStartedAt,
      status,
      taskText = "",
      provocateurName = "",
      assignmentId
    } = props || {};

    // Visibility rule: show only to non-completers (completedByUserId is who clicked "Yes").
    if (!taskId || !roundId || !currentUserId) {
      console.warn("[ConfirmationPopup] Missing required props; popup will not be shown.", props);
      return;
    }
    if (status && status !== "awaiting_confirmation") {
      return;
    }
    const completerId = completedByUserId ?? provocateurId;
    if (completerId && currentUserId === completerId) {
      return;
    }

    this.props = { ...props };
    this.voted = false;
    this.resetRulesPanel();

    // STEP 7 — Timer from server timestamp; onTimeout triggers auto-abstain (handled by parent).
    const startedMs = this.toMillis(confirmationStartedAt);
    this.deadlineMs = startedMs + TASK_CONFIRMATION_DURATION_SECONDS * 1000;

    this.setButtonsDisabled(false);

    // UI: title, question with provocateur name, actual task text, timer
    if (this.modalEl) {
      const titleEl = this.modalEl.querySelector(".task-confirmation-title");
      const questionEl = this.modalEl.querySelector(".task-confirmation-question");
      const taskTextEl = this.modalEl.querySelector(".task-confirmation-task-text");
      if (titleEl) titleEl.textContent = "Task Confirmation";
      if (questionEl) {
        const name = provocateurName && provocateurName.trim() ? provocateurName.trim() : "Someone";
        questionEl.textContent = `Did ${name} complete the task?`;
      }
      if (taskTextEl) {
        taskTextEl.textContent = taskText && taskText.trim() ? taskText.trim() : "";
        taskTextEl.style.display = taskText && taskText.trim() ? "block" : "none";
      }
      this.modalEl.classList.remove("hidden");
    }

    this.updateTimer();
    this.startCountdown();
  }

  hide() {
    this.stopCountdown();
    if (this.modalEl) {
      this.modalEl.classList.add("hidden");
    }
    this.setButtonsDisabled(false);
    this.resetRulesPanel();
    this.props = null;
    this.voted = false;
  }

  isVisible() {
    return !!this.modalEl && !this.modalEl.classList.contains("hidden");
  }

  setButtonsDisabled(disabled) {
    if (this.confirmBtn) this.confirmBtn.disabled = disabled;
    if (this.abstainBtn) this.abstainBtn.disabled = disabled;
    if (this.rejectBtn) this.rejectBtn.disabled = disabled;
    // Rules is not a vote control — never tie it to vote disabled state.
  }

  resetRulesPanel() {
    this.rulesOpen = false;
    if (this.rulesPanel) {
      this.rulesPanel.classList.add("hidden");
      this.rulesPanel.setAttribute("aria-hidden", "true");
    }
    if (this.rulesBtn) {
      this.rulesBtn.setAttribute("aria-expanded", "false");
      this.rulesBtn.disabled = false;
    }
  }

  updateTimer() {
    if (!this.timerValueEl) return;
    const remainingMs = Math.max(0, this.deadlineMs - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    this.timerValueEl.textContent = String(remainingSeconds);
    return remainingSeconds;
  }

  startCountdown() {
    this.stopCountdown();
    this.countdownInterval = setInterval(() => {
      const remainingSeconds = this.updateTimer();
      if (remainingSeconds <= 0) {
        this.stopCountdown();
        if (!this.voted && typeof this.props?.onTimeout === "function") {
          try {
            this.props.onTimeout();
          } catch (err) {
            console.error("[ConfirmationPopup] onTimeout handler threw:", err);
          }
        }
        this.setButtonsDisabled(true);
      }
    }, 1000);
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}

