const createGameBtn = document.getElementById("createGameBtn");
if (createGameBtn) {
  createGameBtn.addEventListener("click", () => {
    window.location.href = "creater_screen.html";
  });
}

const joinGameBtn = document.getElementById("joinGameBtn");
if (joinGameBtn) {
    joinGameBtn.addEventListener("click", () => {
    window.location.href = "connection_screen.html";
  });
  console.log("Join game button clicked");
}

// Handle room creation (creater_screen.html)
const toLobbyBtn = document.getElementById("toLobbyBtn");
if (toLobbyBtn) {
  toLobbyBtn.addEventListener("click", async () => {
    // Import functions dynamically to avoid circular dependencies
    const { createRoom, joinRoom } = await import("./rooms.js");
    
    // Get user name from input
    const userNameInput = document.getElementById("userNameInput");
    const userName = userNameInput ? userNameInput.value.trim() : "";
    
    if (!userName) {
      alert("Пожалуйста, введите ваше имя");
      return;
    }
    
    try {
      // Create room in Firestore
      const roomData = await createRoom();
      
      // Add creator as host user in the room
      const hostUserId = await joinRoom(roomData.roomId, userName, "host");
      
      // Log creation details
      console.log("Room created:", {
        roomId: roomData.roomId,
        roomCode: roomData.code,
        hostUserId: hostUserId,
        hostName: userName
      });
      
      // Store room data for use in lobby
      sessionStorage.setItem("roomId", roomData.roomId);
      sessionStorage.setItem("roomCode", roomData.code);
      sessionStorage.setItem("userId", hostUserId);
      
      console.log("Room created, redirecting to lobby");
      window.location.href = "lobby.html";
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Ошибка при создании комнаты. Попробуйте еще раз.");
    }
  });
  console.log("Create room button handler initialized");
}

// Handle room connection (connection_screen.html)
const connectRoomForm = document.getElementById("connectRoomForm");
const connectRoomBtn = document.getElementById("connectRoomBtn");

if (connectRoomForm && connectRoomBtn) {
  // Prevent default form submission
  connectRoomForm.addEventListener("submit", (e) => {
    e.preventDefault();
  });
  
  // Handle button click
  connectRoomBtn.addEventListener("click", async () => {
    // Import functions dynamically to avoid circular dependencies
    const { findRoomByCode, joinRoom } = await import("./rooms.js");
    
    // Get user inputs
    const userNameInput = document.getElementById("connectUserNameInput");
    const roomCodeInput = document.getElementById("roomCodeInput");
    
    const userName = userNameInput ? userNameInput.value.trim() : "";
    const roomCode = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : "";
    
    if (!userName || !roomCode) {
      console.log("Missing user name or room code");
      return;
    }
    
    try {
      // Find room by code
      const roomId = await findRoomByCode(roomCode);
      
      if (!roomId) {
        console.log("Room not found with code:", roomCode);
        return;
      }
      
      // Join the room as a player
      const userId = await joinRoom(roomId, userName, "player");
      
      // Log connection details
      console.log("User connected to room:", {
        roomId: roomId,
        roomCode: roomCode,
        userId: userId,
        userName: userName
      });
      
      // Store room data for use in lobby
      sessionStorage.setItem("roomId", roomId);
      sessionStorage.setItem("roomCode", roomCode);
      sessionStorage.setItem("userId", userId);
      
      // Redirect to lobby after successful join
      console.log("Redirecting to lobby");
      window.location.href = "lobby.html";
    } catch (error) {
      console.error("Error connecting to room:", error);
    }
  });
  console.log("Connect room button handler initialized");
}



const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

const readinessBtn = document.getElementById("readinessBtn");
if (readinessBtn) {
  readinessBtn.addEventListener("click", async () => {
    const roomId = sessionStorage.getItem("roomId");
    const userId = sessionStorage.getItem("userId");
    
    if (!roomId || !userId) {
      console.log("Missing roomId or userId");
      return;
    }
    
    // Toggle ready state
    const currentReady = readinessBtn.classList.contains("is-ready");
    const newReady = !currentReady;
    
    try {
      // Import update function
      const { updateUserReady } = await import("./rooms.js");
      
      // Update Firestore
      await updateUserReady(roomId, userId, newReady);
      
      // Update UI immediately (will also be updated via real-time subscription)
      if (newReady) {
        readinessBtn.classList.add("is-ready");
        readinessBtn.textContent = "Готов";
      } else {
        readinessBtn.classList.remove("is-ready");
        readinessBtn.textContent = "Не готов";
      }
    } catch (error) {
      console.error("Error updating ready state:", error);
    }
  });
}

// Display room code in lobby if available
const roomCodeElement = document.getElementById("roomCode");
if (roomCodeElement) {
  const roomCode = sessionStorage.getItem("roomCode");
  if (roomCode) {
    roomCodeElement.textContent = roomCode;
  }
}

// Initialize real-time users list in lobby
const usersListElement = document.getElementById("usersList");
const startGameBtn = document.getElementById("startGameBtn");
if (usersListElement) {
  // Get roomId from sessionStorage (set when creating or joining a room)
  const roomId = sessionStorage.getItem("roomId");
  
  if (roomId) {
    // Import subscription functions
    import("./subscriptions.js").then(({ subscribeToRoomUsers, subscribeToRoom }) => {
      // Subscribe to users collection updates
      subscribeToRoomUsers(roomId, (users) => {
        // Clear existing list
        usersListElement.innerHTML = "";
        
        // Render each user
        users.forEach((user) => {
          const listItem = document.createElement("li");
          listItem.className = "player-item";
          
          // Add ready state class if user is ready
          if (user.ready === true) {
            listItem.classList.add("user-ready");
          }
          
          listItem.textContent = user.name;
          usersListElement.appendChild(listItem);
        });
        
        // Update ready button state based on current user
        const currentUserId = sessionStorage.getItem("userId");
        let isHost = false;
        let allReady = false;

        if (currentUserId) {
          const currentUser = users.find(u => u.id === currentUserId);

          if (currentUser) {
            // Determine if current user is host
            isHost = currentUser.role === "host";

            // Sync readiness button with current user state
            if (readinessBtn) {
              if (currentUser.ready) {
                readinessBtn.classList.add("is-ready");
                readinessBtn.textContent = "Готов";
              } else {
                readinessBtn.classList.remove("is-ready");
                readinessBtn.textContent = "Не готов";
              }
            }
          }
        }

        // Determine if all users are ready (and there is at least one user)
        if (users.length > 0) {
          allReady = users.every(u => u.ready === true);
        }

        // Show Start Game button only for host when all users are ready
        if (startGameBtn) {
          if (isHost && allReady) {
            startGameBtn.classList.remove("hidden");
          } else {
            startGameBtn.classList.add("hidden");
          }
        }
      });

      // Subscribe to room document to react to status changes (for all clients)
      subscribeToRoom(roomId, (roomData) => {
        if (!roomData) return;

        // Keep roundId in session for game/voting flow.
        if (roomData.roundId) {
          sessionStorage.setItem("roundId", roomData.roundId);
        }

        // If room is already active, or just became active, navigate to game
        if (roomData.status === "active") {
          // Prevent duplicate redirects
          if (!window.__roomNavigated) {
            window.__roomNavigated = true;
            window.location.href = "game.html";
          }
        }
      });
    });
  } else {
    console.log("No roomId found in sessionStorage");
  }
}

// Handle Start Game button click (host only, when visible)
if (startGameBtn) {
  startGameBtn.addEventListener("click", async () => {
    const roomId = sessionStorage.getItem("roomId");

    if (!roomId) {
      console.log("Missing roomId for Start Game");
      return;
    }

    try {
      // Import required modules
      const { updateRoomStatus } = await import("./rooms.js");
      const { assignTasksToRoom } = await import("./taskAssignment.js");
      const roundId = sessionStorage.getItem("roundId") || `round-${Date.now()}`;
      sessionStorage.setItem("roundId", roundId);
      
      // Assign tasks to all users in the room (runs once, checks for existing assignments).
      // IMPORTANT: pass roundId so authoritative assignments are created for ALL tasks.
      await assignTasksToRoom(roomId, roundId);

      // Round doc + roundStartedAt MUST exist before room becomes "active", otherwise clients
      // can open game.html while round doc still lacks roundStartedAt (first-task duration becomes 0).
      const { db } = await import("./firebase.js");
      const { doc, setDoc, serverTimestamp, collection, getDocs } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
      );
      const roundRef = doc(db, "rooms", roomId, "rounds", roundId);
      const usersRef = collection(db, "rooms", roomId, "users");
      const usersSnap = await getDocs(usersRef);
      const expectedAssignmentsCount = usersSnap.size * 3;

      await setDoc(
        roundRef,
        { gamePhase: "active", roundStartedAt: serverTimestamp(), expectedAssignmentsCount },
        { merge: true }
      );

      // Update room status + active roundId (triggers navigation for all clients).
      await updateRoomStatus(roomId, "active", roundId);
    } catch (error) {
      console.error("Error starting game:", error);
    }
  });
}

