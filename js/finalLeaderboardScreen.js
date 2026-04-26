/**
 * FinalLeaderboardScreen — renders final results after round completion.
 *
 * Aggregates from Firestore:
 * - assignments: finalScore, completedByUserId, confirmationResolvedAt, createdAt
 * - users: names for display
 *
 * Renders ranked list sorted by totalScore (desc), then totalTime (asc for ties).
 */

function getTimestampMillis(value) {
  if (!value) return null;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return null;
}

function formatTimeMs(ms) {
  if (ms == null || ms < 0 || !Number.isFinite(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Full score + time breakdown for a round (same math as final UI). Safe to call while round is in progress.
 *
 * @param {Object} p
 * @param {string} p.roomId
 * @param {string} p.roundId
 * @param {import('firebase/firestore').Firestore} p.db
 * @returns {Promise<{ ranked: Array<{ userId: string, name: string, totalScore: number, totalTimeMs: number, taskDurationsMs: number[] }> }>}
 */
export async function fetchRoundScoreSummary({ roomId, roundId, db }) {
  const empty = { ranked: [] };
  if (!roomId || !roundId || !db) return empty;

  const { getDoc, getDocs, collection, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const assignmentsRef = collection(db, "rooms", roomId, "rounds", roundId, "assignments");
  const usersRef = collection(db, "rooms", roomId, "users");
  const roundRef = doc(db, "rooms", roomId, "rounds", roundId);
  const roomRef = doc(db, "rooms", roomId);

  const [assignmentsSnap, usersSnap, roundSnap, roomSnap] = await Promise.all([
    getDocs(assignmentsRef),
    getDocs(usersRef),
    getDoc(roundRef),
    getDoc(roomRef)
  ]);
  const roundStartedAtMs = getTimestampMillis(roundSnap.exists() ? roundSnap.data().roundStartedAt : null);
  const roomRoundStartedAtMs = getTimestampMillis(roomSnap.exists() ? roomSnap.data().roundStartedAt : null);

  const usersById = new Map();
  usersSnap.forEach((d) => {
    const data = d.data() || {};
    usersById.set(d.id, {
      id: d.id,
      name: data.name || "Unknown",
      tasksShownAt: data.tasksShownAt,
      tasksShownForRoundId: data.tasksShownForRoundId || null
    });
  });

  const playerTotals = new Map();
  usersById.forEach((u, userId) => {
    playerTotals.set(userId, { totalScore: 0, totalTimeMs: 0, taskDurationsMs: [] });
  });

  const byPlayer = new Map();
  assignmentsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const completedBy = data.completedByUserId || data.provocateurId;
    if (!completedBy) return;
    if (!byPlayer.has(completedBy)) byPlayer.set(completedBy, []);
    byPlayer.get(completedBy).push({ id: docSnap.id, data });
  });

  byPlayer.forEach((items, playerId) => {
    const completedTimes = items
      .map((it) => ({
        assignmentId: it.id,
        completedAtMs: getTimestampMillis(it.data.completedAt),
        data: it.data
      }))
      .filter((x) => x.completedAtMs != null)
      .sort((a, b) => a.completedAtMs - b.completedAtMs);

    if (completedTimes.length === 0) return;

    const u = usersById.get(playerId);
    const perPlayerTasksShownMs =
      u?.tasksShownForRoundId === roundId ? getTimestampMillis(u.tasksShownAt) : null;
    const startMs =
      perPlayerTasksShownMs ??
      roundStartedAtMs ??
      roomRoundStartedAtMs ??
      completedTimes[0].completedAtMs;
    const durations = [];
    for (let i = 0; i < completedTimes.length; i++) {
      const prev = i === 0 ? startMs : completedTimes[i - 1].completedAtMs;
      durations.push(Math.max(0, completedTimes[i].completedAtMs - prev));
    }

    const totals = playerTotals.get(playerId) || { totalScore: 0, totalTimeMs: 0, taskDurationsMs: [] };
    totals.taskDurationsMs = durations.slice(0, 3);
    totals.totalTimeMs = totals.taskDurationsMs.reduce((acc, v) => acc + v, 0);
    playerTotals.set(playerId, totals);
  });

  const assignmentEntries = assignmentsSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));

  const countAbstains = (votesSnap) => {
    let n = 0;
    votesSnap.forEach((v) => {
      const vote = (v.data() || {}).vote;
      if (vote === "abstain") n += 1;
    });
    return n;
  };

  await Promise.all(
    assignmentEntries.map(async ({ id: assignmentId, data }) => {
      const completedBy = data.completedByUserId || data.provocateurId;
      if (!completedBy) return;
      const confirmationResult = data.confirmationResult;
      if (confirmationResult == null) return;

      const votesRef = collection(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "votes");
      let points = 0;

      try {
        const votesSnap = await getDocs(votesRef);
        const abstainCount = countAbstains(votesSnap);

        if (confirmationResult === "accepted") {
          const ratingsRef = collection(db, "rooms", roomId, "rounds", roundId, "assignments", assignmentId, "ratings");
          const ratingsSnap = await getDocs(ratingsRef);
          let sum = 0;
          ratingsSnap.forEach((r) => {
            const payload = r.data() || {};
            const v = payload.rating ?? payload.score;
            if (typeof v === "number" && Number.isFinite(v)) {
              sum += v;
            }
          });
          points = sum + abstainCount * 2.5;
        } else if (confirmationResult === "discarded") {
          // All abstain (or tie confirm/reject with no majority) — still award 2.5 per abstaining voter.
          points = abstainCount * 2.5;
        }
        // rejected: 0 points from this assignment
      } catch (_) {
        // ignore
      }

      if (points === 0 && typeof data.finalScore === "number" && data.finalScore !== 0 && confirmationResult === "accepted") {
        points = data.finalScore;
      }

      if (!playerTotals.has(completedBy)) {
        playerTotals.set(completedBy, { totalScore: 0, totalTimeMs: 0, taskDurationsMs: [] });
      }
      const t = playerTotals.get(completedBy);
      t.totalScore += points;
    })
  );

  const ranked = Array.from(playerTotals.entries())
    .map(([userId, totals]) => ({
      userId,
      name: usersById.get(userId)?.name || "Unknown",
      totalScore: totals.totalScore,
      totalTimeMs: totals.totalTimeMs,
      taskDurationsMs: totals.taskDurationsMs || []
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.totalTimeMs - b.totalTimeMs;
    });

  return { ranked };
}

/**
 * @param {HTMLElement} container - Root container for the leaderboard
 * @param {Object} params
 * @param {string} params.roomId
 * @param {string} params.roundId
 * @param {import('firebase/firestore').Firestore} params.db
 */
export async function renderFinalLeaderboard(container, { roomId, roundId, db }) {
  if (!container || !roomId || !roundId || !db) return;

  const { ranked } = await fetchRoundScoreSummary({ roomId, roundId, db });

  container.innerHTML = "";
  container.classList.remove("hidden");

  const title = document.createElement("h2");
  title.className = "final-leaderboard-title";
  title.textContent = "Final Results";
  container.appendChild(title);

  const list = document.createElement("ol");
  list.className = "final-leaderboard-list";

  ranked.forEach((entry, index) => {
    const row = document.createElement("li");
    const rank = index + 1;
    let rowClass = "final-leaderboard-row";
    if (rank === 1) rowClass += " final-leaderboard-gold";
    else if (rank === 2) rowClass += " final-leaderboard-silver";
    else if (rank === 3) rowClass += " final-leaderboard-bronze";
    row.className = rowClass;

    const rankEl = document.createElement("span");
    rankEl.className = "final-leaderboard-rank";
    rankEl.textContent = String(rank);

    const nameEl = document.createElement("span");
    nameEl.className = "final-leaderboard-name";
    nameEl.textContent = entry.name;

    const scoreEl = document.createElement("span");
    scoreEl.className = "final-leaderboard-score";
    const scoreRounded = Math.round((entry.totalScore || 0) * 100) / 100;
    scoreEl.textContent = String(scoreRounded);

    const timeEl = document.createElement("span");
    timeEl.className = "final-leaderboard-time";
    timeEl.textContent = formatTimeMs(entry.totalTimeMs);

    const taskTimesEl = document.createElement("div");
    taskTimesEl.className = "final-leaderboard-task-times";
    const parts = (entry.taskDurationsMs || []).map((ms) => formatTimeMs(ms));
    taskTimesEl.textContent = parts.length ? parts.join(" · ") : "";

    row.appendChild(rankEl);
    row.appendChild(nameEl);
    row.appendChild(scoreEl);
    row.appendChild(timeEl);
    row.appendChild(taskTimesEl);
    list.appendChild(row);
  });

  container.appendChild(list);
}
