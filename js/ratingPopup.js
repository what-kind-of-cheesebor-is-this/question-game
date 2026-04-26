/**
 * RatingPopup UI component (no data writes).
 *
 * Responsible ONLY for:
 * - Rendering rating modal UI (1–5)
 * - Enforcing visibility rules
 * - Managing 30s countdown
 * - Emitting rating events to parent via callbacks
 *
 * All Firestore / data writes MUST be done by the caller via onRate/onTimeout callbacks.
 */

const TASK_RATING_DURATION_SECONDS = 30;

export class RatingPopup {
  /**
   * @param {HTMLElement} modalEl - Root modal element (#taskRatingModal)
   * @param {Object} options
   * @param {HTMLElement} [options.timerValueEl] - Element to display remaining seconds
   * @param {NodeListOf<HTMLButtonElement>} [options.ratingButtons]
   */
  constructor(modalEl, { timerValueEl, ratingButtons } = {}) {
    this.modalEl = modalEl;
    this.timerValueEl = timerValueEl || modalEl?.querySelector("#taskRatingTimerValue") || null;
    this.ratingButtons =
      ratingButtons ||
      (modalEl ? modalEl.querySelectorAll(".task-rating-btn") : /** @type {NodeListOf<HTMLButtonElement>} */ ([]));

    /** @type {null | {
     *   roomId: string,
     *   roundId: string,
     *   assignmentId: string,
     *   completedByUserId: string,
     *   currentUserId: string,
     *   confirmationResolvedAt: any,
     *   onRate?: (score: number) => void,
     *   onTimeout?: () => void
     * }} */
    this.props = null;
    this.rated = false;
    this.countdownInterval = null;
    this.deadlineMs = 0;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleRatingClick = this.handleRatingClick.bind(this);

    this.attachEventListeners();
  }

  attachEventListeners() {
    if (this.ratingButtons && this.ratingButtons.forEach) {
      this.ratingButtons.forEach((btn) => {
        btn.addEventListener("click", this.handleRatingClick);
      });
    }
    document.addEventListener("keydown", this.handleKeyDown, true);
  }

  detachEventListeners() {
    if (this.ratingButtons && this.ratingButtons.forEach) {
      this.ratingButtons.forEach((btn) => {
        btn.removeEventListener("click", this.handleRatingClick);
      });
    }
    document.removeEventListener("keydown", this.handleKeyDown, true);
  }

  handleKeyDown(event) {
    if (!this.isVisible()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  handleRatingClick(event) {
    const target = event.currentTarget;
    if (!target || !target.dataset) return;
    const raw = target.dataset.score;
    const score = raw != null ? parseFloat(raw) : NaN;
    if (!Number.isFinite(score)) return;
    this.emitRating(score);
  }

  emitRating(score) {
    if (!this.props || this.rated) {
      return;
    }
    this.rated = true;
    this.setButtonsDisabled(true);

    if (typeof this.props.onRate === "function") {
      try {
        this.props.onRate(score);
      } catch (err) {
        console.error("[RatingPopup] onRate handler threw an error:", err);
      }
    }
  }

  toMillis(value) {
    if (!value) return Date.now();
    if (typeof value === "number") {
      return value > 1e12 ? value : value * 1000;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    return Date.now();
  }

  /**
   * @param {object} props
   * @param {string} props.roomId
   * @param {string} props.roundId
   * @param {string} props.assignmentId
   * @param {string} props.completedByUserId
   * @param {string} props.currentUserId
   * @param {any} props.confirmationResolvedAt
   * @param {string} [props.taskText]
   * @param {string} [props.completerName]
   * @param {(score: number) => void} [props.onRate]
   * @param {() => void} [props.onTimeout]
   */
  show(props) {
    const {
      roomId,
      roundId,
      assignmentId,
      completedByUserId,
      currentUserId,
      confirmationResolvedAt,
      taskText = "",
      completerName = ""
    } = props || {};

    if (!roomId || !roundId || !assignmentId || !currentUserId) {
      console.warn("[RatingPopup] Missing required props; popup will not be shown.", props);
      return;
    }
    if (completedByUserId && currentUserId === completedByUserId) {
      return;
    }

    this.props = { ...props };
    this.rated = false;

    const startedMs = this.toMillis(confirmationResolvedAt);
    this.deadlineMs = startedMs + TASK_RATING_DURATION_SECONDS * 1000;

    this.setButtonsDisabled(false);

    if (this.modalEl) {
      const titleEl = this.modalEl.querySelector(".task-rating-title");
      const questionEl = this.modalEl.querySelector(".task-rating-question");
      const completerEl = this.modalEl.querySelector("#taskRatingCompleterName");
      const taskTextEl = this.modalEl.querySelector("#taskRatingTaskText");
      if (titleEl) titleEl.textContent = "Rate the task";
      if (questionEl) questionEl.textContent = "How well was the task performed?";
      if (completerEl) {
        const name = completerName && completerName.trim() ? completerName.trim() : "Someone";
        completerEl.textContent = `Completed by: ${name}`;
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
    this.props = null;
    this.rated = false;
  }

  isVisible() {
    return !!this.modalEl && !this.modalEl.classList.contains("hidden");
  }

  setButtonsDisabled(disabled) {
    if (this.ratingButtons && this.ratingButtons.forEach) {
      this.ratingButtons.forEach((btn) => {
        btn.disabled = disabled;
      });
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
        if (!this.rated && typeof this.props?.onTimeout === "function") {
          try {
            this.props.onTimeout();
          } catch (err) {
            console.error("[RatingPopup] onTimeout handler threw:", err);
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