// Game screen: Load and render player tasks
const tasksContainer = document.getElementById("tasksContainer");
const confirmationArea = document.getElementById("confirmationArea");
const confirmationMessage = document.querySelector(".confirmation-message");
const taskConfirmationModal = document.getElementById("taskConfirmationModal");
const taskConfirmationTimerValue = document.getElementById("taskConfirmationTimerValue");
const taskVoteConfirmBtn = document.getElementById("taskVoteConfirmBtn");
const taskVoteAbstainBtn = document.getElementById("taskVoteAbstainBtn");
const taskVoteRejectBtn = document.getElementById("taskVoteRejectBtn");

const taskRatingModal = document.getElementById("taskRatingModal");
const taskRatingTimerValue = document.getElementById("taskRatingTimerValue");
const gameContent = document.getElementById("gameContent");
const finalLeaderboardContainer = document.getElementById("finalLeaderboardContainer");
const hostFinishRoundBtn = document.getElementById("hostFinishRoundBtn");

const TASK_CONFIRMATION_DURATION_SECONDS = 60;
const TASK_RATING_DURATION_SECONDS = 30;
let isTaskCompletionWriteInProgress = false;
let gameUserTasksUnsubscribe = null;
let gameRoomUsersUnsubscribe = null;
let gameAssignmentsUnsubscribe = null;
let activeTaskConfirmationVote = null;
let activeConfirmationAssignmentId = null;
let activeRatingAssignmentId = null;
let taskConfirmationCountdownInterval = null;
let isSubmittingTaskVote = false;
let latestUsersSnapshotVersion = 0;
let confirmationPopupInstance = null;
let ratingPopupInstance = null;
// Local UI-only lock: after player clicks "Да", immediately disable+color the task
// until Firestore resolution updates status.
let locallyCompletedTaskId = null;
let roundPhaseUnsubscribe = null;
let isFinalLeaderboardRendered = false;
let suppressConfirmationPopupsUntilMs = 0;
let latestRoundData = null;
let hostFinishRoundButtonBound = false;
/** Serialize assignments onSnapshot handling so overlapping async work cannot open the same modal twice. */
let assignmentsListenerChain = Promise.resolve();

/** Throttled console preview of running totals (same rules as final leaderboard). */
let roundScoresPreviewTimer = null;
function scheduleRoundScoresPreviewLog(roomId, roundId) {
  if (!roomId || !roundId) return;
  clearTimeout(roundScoresPreviewTimer);
  roundScoresPreviewTimer = setTimeout(async () => {
    if (isFinalLeaderboardRendered || latestRoundData?.gamePhase === "finished") return;
    try {
      const { db } = await import("./firebase.js");
      const { fetchRoundScoreSummary } = await import("./finalLeaderboardScreen.js");
      const { ranked } = await fetchRoundScoreSummary({ roomId, roundId, db });
      const parts = ranked.map(
        (r) => `${r.name}: ${Math.round((r.totalScore || 0) * 100) / 100}`
      );
      console.log("%c[ROUND_SCORES]", "color:#34d399;font-weight:bold", parts.join(" | "));
    } catch (e) {
      console.warn("[ROUND_SCORES] preview failed", e);
    }
  }, 700);
}

function normalizeTasksArray(rawTasks, sourceTag) {
  if (Array.isArray(rawTasks)) {
    return rawTasks;
  }

  if (rawTasks && typeof rawTasks === "object") {
    const normalizedTasks = Object.values(rawTasks).filter((task) => task && typeof task === "object");
    console.warn(`[TASK_NORMALIZE] Non-array tasks in ${sourceTag}. Normalized to array with ${normalizedTasks.length} items.`);
    return normalizedTasks;
  }

  if (rawTasks !== undefined && rawTasks !== null) {
    console.warn(`[TASK_NORMALIZE] Unexpected tasks type in ${sourceTag}:`, typeof rawTasks);
  }

  return [];
}

function getTimestampMillis(timestampValue) {
  if (!timestampValue) {
    return null;
  }

  if (typeof timestampValue.toMillis === "function") {
    return timestampValue.toMillis();
  }

  if (typeof timestampValue.seconds === "number") {
    return timestampValue.seconds * 1000;
  }

  return null;
}

function getTaskVoteStateKey(voteState) {
  return `${voteState.roundId}|${voteState.taskId}|${voteState.provocateurId}`;
}

function setTaskVoteButtonsDisabled(disabled) {
  if (taskVoteConfirmBtn) taskVoteConfirmBtn.disabled = disabled;
  if (taskVoteAbstainBtn) taskVoteAbstainBtn.disabled = disabled;
  if (taskVoteRejectBtn) taskVoteRejectBtn.disabled = disabled;
}

function setTaskConfirmationModalVisible(visible) {
  if (!taskConfirmationModal) {
    return;
  }

  if (visible) {
    taskConfirmationModal.classList.remove("hidden");
  } else {
    taskConfirmationModal.classList.add("hidden");
  }
}

function stopTaskConfirmationCountdown() {
  if (taskConfirmationCountdownInterval) {
    clearInterval(taskConfirmationCountdownInterval);
    taskConfirmationCountdownInterval = null;
  }
}

function closeTaskConfirmationModal() {
  stopTaskConfirmationCountdown();
  setTaskConfirmationModalVisible(false);
  setTaskVoteButtonsDisabled(false);
  activeTaskConfirmationVote = null;
  isSubmittingTaskVote = false;
}

function updateTaskConfirmationTimer(deadlineMs) {
  if (!taskConfirmationTimerValue) {
    return 0;
  }

  const remainingMs = Math.max(0, deadlineMs - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  taskConfirmationTimerValue.textContent = String(remainingSeconds);
  return remainingSeconds;
}

async function resolveRoundId(roomId) {
  const roundIdFromSession = sessionStorage.getItem("roundId");
  if (roundIdFromSession) {
    return roundIdFromSession;
  }

  try {
    const { db } = await import("./firebase.js");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      return null;
    }

    const roomData = roomSnap.data();
    const detectedRoundId = roomData.roundId || null;
    if (detectedRoundId) {
      sessionStorage.setItem("roundId", detectedRoundId);
    }
    return detectedRoundId;
  } catch (error) {
    console.error("[ROUND_ID] Failed to resolve roundId:", error);
    return null;
  }
}

/** Resolves assignmentId by taskId + provocateurId (or completedByUserId). Returns null if not found. */
async function resolveAssignmentId(roomId, roundId, taskId, provocateurId) {
  const { db } = await import("./firebase.js");
  const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const assignmentsRef = collection(db, "rooms", roomId, "rounds", roundId, "assignments");
  const q = query(assignmentsRef, where("taskId", "==", taskId), where("provocateurId", "==", provocateurId));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;
  const q2 = query(assignmentsRef, where("taskId", "==", taskId), where("completedByUserId", "==", provocateurId));
  const snap2 = await getDocs(q2);
  return snap2.empty ? null : snap2.docs[0].id;
}

async function hasVoteAlreadyBeenSubmitted(roomId, roundId, assignmentId, voterId) {
  if (!assignmentId) return false;
  const { db } = await import("./firebase.js");
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const voteRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "votes", voterId);
  const voteSnap = await getDoc(voteRef);
  return voteSnap.exists();
}

/** Writes one vote under rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}/votes/{voterId}. One vote per voterId. */
async function writeVoteExactlyOnce(roomId, roundId, assignmentId, voterId, vote) {
  if (!assignmentId) {
    console.warn("[TASK_VOTE] writeVoteExactlyOnce skipped: no assignmentId");
    return false;
  }
  const { db } = await import("./firebase.js");
  const { doc, runTransaction, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const voteRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "votes", voterId);

  return runTransaction(db, async (transaction) => {
    const voteSnap = await transaction.get(voteRef);
    if (voteSnap.exists()) {
      return false;
    }

    transaction.set(voteRef, {
      vote,
      votedAt: serverTimestamp()
    });

    return true;
  });
}

async function hasRatingAlreadyBeenSubmitted(roomId, roundId, assignmentId, raterId) {
  if (!assignmentId) return false;
  const { db } = await import("./firebase.js");
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const ratingRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "ratings", raterId);
  const ratingSnap = await getDoc(ratingRef);
  return ratingSnap.exists();
}

/** Writes one rating under rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}/ratings/{raterId}. */
async function writeRatingExactlyOnce(roomId, roundId, assignmentId, raterId, score) {
  if (!assignmentId) {
    console.warn("[TASK_RATING] writeRatingExactlyOnce skipped: no assignmentId");
    return false;
  }
  const { db } = await import("./firebase.js");
  const { doc, runTransaction, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const ratingRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "ratings", raterId);

  return runTransaction(db, async (transaction) => {
    const ratingSnap = await transaction.get(ratingRef);
    if (ratingSnap.exists()) {
      return false;
    }

    transaction.set(ratingRef, {
      rating: score,
      // Backward compatibility (older code expected "score")
      score,
      ratedAt: serverTimestamp()
    });

    return true;
  });
}

/** Resolves rating phase: computes avg from ratings, writes finalScore and ratingResult to assignment. Runs once. */
async function resolveRatingPhaseOnce(roomId, roundId, assignmentId, assignmentData) {
  if (!assignmentId) return { resolved: false, reason: "no_assignment_id" };
  if (assignmentData.ratingResult != null) return { resolved: false, reason: "already_resolved" };
  if (assignmentData.confirmationResult !== "accepted") return { resolved: false, reason: "not_accepted" };

  const resolvedMs = getTimestampMillis(assignmentData.confirmationResolvedAt);
  const deadlineMs = resolvedMs + TASK_RATING_DURATION_SECONDS * 1000;
  if (Date.now() < deadlineMs) return { resolved: false, reason: "deadline_not_met" };

  const { db } = await import("./firebase.js");
  const { doc, collection, getDocs, runTransaction, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const assignmentRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId);
  const ratingsRef = collection(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "ratings");

  const ratingsSnap = await getDocs(ratingsRef);
  let sum = 0;
  let count = 0;
  ratingsSnap.forEach((d) => {
    const payload = d.data() || {};
    const s = payload.rating ?? payload.score;
    if (typeof s === "number" && !Number.isNaN(s)) {
      sum += s;
      count += 1;
    }
  });
  const finalScore = count > 0 ? Math.round(sum / count * 100) / 100 : 0;

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(assignmentRef);
    if (!snap.exists()) return { resolved: false, reason: "assignment_missing" };
    if (snap.data().ratingResult != null) return { resolved: false, reason: "already_resolved" };

    transaction.update(assignmentRef, {
      finalScore,
      ratingResult: "completed",
      ratingResolvedAt: serverTimestamp()
    });

    return { resolved: true, finalScore };
  });
}

async function markRoundFinishedOnce(roundRef) {
  const { runTransaction, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  // NOTE: runTransaction is a function, but we need db instance from "./firebase.js".
  const { db } = await import("./firebase.js");
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(roundRef);
    const data = snap.exists() ? snap.data() : {};
    if (data.gamePhase === "finished") return { updated: false };
    transaction.set(roundRef, { gamePhase: "finished", finishedAt: serverTimestamp() }, { merge: true });
    return { updated: true };
  });
}

function resolveConfirmationResult(voteCounts) {
  const confirmCount = voteCounts.confirm || 0;
  const rejectCount = voteCounts.reject || 0;

  if (confirmCount > rejectCount) return "accepted";
  if (rejectCount > confirmCount) return "rejected";
  return "discarded";
}

async function resolveTaskConfirmationOnce(voteState, triggerSource) {
  const { roomId, roundId, taskId, provocateurId, eligibleVoterIds, deadlineMs } = voteState;
  let assignmentId = voteState.assignmentId;
  const { db } = await import("./firebase.js");
  const { doc, runTransaction, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  if (!assignmentId) {
    assignmentId = await resolveAssignmentId(roomId, roundId, taskId, provocateurId);
    if (!assignmentId) {
      return { resolved: false, reason: "assignment_not_found" };
    }
  }

  const assignmentRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId);
  const roundTaskRef = doc(db, "rooms", roomId, "rounds", roundId, "tasks", taskId);
  const provocateurRef = doc(db, "rooms", roomId, "users", provocateurId);
  const voterIds = eligibleVoterIds && eligibleVoterIds.length > 0 ? eligibleVoterIds : [];

  return runTransaction(db, async (transaction) => {
    const assignmentSnap = await transaction.get(assignmentRef);
    if (!assignmentSnap.exists()) {
      return { resolved: false, reason: "assignment_missing" };
    }
    const assignment = assignmentSnap.data();
    if (assignment.confirmationResult != null) {
      return { resolved: false, reason: "already_resolved", result: assignment.confirmationResult };
    }

    // IMPORTANT: Firestore transactions require all reads before any writes.
    // Pre-read any documents we might update later.
    const roundTaskSnap = await transaction.get(roundTaskRef);
    const provocateurSnap = await transaction.get(provocateurRef);

    let confirmCount = 0;
    let abstainCount = 0;
    let rejectCount = 0;
    if (voterIds.length > 0) {
      for (const vid of voterIds) {
        const voteRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "votes", vid);
        const voteSnap = await transaction.get(voteRef);
        if (voteSnap.exists()) {
          const v = voteSnap.data().vote;
          if (v === "confirm") confirmCount += 1;
          else if (v === "abstain") abstainCount += 1;
          else if (v === "reject") rejectCount += 1;
        }
      }
    }
    const voteCounts = { confirm: confirmCount, abstain: abstainCount, reject: rejectCount };
    const totalVotes = confirmCount + abstainCount + rejectCount;
    const eligibleVotersCount = eligibleVoterIds?.length ?? assignment.eligibleVotersCount ?? 0;
    const resolvedDeadlineMs = assignment.confirmationDeadlineMs ?? deadlineMs ?? Date.now() + TASK_CONFIRMATION_DURATION_SECONDS * 1000;
    const isTimerEnded = Date.now() >= resolvedDeadlineMs;
    const allVotesStored = eligibleVotersCount > 0 && totalVotes >= eligibleVotersCount;

    if (!isTimerEnded && !allVotesStored) {
      return { resolved: false, reason: "not_ready", voteCounts, totalVotes, eligibleVotersCount };
    }

    const result = resolveConfirmationResult(voteCounts);
    const status = result === "accepted" ? "completed" : result === "rejected" ? "failed" : "discarded";
    const finalScore = result === "accepted" ? null : 0;

    const assignmentUpdate = {
      confirmationResult: result,
      confirmationResolvedAt: serverTimestamp(),
      status,
      confirmCount,
      rejectCount,
      abstainCount
    };
    if (finalScore === 0) assignmentUpdate.finalScore = 0;
    transaction.update(assignmentRef, assignmentUpdate);

    if (roundTaskSnap.exists()) {
      transaction.update(roundTaskRef, {
        confirmationResult: result,
        confirmationResolvedAt: serverTimestamp(),
        status,
        confirmCount,
        rejectCount,
        abstainCount,
        resolutionTrigger: triggerSource
      });
    }

    if (provocateurSnap.exists()) {
      const provocateurData = provocateurSnap.data();
      const tasks = Array.isArray(provocateurData.tasks) ? provocateurData.tasks : [];
      const taskIndex = tasks.findIndex((t) => t && t.taskId === taskId);
      if (taskIndex >= 0) {
        transaction.update(provocateurRef, {
          [`tasks.${taskIndex}.confirmationResult`]: result,
          [`tasks.${taskIndex}.confirmationResolvedAt`]: serverTimestamp(),
          [`tasks.${taskIndex}.status`]: status
        });
      }
    }

    return { resolved: true, result, status, voteCounts: { confirmCount, abstainCount, rejectCount }, totalVotes, eligibleVotersCount };
  });
}

async function writeAutoAbstainForMissingVoters(voteState) {
  const { roomId, roundId, assignmentId, eligibleVoterIds } = voteState;
  if (!assignmentId) {
    console.warn("[TASK_VOTE] writeAutoAbstainForMissingVoters skipped: no assignmentId");
    return;
  }
  const { db } = await import("./firebase.js");
  const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  const votesRef = collection(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "votes");
  const votesSnap = await getDocs(votesRef);

  const votedIds = new Set(votesSnap.docs.map((docSnap) => docSnap.id));
  const missingVoterIds = (eligibleVoterIds || []).filter((voterId) => !votedIds.has(voterId));

  if (missingVoterIds.length === 0) return;

  await Promise.all(missingVoterIds.map(async (voterId) => {
    const didWrite = await writeVoteExactlyOnce(roomId, roundId, assignmentId, voterId, "abstain");
    if (didWrite) {
      console.log(`[TASK_VOTE] Auto-abstain saved. assignmentId="${assignmentId}", voterId="${voterId}"`);
    }
  }));
}

async function handleTaskConfirmationTimeout() {
  if (!activeTaskConfirmationVote || activeTaskConfirmationVote.timeoutHandled) {
    return;
  }

  activeTaskConfirmationVote.timeoutHandled = true;

  try {
    await writeAutoAbstainForMissingVoters(activeTaskConfirmationVote);
    const resolution = await resolveTaskConfirmationOnce(activeTaskConfirmationVote, "timer_elapsed");
    if (resolution.resolved) {
      console.log("[TASK_RESOLUTION] Confirmation resolved after timeout:", resolution);
    }
  } catch (error) {
    console.error("[TASK_VOTE] Failed to auto-abstain missing voters:", error);
  } finally {
    closeTaskConfirmationModal();
  }
}

function openTaskConfirmationModal(voteState) {
  if (!taskConfirmationModal) {
    return;
  }

  activeTaskConfirmationVote = {
    ...voteState,
    timeoutHandled: false
  };

  setTaskVoteButtonsDisabled(false);
  setTaskConfirmationModalVisible(true);

  updateTaskConfirmationTimer(voteState.deadlineMs);
  stopTaskConfirmationCountdown();
  taskConfirmationCountdownInterval = setInterval(() => {
    if (!activeTaskConfirmationVote) {
      return;
    }

    const remainingSeconds = updateTaskConfirmationTimer(activeTaskConfirmationVote.deadlineMs);
    if (remainingSeconds <= 0) {
      void handleTaskConfirmationTimeout();
    }
  }, 1000);
}

async function submitCurrentUserTaskVote(vote) {
  if (!activeTaskConfirmationVote || isSubmittingTaskVote) {
    return;
  }

  const voterId = sessionStorage.getItem("userId");
  if (!voterId) {
    console.error("[TASK_VOTE] Missing voterId");
    return;
  }

  if (!activeTaskConfirmationVote.eligibleVoterIds.includes(voterId)) {
    console.log(`[TASK_VOTE] User "${voterId}" is not eligible for taskId="${activeTaskConfirmationVote.taskId}"`);
    return;
  }

  isSubmittingTaskVote = true;
  setTaskVoteButtonsDisabled(true);

  try {
    let assignmentId = activeTaskConfirmationVote.assignmentId;
    if (!assignmentId) {
      assignmentId = await resolveAssignmentId(
        activeTaskConfirmationVote.roomId,
        activeTaskConfirmationVote.roundId,
        activeTaskConfirmationVote.taskId,
        activeTaskConfirmationVote.provocateurId
      );
      if (assignmentId) activeTaskConfirmationVote.assignmentId = assignmentId;
    }
    const didWrite = assignmentId
      ? await writeVoteExactlyOnce(
          activeTaskConfirmationVote.roomId,
          activeTaskConfirmationVote.roundId,
          assignmentId,
          voterId,
          vote
        )
      : false;

    if (didWrite) {
      console.log(`[TASK_VOTE] Vote saved. assignmentId="${assignmentId}", voterId="${voterId}", vote="${vote}"`);
    } else {
      console.log(`[TASK_VOTE] Duplicate or missing assignment. assignmentId="${assignmentId}", voterId="${voterId}"`);
    }

    const resolution = await resolveTaskConfirmationOnce(activeTaskConfirmationVote, "vote_submitted");
    if (resolution.resolved) {
      console.log("[TASK_RESOLUTION] Confirmation resolved after vote:", resolution);
    }

    closeTaskConfirmationModal();
  } catch (error) {
    console.error("[TASK_VOTE] Failed to submit vote:", error);
    isSubmittingTaskVote = false;
    setTaskVoteButtonsDisabled(false);
  }
}

function buildAwaitingConfirmationVoteState(users, roomId, currentUserId, roundId) {
  const votersUniverse = users.map((user) => user.id);
  const candidates = [];

  users.forEach((provocateurUser) => {
    const provocateurTasks = Array.isArray(provocateurUser.tasks) ? provocateurUser.tasks : [];
    provocateurTasks.forEach((task) => {
      if (!task || typeof task !== "object") {
        return;
      }

      if (task.status !== "awaiting_confirmation" || !task.completedAt || !task.taskId || !task.targetUserId) {
        return;
      }

      const confirmationStartMs =
        getTimestampMillis(task.confirmationStartedAt) ||
        getTimestampMillis(task.completedAt) ||
        Date.now();

      const eligibleVoterIds = votersUniverse.filter((voterId) =>
        voterId !== provocateurUser.id && voterId !== task.targetUserId
      );

      if (!eligibleVoterIds.includes(currentUserId)) {
        return;
      }

      candidates.push({
        roomId,
        roundId,
        taskId: task.taskId,
        provocateurId: provocateurUser.id,
        targetId: task.targetUserId,
        eligibleVoterIds,
        deadlineMs: confirmationStartMs + TASK_CONFIRMATION_DURATION_SECONDS * 1000
      });
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.deadlineMs - left.deadlineMs);
  return candidates[0];
}

function buildAnyAwaitingConfirmationState(users, roomId, roundId) {
  const votersUniverse = users.map((user) => user.id);
  const candidates = [];

  users.forEach((provocateurUser) => {
    const provocateurTasks = Array.isArray(provocateurUser.tasks) ? provocateurUser.tasks : [];
    provocateurTasks.forEach((task) => {
      if (!task || typeof task !== "object") {
        return;
      }

      if (task.status !== "awaiting_confirmation" || !task.completedAt || !task.taskId || !task.targetUserId) {
        return;
      }

      const confirmationStartMs =
        getTimestampMillis(task.confirmationStartedAt) ||
        getTimestampMillis(task.completedAt) ||
        Date.now();

      const eligibleVoterIds = votersUniverse.filter((voterId) =>
        voterId !== provocateurUser.id && voterId !== task.targetUserId
      );

      candidates.push({
        roomId,
        roundId,
        taskId: task.taskId,
        provocateurId: provocateurUser.id,
        targetId: task.targetUserId,
        eligibleVoterIds,
        deadlineMs: confirmationStartMs + TASK_CONFIRMATION_DURATION_SECONDS * 1000
      });
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.deadlineMs - left.deadlineMs);
  return candidates[0];
}

if (taskVoteConfirmBtn) {
  taskVoteConfirmBtn.addEventListener("click", () => {
    void submitCurrentUserTaskVote("confirm");
  });
}

if (taskVoteAbstainBtn) {
  taskVoteAbstainBtn.addEventListener("click", () => {
    void submitCurrentUserTaskVote("abstain");
  });
}

if (taskVoteRejectBtn) {
  taskVoteRejectBtn.addEventListener("click", () => {
    void submitCurrentUserTaskVote("reject");
  });
}

document.addEventListener("keydown", (event) => {
  if (activeTaskConfirmationVote && event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
  }
});

function showAwaitingConfirmationUI(taskId) {
  if (!confirmationArea || !confirmationMessage) {
    return;
  }

  confirmationArea.setAttribute("data-selected-task-id", taskId);
  confirmationArea.classList.remove("hidden");
  confirmationArea.setAttribute("data-phase", "awaiting_confirmation");
  confirmationMessage.textContent = "Задание отправлено на подтверждение.";

  const yesBtn = document.getElementById("confirmYes");
  const noBtn = document.getElementById("confirmNo");
  if (yesBtn) yesBtn.disabled = true;
  if (noBtn) noBtn.disabled = true;
}

function resetConfirmationUIState({ restoreTaskInteractivity = true } = {}) {
  const yesBtn = document.getElementById("confirmYes");
  const noBtn = document.getElementById("confirmNo");
  if (yesBtn) yesBtn.disabled = false;
  if (noBtn) noBtn.disabled = false;

  if (confirmationArea) {
    // Optionally restore interactivity for the previously selected task.
    if (restoreTaskInteractivity) {
      const selectedTaskId = confirmationArea.getAttribute("data-selected-task-id");
      if (selectedTaskId && tasksContainer) {
        const taskBtn = tasksContainer.querySelector(`.task-button[data-task-id="${selectedTaskId}"]`);
        if (taskBtn) {
          // If we already locally locked this task after "Да", keep it disabled.
          if (locallyCompletedTaskId && selectedTaskId === locallyCompletedTaskId) {
            return;
          }
          // Don't re-enable once the task has already been resolved (completed/failed/discarded).
          const isFinal =
            taskBtn.classList.contains("task-button--completed") ||
            taskBtn.classList.contains("task-button--failed") ||
            taskBtn.classList.contains("task-button--discarded");
          if (!isFinal) {
            taskBtn.classList.remove("task-button--pending");
            taskBtn.disabled = false;
          }
        }
      }
    }

    confirmationArea.classList.add("hidden");
    confirmationArea.removeAttribute("data-selected-task-id");
    confirmationArea.removeAttribute("data-phase");
  }
}

if (tasksContainer) {
  const roomId = sessionStorage.getItem("roomId");
  const userId = sessionStorage.getItem("userId");
  
  if (roomId && userId) {
    // Load user tasks from Firestore
    (async () => {
      try {
        const { db } = await import("./firebase.js");
        const { doc, getDoc, getDocs, collection, onSnapshot, updateDoc, serverTimestamp } = await import(
          "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
        );

        // If round is already finished (e.g. page refresh), render final leaderboard and skip tasks UI.
        const gameRoundId = await resolveRoundId(roomId);
        if (gameRoundId) {
          const roundRefNow = doc(db, "rooms", roomId, "rounds", gameRoundId);
          const roundSnapNow = await getDoc(roundRefNow);
          latestRoundData = roundSnapNow.exists() ? roundSnapNow.data() : null;
          if (latestRoundData?.gamePhase === "finished") {
            isFinalLeaderboardRendered = true;
            gameContent?.classList.add("hidden");
            finalLeaderboardContainer?.classList.remove("hidden");
            hostFinishRoundBtn?.classList.add("hidden");
            if (hostFinishRoundBtn) hostFinishRoundBtn.disabled = true;
            const { renderFinalLeaderboard } = await import("./finalLeaderboardScreen.js");
            await renderFinalLeaderboard(finalLeaderboardContainer, { roomId, roundId: gameRoundId, db });
            return;
          }
        }
        
        // Load user document with tasks
        const userRef = doc(db, "rooms", roomId, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isHostUser = userData?.role === "host";
          if (hostFinishRoundBtn) {
            hostFinishRoundBtn.classList.toggle("hidden", !isHostUser);
            if (isHostUser && !hostFinishRoundButtonBound) {
              hostFinishRoundButtonBound = true;
              hostFinishRoundBtn.addEventListener("click", async () => {
                const shouldFinish = window.confirm("Точно ли вы хотите завершить игру?");
                if (!shouldFinish) return;
                try {
                  hostFinishRoundBtn.disabled = true;
                  const roundIdToFinish = await resolveRoundId(roomId);
                  if (!roundIdToFinish) {
                    console.warn("[ROUND_FINISH] No roundId found");
                    return;
                  }
                  const { db } = await import("./firebase.js");
                  const { doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                  const roundRef = doc(db, "rooms", roomId, "rounds", roundIdToFinish);
                  const result = await markRoundFinishedOnce(roundRef);
                  console.log("[ROUND_FINISH] Host requested finish:", result);
                } catch (e) {
                  console.error("[ROUND_FINISH] Failed to finish round:", e);
                } finally {
                  hostFinishRoundBtn.disabled = false;
                }
              });
            }
          }
          const tasks = normalizeTasksArray(userData.tasks, "initial_user_load");
          
          if (tasks.length === 0) {
            console.log("No tasks assigned yet");
            tasksContainer.innerHTML = "<p>Задания еще не назначены</p>";
            return;
          }
          
          // Clear container
          tasksContainer.innerHTML = "";
          
          // Validate tasks array completeness
          if (tasks.length !== 3) {
            console.error(`Expected 3 tasks, but found ${tasks.length} tasks`);
            tasksContainer.innerHTML = `<p>Ошибка: найдено ${tasks.length} заданий вместо 3</p>`;
            return;
          }
          
          // Validate all tasks before rendering
          const validTasks = [];
          for (let index = 0; index < tasks.length; index++) {
            const task = tasks[index];
            
            // Validate task structure
            if (!task || typeof task !== "object") {
              console.error(`Invalid task at index ${index}:`, task);
              continue;
            }
            
            if (!task.taskText || typeof task.taskText !== "string" || task.taskText.trim() === "") {
              console.error(`Task at index ${index} missing or invalid taskText:`, task);
              continue;
            }
            
            if (!task.targetName || typeof task.targetName !== "string" || task.targetName.trim() === "") {
              console.error(`Task at index ${index} missing or invalid targetName:`, task);
              continue;
            }
            
            validTasks.push({ task, index });
          }
          
          // Ensure we have exactly 3 valid tasks
          if (validTasks.length !== 3) {
            console.error(`Expected 3 valid tasks, but found ${validTasks.length} valid tasks out of ${tasks.length} total`);
            tasksContainer.innerHTML = `<p>Ошибка: найдено ${validTasks.length} валидных заданий вместо 3</p>`;
            return;
          }
          
          // Render each valid task as a button
          validTasks.forEach(({ task, index }) => {
            // CRITICAL: Extract taskId from task object (Firestore docId, e.g., "task-17")
            const taskId = task.taskId;
            if (!taskId) {
              console.error(`[TASK_RENDER] Task at index ${index} missing taskId:`, task);
              return;
            }
            
            const button = document.createElement("button");
            button.className = "task-button";
            button.setAttribute("data-task-index", index);
            // Store taskId and assignmentId for completion (assignment is authoritative write target)
            button.setAttribute("data-task-id", taskId);
            if (task.assignmentId) {
              button.setAttribute("data-assignment-id", task.assignmentId);
            }
            
            // Generate display label (UI-only, never stored in Firestore)
            // Replace generic terms in task text with actual target name
            // Example: "Заставь другого человека назвать овощ" -> "Заставь Bob назвать овощ"
            let taskText = task.taskText.trim();
            const targetName = task.targetName.trim();
            
            // Replace common generic terms with actual target name
            // Order matters: more specific patterns first
            taskText = taskText
              .replace(/другого человека/gi, targetName)
              .replace(/другого игрока/gi, targetName)
              .replace(/кого-то/gi, targetName)
              .replace(/человека/gi, targetName)
              .replace(/игрока/gi, targetName);
            
            // Ensure target name is visible - if replacement didn't work, append it
            // This is a fallback to guarantee target name is always shown
            if (!taskText.includes(targetName)) {
              taskText = `${taskText} (${targetName})`;
            }
            
            // Display label is computed here and only used for UI
            const displayLabel = taskText; // This is "Task N (PlayerName)" format
            
            // Log taskId vs displayLabel for debugging
            console.log(`[TASK_RENDER] Rendering task. taskId="${taskId}", displayLabel="${displayLabel}", status="${task.status || ""}"`);
            
            button.textContent = displayLabel;
            const isFinal =
              task.status === "completed" || task.status === "failed" || task.status === "discarded";
            if (isFinal) {
              button.classList.add("task-button--" + task.status);
              const label = document.createElement("span");
              label.className = "task-result-label";
              label.textContent = task.status === "completed" ? "Completed" : task.status === "failed" ? "Rejected" : "No decision";
              button.appendChild(document.createTextNode(" "));
              button.appendChild(label);
              button.disabled = true;
              if (locallyCompletedTaskId && taskId === locallyCompletedTaskId) {
                locallyCompletedTaskId = null;
              }
            } else if (locallyCompletedTaskId && taskId === locallyCompletedTaskId) {
              // Local "Да" lock (green) before Firestore resolution updates user tasks.
              button.classList.add("task-button--completed");
              button.disabled = true;
              if (!button.querySelector(".task-result-label")) {
                const label = document.createElement("span");
                label.className = "task-result-label";
                label.textContent = "Completed";
                button.appendChild(document.createTextNode(" "));
                button.appendChild(label);
              }
            }
            tasksContainer.appendChild(button);
          });
          
          // Verify all tasks were rendered
          const renderedButtons = tasksContainer.querySelectorAll(".task-button");
          if (renderedButtons.length !== 3) {
            console.error(`Expected to render 3 task buttons, but rendered ${renderedButtons.length}`);
            tasksContainer.innerHTML = `<p>Ошибка: отображено ${renderedButtons.length} заданий вместо 3</p>`;
            return;
          }

          // Server-side "timer start" for this player: first-task duration uses time from here to first completion.
          if (gameRoundId && userData?.tasksShownForRoundId !== gameRoundId) {
            try {
              await updateDoc(userRef, {
                tasksShownAt: serverTimestamp(),
                tasksShownForRoundId: gameRoundId
              });
            } catch (err) {
              console.warn("[TASKS_SHOWN] Failed to persist tasksShownAt:", err);
            }
          }
          
          // Attach click handlers to dynamically created buttons
          const taskButtons = tasksContainer.querySelectorAll(".task-button");
          if (taskButtons.length > 0 && confirmationArea && confirmationMessage) {
            taskButtons.forEach((button) => {
              button.addEventListener("click", () => {
                if (button.disabled) return;
                const taskIndex = parseInt(button.getAttribute("data-task-index"));
                const taskId = button.getAttribute("data-task-id"); // Firestore docId
                const assignmentId = button.getAttribute("data-assignment-id");
                const task = tasks[taskIndex];
                const displayLabel = button.textContent; // UI-only label
                
                if (task) {
                  // Log that we're using taskId/assignmentId, not displayLabel
                  console.log(`[TASK_CLICK] Task clicked. taskId="${taskId}", assignmentId="${assignmentId || ""}", displayLabel="${displayLabel}"`);

                  // Reset confirmation controls for a fresh completion action.
                  if (confirmYes) confirmYes.disabled = false;
                  if (confirmNo) confirmNo.disabled = false;
                  confirmationArea.removeAttribute("data-phase");
                  
                  // Update confirmation message with display label (UI-only)
                  confirmationMessage.textContent = `Вы выполнили задание: "${displayLabel}"?`;
                  
                  // Store taskId and assignmentId for completion (write targets: assignment doc only)
                  confirmationArea.setAttribute("data-selected-task-id", taskId);
                  if (assignmentId) {
                    confirmationArea.setAttribute("data-selected-assignment-id", assignmentId);
                  } else {
                    confirmationArea.removeAttribute("data-selected-assignment-id");
                  }
                  
                  // Show confirmation area
                  confirmationArea.classList.remove("hidden");
                }
              });
            });
          }
          
          // Log taskIds loaded (for debugging)
          const loadedTaskIds = tasks.map(t => t.taskId).filter(Boolean);
          console.log(`[TASK_LOAD] Loaded ${tasks.length} tasks. taskIds:`, loadedTaskIds);

          // Re-render tasks when user doc updates (e.g. status -> completed/failed/discarded after resolution).
          function renderUserTaskButtons(tasksToRender) {
            if (!tasksContainer || tasksToRender.length !== 3) return;
            const validTasks = [];
            for (let index = 0; index < tasksToRender.length; index++) {
              const task = tasksToRender[index];
              if (!task || typeof task !== "object") continue;
              if (!task.taskText || typeof task.taskText !== "string" || task.taskText.trim() === "") continue;
              if (!task.targetName || typeof task.targetName !== "string" || task.targetName.trim() === "") continue;
              validTasks.push({ task, index });
            }
            if (validTasks.length !== 3) return;
            tasksContainer.innerHTML = "";
            validTasks.forEach(({ task, index }) => {
              const taskId = task.taskId;
              if (!taskId) return;
              const button = document.createElement("button");
              button.className = "task-button";
              button.setAttribute("data-task-index", index);
              button.setAttribute("data-task-id", taskId);
              if (task.assignmentId) button.setAttribute("data-assignment-id", task.assignmentId);
              let taskText = task.taskText.trim();
              const targetName = task.targetName.trim();
              taskText = taskText
                .replace(/другого человека/gi, targetName)
                .replace(/другого игрока/gi, targetName)
                .replace(/кого-то/gi, targetName)
                .replace(/человека/gi, targetName)
                .replace(/игрока/gi, targetName);
              if (!taskText.includes(targetName)) taskText = `${taskText} (${targetName})`;
              const displayLabel = taskText;
              button.textContent = displayLabel;
              if (task.status === "completed" || task.status === "failed" || task.status === "discarded") {
                button.classList.add("task-button--" + task.status);
                const label = document.createElement("span");
                label.className = "task-result-label";
                label.textContent = task.status === "completed" ? "Completed" : task.status === "failed" ? "Rejected" : "No decision";
                button.appendChild(document.createTextNode(" "));
                button.appendChild(label);
                button.disabled = true;
              }
              tasksContainer.appendChild(button);
              if (confirmationArea && confirmationMessage) {
                button.addEventListener("click", () => {
                  const assignmentId = button.getAttribute("data-assignment-id");
                  const displayLabelClick = button.textContent;
                  if (confirmYes) confirmYes.disabled = false;
                  if (confirmNo) confirmNo.disabled = false;
                  confirmationArea.removeAttribute("data-phase");
                  confirmationMessage.textContent = `Вы выполнили задание: "${displayLabelClick}"?`;
                  confirmationArea.setAttribute("data-selected-task-id", taskId);
                  if (assignmentId) confirmationArea.setAttribute("data-selected-assignment-id", assignmentId);
                  else confirmationArea.removeAttribute("data-selected-assignment-id");
                  confirmationArea.classList.remove("hidden");
                });
              }
            });
          }

          if (!gameUserTasksUnsubscribe) {
            gameUserTasksUnsubscribe = onSnapshot(userRef, (liveUserDoc) => {
              if (!liveUserDoc.exists()) return;
              const liveTasks = normalizeTasksArray(liveUserDoc.data().tasks, "live_user_snapshot");
              if (liveTasks.length === 3) renderUserTaskButtons(liveTasks);
            });
          }

          if (!gameRoomUsersUnsubscribe) {
            const roomUsersRef = collection(db, "rooms", roomId, "users");
            gameRoomUsersUnsubscribe = onSnapshot(roomUsersRef, (usersSnapshot) => {
              latestUsersSnapshotVersion += 1;
              const snapshotVersion = latestUsersSnapshotVersion;

              const roomUsers = [];
              usersSnapshot.forEach((userDoc) => {
                const userData = userDoc.data();
                roomUsers.push({
                  id: userDoc.id,
                  tasks: normalizeTasksArray(userData.tasks, `room_users_snapshot:${userDoc.id}`)
                });
              });

              void (async () => {
                const roundId = await resolveRoundId(roomId);
                if (!roundId || snapshotVersion !== latestUsersSnapshotVersion) {
                  return;
                }

                const anyAwaitingState = buildAnyAwaitingConfirmationState(roomUsers, roomId, roundId);
                if (anyAwaitingState) {
                  const shouldTryBackgroundResolve =
                    anyAwaitingState.eligibleVoterIds.length === 0 || Date.now() >= anyAwaitingState.deadlineMs;
                  if (shouldTryBackgroundResolve) {
                    const resolution = await resolveTaskConfirmationOnce(anyAwaitingState, "background_watchdog");
                    if (resolution.resolved) {
                      console.log("[TASK_RESOLUTION] Confirmation resolved by watchdog:", resolution);
                    }
                  }
                }

                const voteState = buildAwaitingConfirmationVoteState(roomUsers, roomId, userId, roundId);
                if (!voteState) {
                  closeTaskConfirmationModal();
                  return;
                }
                if (!voteState.assignmentId && voteState.taskId && voteState.provocateurId) {
                  voteState.assignmentId = await resolveAssignmentId(voteState.roomId, voteState.roundId, voteState.taskId, voteState.provocateurId);
                }

                const alreadyVoted = voteState.assignmentId
                  ? await hasVoteAlreadyBeenSubmitted(voteState.roomId, voteState.roundId, voteState.assignmentId, userId)
                  : false;

                if (snapshotVersion !== latestUsersSnapshotVersion) {
                  return;
                }

                if (alreadyVoted) {
                  if (
                    activeTaskConfirmationVote &&
                    getTaskVoteStateKey(activeTaskConfirmationVote) === getTaskVoteStateKey(voteState)
                  ) {
                    closeTaskConfirmationModal();
                  }
                  return;
                }

                const currentStateKey = activeTaskConfirmationVote ? getTaskVoteStateKey(activeTaskConfirmationVote) : null;
                const nextStateKey = getTaskVoteStateKey(voteState);
                if (currentStateKey === nextStateKey) {
                  activeTaskConfirmationVote = {
                    ...activeTaskConfirmationVote,
                    ...voteState
                  };
                  const secondsLeft = updateTaskConfirmationTimer(voteState.deadlineMs);
                  if (secondsLeft <= 0) {
                    void handleTaskConfirmationTimeout();
                  } else {
                    const resolution = await resolveTaskConfirmationOnce(voteState, "all_votes_or_timer_check");
                    if (resolution.resolved) {
                      console.log("[TASK_RESOLUTION] Confirmation resolved during state refresh:", resolution);
                    }
                  }
                  return;
                }

                // Popup is now opened from assignments listener (ConfirmationPopup), not from here.
              })();
            });
          }

          // Subscribe to assignments: open ConfirmationPopup for eligible players when any assignment enters confirmation.
          if (!gameAssignmentsUnsubscribe && taskConfirmationModal) {
            const roundIdResolved = await resolveRoundId(roomId);
            if (roundIdResolved) {
              const roundRef = doc(db, "rooms", roomId, "rounds", roundIdResolved);

              // Subscribe to round phase so all players switch together (and after refresh).
              if (!roundPhaseUnsubscribe) {
                roundPhaseUnsubscribe = onSnapshot(roundRef, async (roundSnap) => {
                  latestRoundData = roundSnap?.exists() ? roundSnap.data() : null;
                  const phase = roundSnap?.data()?.gamePhase;
                  if (phase !== "finished") return;
                  if (isFinalLeaderboardRendered) return;

                  isFinalLeaderboardRendered = true;
                  gameContent?.classList.add("hidden");
                  finalLeaderboardContainer?.classList.remove("hidden");
                  hostFinishRoundBtn?.classList.add("hidden");
                  if (hostFinishRoundBtn) hostFinishRoundBtn.disabled = true;
                  confirmationPopupInstance?.hide();
                  ratingPopupInstance?.hide();
                  activeConfirmationAssignmentId = null;
                  activeRatingAssignmentId = null;

                  const { db: firestoreDb } = await import("./firebase.js");
                  const { renderFinalLeaderboard } = await import("./finalLeaderboardScreen.js");
                  await renderFinalLeaderboard(finalLeaderboardContainer, {
                    roomId,
                    roundId: roundIdResolved,
                    db: firestoreDb
                  });
                });
              }

              if (!confirmationPopupInstance) {
                const { ConfirmationPopup } = await import("./confirmationPopup.js");
                confirmationPopupInstance = new ConfirmationPopup(taskConfirmationModal, {
                  timerValueEl: taskConfirmationTimerValue,
                  confirmBtn: taskVoteConfirmBtn,
                  abstainBtn: taskVoteAbstainBtn,
                  rejectBtn: taskVoteRejectBtn
                });
              }

              // STEP 2 — Firestore listener: same path for ALL clients (not only host). Driven by server state only.
              const assignmentsPath = `rooms/${roomId}/rounds/${roundIdResolved}/assignments`;
              const assignmentsRef = collection(db, "rooms", roomId, "rounds", roundIdResolved, "assignments");
              const usersRefForEligible = collection(db, "rooms", roomId, "users");

              console.log("[CONFIRMATION_POPUP] Listener mounted. roomId=" + roomId + ", roundId=" + roundIdResolved + ", path=" + assignmentsPath);

              gameAssignmentsUnsubscribe = onSnapshot(assignmentsRef, (assignmentsSnapshot) => {
                assignmentsListenerChain = assignmentsListenerChain
                  .then(async () => {
                const currentUserId = sessionStorage.getItem("userId");
                if (!currentUserId) {
                  console.warn("[CONFIRMATION_POPUP] Snapshot ignored: no currentUserId (sessionStorage)");
                  return;
                }

                // While current user is submitting their own completion, don't open (or re-open) confirmation popups.
                if (Date.now() < suppressConfirmationPopupsUntilMs || isTaskCompletionWriteInProgress) {
                  if (activeConfirmationAssignmentId) {
                    confirmationPopupInstance?.hide();
                    activeConfirmationAssignmentId = null;
                  }
                  return;
                }

                const docCount = assignmentsSnapshot.size;
                console.log("[CONFIRMATION_POPUP] Snapshot received: " + docCount + " docs");

              // STEP 3 — Detect phases from assignments: confirmation + rating.
              const awaiting = [];
              const ratingCandidates = [];
              assignmentsSnapshot.forEach((docSnap) => {
                const d = docSnap.data();
                const completedBy = d.completedByUserId || d.provocateurId;

                // Confirmation phase
                const awaitingStatus = d.status === "awaiting_confirmation";
                const noResult = d.confirmationResult == null;
                if (awaitingStatus && noResult && d.completedAt) {
                  awaiting.push({
                    assignmentId: docSnap.id,
                    taskId: d.taskId,
                    provocateurId: d.provocateurId,
                    targetId: d.targetId,
                    completedByUserId: completedBy,
                    confirmationStartedAt: d.confirmationStartedAt || d.completedAt
                  });
                  console.log("[CONFIRMATION_POPUP] awaiting_confirmation detected: assignmentId=" + docSnap.id + ", completedByUserId=" + (completedBy || ""));
                }

                // Rating phase (only after accepted confirmation, before ratingResult)
                if (d.confirmationResult === "accepted" && d.ratingResult == null) {
                  ratingCandidates.push({
                    assignmentId: docSnap.id,
                    taskId: d.taskId,
                    provocateurId: d.provocateurId,
                    completedByUserId: completedBy,
                    confirmationResolvedAt: d.confirmationResolvedAt
                  });
                }
              });

              // Confirmation popup handling (bind popup strictly to assignmentId and allow switching).
              if (awaiting.length === 0) {
                if (activeConfirmationAssignmentId) {
                  confirmationPopupInstance?.hide();
                  activeConfirmationAssignmentId = null;
                }
              } else {
                // Prefer newest assignment by confirmationStartedAt.
                const awaitingSorted = [...awaiting].sort((l, r) => {
                  const lm = getTimestampMillis(l.confirmationStartedAt) || 0;
                  const rm = getTimestampMillis(r.confirmationStartedAt) || 0;
                  return rm - lm;
                });

                // Pick the first assignment the current user is eligible to vote on.
                let candidate = null;
                for (const a of awaitingSorted) {
                  const completerId = a.completedByUserId || a.provocateurId;
                  if (currentUserId === completerId) continue;
                  candidate = a;
                  break;
                }

                // If there is no eligible candidate, close the popup (if any).
                if (!candidate) {
                  if (activeConfirmationAssignmentId) {
                    confirmationPopupInstance?.hide();
                    activeConfirmationAssignmentId = null;
                  }
                } else {
                  const a = candidate;
                  const completerId = a.completedByUserId || a.provocateurId;

                  // If assignment changed, force refresh: close old popup and reset state.
                  if (activeConfirmationAssignmentId && activeConfirmationAssignmentId !== a.assignmentId) {
                    confirmationPopupInstance?.hide();
                    activeConfirmationAssignmentId = null;
                  }

                  const alreadyShowingThisConfirmation =
                    activeConfirmationAssignmentId === a.assignmentId &&
                    confirmationPopupInstance &&
                    confirmationPopupInstance.isVisible();

                  if (!alreadyShowingThisConfirmation) {
                  activeConfirmationAssignmentId = a.assignmentId;
                  console.log("[CONFIRMATION_POPUP] Opening popup for assignmentId=" + a.assignmentId);
                  const usersSnap = await getDocs(usersRefForEligible);
                  const allIds = usersSnap.docs.map((u) => u.id);
                  const eligibleVoterIds = allIds.filter((id) => id !== completerId);
                  const startedMs = getTimestampMillis(a.confirmationStartedAt) || Date.now();
                  const deadlineMs = startedMs + TASK_CONFIRMATION_DURATION_SECONDS * 1000;
                  const voteState = {
                    roomId,
                    roundId: roundIdResolved,
                    taskId: a.taskId,
                    assignmentId: a.assignmentId,
                    provocateurId: a.provocateurId,
                    targetId: a.targetId,
                    eligibleVoterIds,
                    deadlineMs
                  };

                  // STEP 6 — Pass required data to popup: assignmentId, taskId, provocateurName, taskText, confirmationStartedAt.
                  let provocateurName = "";
                  let taskText = "";
                  try {
                    const provocateurRef = doc(db, "rooms", roomId, "users", a.provocateurId);
                    const taskTemplateRef = doc(db, "taskTemplates", a.taskId);
                    const [provDoc, taskDoc] = await Promise.all([
                      getDoc(provocateurRef),
                      getDoc(taskTemplateRef)
                    ]);
                    if (provDoc.exists()) provocateurName = provDoc.data().name || "";
                    if (taskDoc.exists()) taskText = taskDoc.data().text || "";
                  } catch (e) {
                    console.warn("[ConfirmationPopup] Could not load provocateur name or task text:", e);
                  }

                  confirmationPopupInstance?.show({
                    taskId: a.taskId,
                    roundId: roundIdResolved,
                    assignmentId: a.assignmentId,
                    provocateurId: a.provocateurId,
                    targetId: a.targetId,
                    completedByUserId: completerId,
                    currentUserId,
                    provocateurName,
                    taskText,
                    confirmationStartedAt: a.confirmationStartedAt,
                    status: "awaiting_confirmation",
                    onVote: async (vote) => {
                      try {
                        const didWrite = await writeVoteExactlyOnce(roomId, roundIdResolved, a.assignmentId, currentUserId, vote);
                        if (didWrite) {
                          console.log("[TASK_VOTE] Vote saved via ConfirmationPopup.", { taskId: a.taskId, vote });
                        }
                        const resolution = await resolveTaskConfirmationOnce(voteState, "vote_submitted");
                        if (resolution.resolved) {
                          console.log("[TASK_RESOLUTION] Resolved after vote:", resolution);
                        }

                        // Rating popup: ONLY from assignments listener after confirmationResult === "accepted"
                        // (opening here too caused rare double modals when snapshot interleaved with onVote).
                      } finally {
                        activeConfirmationAssignmentId = null;
                        confirmationPopupInstance?.hide();
                      }
                    },
                    onTimeout: async () => {
                      try {
                        await writeAutoAbstainForMissingVoters(voteState);
                        const resolution = await resolveTaskConfirmationOnce(voteState, "timer_elapsed");
                        if (resolution.resolved) {
                          console.log("[TASK_RESOLUTION] Resolved after timeout:", resolution);
                        }
                      } catch (e) {
                        console.error("[TASK_VOTE] Timeout/auto-abstain error:", e);
                      } finally {
                        activeConfirmationAssignmentId = null;
                        confirmationPopupInstance?.hide();
                      }
                    }
                  });
                  }
                }
              }

              scheduleRoundScoresPreviewLog(roomId, roundIdResolved);

              // Rating popup handling:
              // Show ONLY for players who already voted "confirm" in Task Confirmation.
              if (!taskRatingModal) return;
              if (!ratingPopupInstance) {
                const { RatingPopup } = await import("./ratingPopup.js");
                ratingPopupInstance = new RatingPopup(taskRatingModal, { timerValueEl: taskRatingTimerValue });
              }

              // If a rating popup is already open for a different assignment, don't open another.
              if (activeRatingAssignmentId != null) {
                return;
              }

              for (const docSnap of assignmentsSnapshot.docs) {
                const d = docSnap.data();
                const assignmentId = docSnap.id;
                const completerId = d.completedByUserId || d.provocateurId;
                if (!completerId) continue;
                if (currentUserId === completerId) continue; // completer can't rate
                // Must match server phase: do not open rating while assignment is still awaiting_confirmation
                // (vote doc may exist briefly before confirmationResult is written).
                if (d.confirmationResult !== "accepted" || d.ratingResult != null) continue;

                const alreadyRated = await hasRatingAlreadyBeenSubmitted(roomId, roundIdResolved, assignmentId, currentUserId);
                if (alreadyRated) continue;

                // Eligibility: must have voted "confirm" for this assignment.
                const voteRef = doc(db, "rooms", roomId, "rounds", roundIdResolved, "assignments", assignmentId, "votes", currentUserId);
                const voteSnap = await getDoc(voteRef);
                if (!voteSnap.exists()) continue;
                const voteData = voteSnap.data() || {};
                if (voteData.vote !== "confirm") continue;

                // Load completer name + task text for UI.
                let completerName = "";
                let taskText = "";
                try {
                  const provocateurRef = doc(db, "rooms", roomId, "users", d.provocateurId);
                  const taskTemplateRef = doc(db, "taskTemplates", d.taskId);
                  const [provDoc, taskDoc] = await Promise.all([getDoc(provocateurRef), getDoc(taskTemplateRef)]);
                  if (provDoc.exists()) completerName = provDoc.data().name || "";
                  if (taskDoc.exists()) taskText = taskDoc.data().text || "";
                } catch (e) {
                  console.warn("[RatingPopup] Could not load completer name/task text:", e);
                }

                activeRatingAssignmentId = assignmentId;
                console.log("[RATING_POPUP] Opening rating popup for assignmentId=" + assignmentId);
                ratingPopupInstance?.show({
                  roomId,
                  roundId: roundIdResolved,
                  assignmentId,
                  completedByUserId: completerId,
                  currentUserId,
                  confirmationResolvedAt: d.confirmationResolvedAt || voteData.votedAt || Date.now(),
                  taskText,
                  completerName,
                  onRate: async (rating) => {
                    try {
                      await writeRatingExactlyOnce(roomId, roundIdResolved, assignmentId, currentUserId, rating);
                      console.log("[TASK_RATING] Rating saved.", { assignmentId, rating });
                    } finally {
                      activeRatingAssignmentId = null;
                      ratingPopupInstance?.hide();
                    }
                  },
                  onTimeout: async () => {
                    try {
                      await writeRatingExactlyOnce(roomId, roundIdResolved, assignmentId, currentUserId, 2.5);
                      console.log("[TASK_RATING] Auto-rating 2.5 saved.", { assignmentId });
                    } finally {
                      activeRatingAssignmentId = null;
                      ratingPopupInstance?.hide();
                    }
                  }
                });
                return;
              }

              // Resolve rating phase for accepted assignments past deadline (writes finalScore).
              assignmentsSnapshot.forEach((docSnap) => {
                const d = docSnap.data();
                if (d.confirmationResult === "accepted" && d.ratingResult == null) {
                  void resolveRatingPhaseOnce(roomId, roundIdResolved, docSnap.id, d).then((r) => {
                    if (r.resolved) console.log("[RATING_RESOLUTION] Resolved assignment", docSnap.id, r);
                  });
                }
              });

              // Check if all assignments for the round are fully done → finish.
              // Requirement: final screen only when ALL players completed ALL tasks.
              const expectedAssignmentsCount = Number(latestRoundData?.expectedAssignmentsCount || 0);
              const hasAllAssignments =
                expectedAssignmentsCount > 0 && assignmentsSnapshot.size === expectedAssignmentsCount;

              let allResolved = true;
              assignmentsSnapshot.forEach((docSnap) => {
                const d = docSnap.data();
                if (d.confirmationResult == null) allResolved = false;
                else if (d.confirmationResult === "accepted" && d.ratingResult == null) allResolved = false;
              });

              if (hasAllAssignments && allResolved) {
                // Mark round as finished in Firestore (only once via transaction),
                // final leaderboard is rendered by the roundRef listener.
                void markRoundFinishedOnce(roundRef);
              }
                  })
                  .catch((err) => {
                    console.error("[ASSIGNMENTS_LISTENER] Handler error:", err);
                  });
              });
            }
          }
        } else {
          console.log("User document not found");
          tasksContainer.innerHTML = "<p>Данные пользователя не найдены</p>";
        }
      } catch (error) {
        console.error("Error loading user tasks:", error);
        if (tasksContainer) {
          tasksContainer.innerHTML = "<p>Ошибка загрузки заданий</p>";
        }
      }
    })();
  } else {
    console.log("Missing roomId or userId");
    if (tasksContainer) {
      tasksContainer.innerHTML = "<p>Не удалось определить комнату или пользователя</p>";
    }
  }
}

// Confirmation buttons handlers
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");

if (confirmYes) {
  confirmYes.addEventListener("click", async () => {
    const taskId = confirmationArea?.getAttribute("data-selected-task-id");
    const assignmentId = confirmationArea?.getAttribute("data-selected-assignment-id");

    if (!taskId) {
      console.error("[TASK_COMPLETE] No taskId found in confirmation area");
      return;
    }

    if (isTaskCompletionWriteInProgress) {
      console.log(`[TASK_COMPLETE] Duplicate click ignored. taskId="${taskId}"`);
      return;
    }

    const roomId = sessionStorage.getItem("roomId");
    const userId = sessionStorage.getItem("userId");
    const roundId = (await resolveRoundId(roomId)) || sessionStorage.getItem("roundId");

    if (!roomId || !userId || !roundId) {
      console.error("[TASK_COMPLETE] Missing roomId or userId or roundId");
      return;
    }

    isTaskCompletionWriteInProgress = true;
    confirmYes.disabled = true;
    if (confirmNo) confirmNo.disabled = true;

    // IMPORTANT: completer must never see a stale confirmation/rating popup from previous cycles.
    // Force-close any existing modals and reset active ids before writing new completion.
    try {
      confirmationPopupInstance?.hide();
      ratingPopupInstance?.hide();
    } catch (_) {}
    activeConfirmationAssignmentId = null;
    activeRatingAssignmentId = null;
    activeTaskConfirmationVote = null;
    isSubmittingTaskVote = false;
    suppressConfirmationPopupsUntilMs = Date.now() + 5000;

    // Remember locally so we can re-apply disabled+green even if UI re-renders.
    locallyCompletedTaskId = taskId;

    // Immediately disable + mark the task as "completed" locally (green),
    // so it can't be clicked again while we wait for confirmation resolution.
    if (tasksContainer) {
      const taskButtons = tasksContainer.querySelectorAll(".task-button");
      taskButtons.forEach((btn) => {
        const btnTaskId = btn.getAttribute("data-task-id");
        if (btnTaskId !== taskId) return;

        btn.classList.remove("task-button--pending");
        btn.classList.add("task-button--completed");
        btn.disabled = true;

        if (!btn.querySelector(".task-result-label")) {
          const label = document.createElement("span");
          label.className = "task-result-label";
          label.textContent = "Completed";
          btn.appendChild(document.createTextNode(" "));
          btn.appendChild(label);
        }
      });
    }

    try {
      const { db } = await import("./firebase.js");
      const { doc, getDoc, getDocs, collection, updateDoc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const usersRef = collection(db, "rooms", roomId, "users");
      const usersSnapshot = await getDocs(usersRef);
      const allPlayerIds = usersSnapshot.docs.map((d) => d.id);
      const confirmationDeadlineMs = Date.now() + TASK_CONFIRMATION_DURATION_SECONDS * 1000;

      let targetId = null;

      // Resolve targetId first (needed for assignment payload when using fallback id).
      const playerTaskRef = doc(db, "rooms", roomId, "users", userId);
      const playerSnap = await getDoc(playerTaskRef);
      if (playerSnap.exists()) {
        const tasks = normalizeTasksArray(playerSnap.data().tasks, "confirmYes_read");
        const t = tasks.find((task) => task && task.taskId === taskId);
        if (t) targetId = t.targetUserId || null;
      }

      // STEP 1 — Always write assignment doc so other clients' listener sees it. Use updateDoc; fallback id if no assignmentId.
      const effectiveAssignmentId = assignmentId || `${userId}_${taskId}`;
      const assignmentPath = `rooms/${roomId}/rounds/${roundId}/assignments/${effectiveAssignmentId}`;
      const assignmentRef = doc(db, "rooms", roomId, "rounds", roundId, "assignments", effectiveAssignmentId);
      const assignmentPayload = {
        status: "awaiting_confirmation",
        completedAt: serverTimestamp(),
        confirmationStartedAt: serverTimestamp(),
        completedByUserId: userId
      };
      if (!assignmentId) {
        assignmentPayload.taskId = taskId;
        assignmentPayload.provocateurId = userId;
        assignmentPayload.targetId = targetId || "";
      }

      console.log("[TASK_COMPLETE] BEFORE write. Path:", assignmentPath, "Payload keys:", Object.keys(assignmentPayload));
      try {
        const assignmentSnap = await getDoc(assignmentRef);
        if (assignmentSnap.exists() && assignmentSnap.data().completedAt) {
          console.log("[TASK_COMPLETE] Assignment already completed, skip write.", effectiveAssignmentId);
        } else {
          if (assignmentSnap.exists()) {
            await updateDoc(assignmentRef, {
              status: "awaiting_confirmation",
              completedAt: serverTimestamp(),
              confirmationStartedAt: serverTimestamp(),
              completedByUserId: userId
            });
          } else {
            await setDoc(assignmentRef, {
              taskId,
              provocateurId: userId,
              targetId: targetId || "",
              status: "awaiting_confirmation",
              createdAt: serverTimestamp(),
              completedAt: serverTimestamp(),
              confirmationStartedAt: serverTimestamp(),
              completedByUserId: userId,
              confirmationResult: null,
              score: null
            }, { merge: true });
          }
          console.log("[TASK_COMPLETE] AFTER write success.", assignmentPath);
        }
      } catch (writeErr) {
        console.error("[TASK_COMPLETE] AFTER write FAILED.", assignmentPath, writeErr);
        throw writeErr;
      }

      // 3) Create/update round task document for voting (separate from user doc; does not touch player tasks).
      const roundTaskRef = doc(db, "rooms", roomId, "rounds", roundId, "tasks", taskId);
      const eligibleVoterIds = allPlayerIds.filter((id) => id !== userId);
      const roundTaskPayload = {
        taskId,
        roundId,
        provocateurId: userId,
        targetId: targetId || "",
        status: "awaiting_confirmation",
        completedAt: serverTimestamp(),
        confirmationStartedAt: serverTimestamp(),
        confirmationDeadlineMs,
        eligibleVoterIds,
        eligibleVotersCount: eligibleVoterIds.length,
        totalVotes: 0,
        voteCounts: { confirm: 0, abstain: 0, reject: 0 }
      };
      console.log("[FIRESTORE_WRITE] Setting round task for voting. Path:", `rooms/${roomId}/rounds/${roundId}/tasks/${taskId}`, "(merge)");
      await setDoc(roundTaskRef, roundTaskPayload, { merge: true });

      // 4) Defensive: confirm player document was not modified (all tasks still present).
      const afterSnap = await getDoc(playerTaskRef);
      const tasksAfter = normalizeTasksArray(afterSnap.exists() ? afterSnap.data().tasks : null, "confirmYes_after");
      console.log("[TASK_COMPLETE] After write: player tasks count =", tasksAfter.length, "(expected unchanged; no user doc write)");

      resetConfirmationUIState({ restoreTaskInteractivity: false });
    } catch (error) {
      console.error("[TASK_COMPLETE] Failed to persist completion:", error);
      if (confirmYes) confirmYes.disabled = false;
      if (confirmNo) confirmNo.disabled = false;
    } finally {
      isTaskCompletionWriteInProgress = false;
      suppressConfirmationPopupsUntilMs = 0;
    }
  });
}

if (confirmNo) {
  confirmNo.addEventListener("click", () => {
    resetConfirmationUIState();
  });
}
