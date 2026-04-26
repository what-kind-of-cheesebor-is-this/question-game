/**
 * Task Assignment Logic
 * 
 * Assigns tasks with target players to all users in a room.
 * Runs once when room status changes to "active".
 */

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  setDoc,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAllTaskTemplates, isValidTaskIdFormat } from "./taskTemplates.js";

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if tasks have already been assigned to any user in the room
 * @param {string} roomId - Room ID
 * @returns {Promise<boolean>} - True if tasks already exist
 */
async function tasksAlreadyAssigned(roomId) {
  try {
    const usersRef = collection(db, "rooms", roomId, "users");
    const usersSnapshot = await getDocs(usersRef);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.tasks && Array.isArray(userData.tasks) && userData.tasks.length > 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking if tasks already assigned:", error);
    return false;
  }
}

/**
 * Get all users in a room
 * @param {string} roomId - Room ID
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function getRoomUsers(roomId) {
  try {
    const usersRef = collection(db, "rooms", roomId, "users");
    const usersSnapshot = await getDocs(usersRef);
    const users = [];
    
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      users.push({
        id: userDoc.id,
        name: userData.name || ""
      });
    });
    
    return users;
  } catch (error) {
    console.error("Error fetching room users:", error);
    return [];
  }
}

/**
 * Select target player for a task, balancing target distribution
 * @param {Array<{id: string, name: string}>} availableTargets - Users who can be targets
 * @param {Map<string, number>} targetCounts - Map of userId -> count of times selected as target
 * @returns {{id: string, name: string}} - Selected target user
 */
function selectTargetPlayer(availableTargets, targetCounts) {
  if (availableTargets.length === 0) {
    throw new Error("No available targets");
  }
  
  // Find minimum target count
  let minCount = Infinity;
  for (const target of availableTargets) {
    const count = targetCounts.get(target.id) || 0;
    if (count < minCount) {
      minCount = count;
    }
  }
  
  // Filter targets with minimum count
  const candidates = availableTargets.filter(target => {
    const count = targetCounts.get(target.id) || 0;
    return count === minCount;
  });
  
  // Randomly select from candidates
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  
  // Update target count
  const currentCount = targetCounts.get(selected.id) || 0;
  targetCounts.set(selected.id, currentCount + 1);
  
  return selected;
}

/**
 * Assign tasks to all users in a room
 * - Writes per-user task entries (for UI)
 * - Writes authoritative assignments under rooms/{roomId}/rounds/{roundId}/assignments/{assignmentId}
 * @param {string} roomId - Room ID
 * @param {string} [roundId] - Optional round ID for this assignment wave
 * @returns {Promise<void>}
 */
async function assignTasksToRoom(roomId, roundId) {
  try {
    // Check if tasks already assigned
    if (await tasksAlreadyAssigned(roomId)) {
      console.log("Tasks already assigned for room:", roomId);
      return;
    }
    
    // Load room users
    const users = await getRoomUsers(roomId);
    if (users.length < 2) {
      console.log("Not enough users for task assignment (need at least 2)");
      return;
    }
    
    // Load task templates
    const templates = await getAllTaskTemplates();
    const requiredTemplates = users.length * 3;
    if (templates.length < requiredTemplates) {
      console.error(`Not enough task templates. Need at least ${requiredTemplates} but have ${templates.length}`);
      throw new Error(`Insufficient task templates: need ${requiredTemplates}, have ${templates.length}`);
    }
    
    // Validate all template IDs are in correct format
    const invalidIds = templates.filter(t => !isValidTaskIdFormat(t.id));
    if (invalidIds.length > 0) {
      console.error(`[TASK_ID_VALIDATION] Found ${invalidIds.length} templates with invalid IDs:`, invalidIds.map(t => t.id));
      throw new Error(`Invalid taskId format detected. All taskIds must be in format "task-<number>"`);
    }
    
    // Shuffle templates to ensure random distribution
    const shuffledTemplates = shuffleArray(templates);
    
    console.log(`[ROUND_START] Starting round for room ${roomId}. Users: ${users.length}, Required tasks: ${requiredTemplates}, Available tasks: ${templates.length}`);
    
    // Track target player counts for balanced distribution
    const targetCounts = new Map();
    users.forEach(user => {
      targetCounts.set(user.id, 0);
    });
    
    // Track used template IDs to ensure uniqueness across the room
    const usedTemplateIds = new Set();
    const assignedTaskIds = [];
    
    // Precompute collection ref for authoritative assignments (optional if roundId is provided)
    const assignmentsCollectionRef = roundId
      ? collection(db, "rooms", roomId, "rounds", roundId, "assignments")
      : null;
    
    // Assign tasks to each user (including host)
    for (const user of users) {
      const userTasks = [];
      let templatesChecked = 0;
      
      // Assign exactly 3 tasks per user
      // Iterate through shuffled templates until we find 3 unused ones
      for (let templateIndex = 0; templateIndex < shuffledTemplates.length && userTasks.length < 3; templateIndex++) {
        templatesChecked++;
        const template = shuffledTemplates[templateIndex];
        
        // Skip if template already used by another user
        if (usedTemplateIds.has(template.id)) {
          continue;
        }
        
        // Select target player (must be different from current user)
        const availableTargets = users.filter(u => u.id !== user.id);
        if (availableTargets.length === 0) {
          console.error("No available targets for user:", user.name);
          break;
        }
        
        const target = selectTargetPlayer(availableTargets, targetCounts);
        
        // Validate target has a valid name
        if (!target || !target.name || typeof target.name !== "string" || target.name.trim() === "") {
          console.error("Target player has invalid name for user:", user.name, "target:", target);
          // Skip this template and try next one
          continue;
        }
        
        // Validate template has valid text
        if (!template.text || typeof template.text !== "string" || template.text.trim() === "") {
          console.error("Template has invalid text:", template);
          continue;
        }
        
        // CRITICAL: Ensure taskId is the Firestore docId, never a display label
        const taskId = template.id; // This is the Firestore docId (e.g., "task-17")
        
        // Validate taskId format one more time before assignment
        if (!isValidTaskIdFormat(taskId)) {
          console.error(`[TASK_ID_VALIDATION] Rejecting template with invalid taskId: "${taskId}". Expected format: "task-<number>"`);
          continue;
        }
        
        // Create task assignment with all required fields
        // IMPORTANT: taskId is the Firestore docId, NOT a display label
        const taskAssignment = {
          taskId: taskId, // Firestore docId (e.g., "task-17")
          taskText: template.text.trim(),
          targetUserId: target.id,
          targetName: target.name.trim()
        };
        
        // Persist authoritative assignment document under rounds/{roundId}/assignments
        if (assignmentsCollectionRef && roundId) {
          const assignmentRef = doc(assignmentsCollectionRef);
          const assignmentId = assignmentRef.id;
          
          // Link assignmentId back to the per-user task entry so UI can reference it later
          taskAssignment.assignmentId = assignmentId;
          
          await setDoc(assignmentRef, {
            taskId: taskId,
            provocateurId: user.id,
            targetId: target.id,
            status: "assigned",
            createdAt: serverTimestamp(),
            completedAt: null,
            confirmationResult: null,
            score: null
          });
          
          console.log("[ASSIGNMENT_WRITE] Created assignment", {
            roomId,
            roundId,
            assignmentId,
            taskId,
            provocateurId: user.id,
            targetId: target.id
          });
        }
        
        // Log assignment for debugging (showing taskId vs display label)
        console.log(`[TASK_ASSIGN] Assigning taskId="${taskId}" to user="${user.name}" with target="${target.name}"`);
        
        userTasks.push(taskAssignment);
        
        usedTemplateIds.add(taskId);
        assignedTaskIds.push(taskId);
      }
      
      // Defensive check: ensure exactly 3 tasks assigned before saving
      if (userTasks.length !== 3) {
        const errorMsg = `Failed to assign exactly 3 tasks to user "${user.name}". Assigned: ${userTasks.length}. Templates checked: ${templatesChecked}. Available templates: ${templates.length - usedTemplateIds.size}`;
        console.error(errorMsg);
        // Don't save incomplete assignment - throw error to prevent partial/corrupted data
        throw new Error(errorMsg);
      }
      
      // Validate all taskIds before saving to Firestore
      const invalidTaskIds = userTasks.filter(t => !isValidTaskIdFormat(t.taskId));
      if (invalidTaskIds.length > 0) {
        const errorMsg = `[TASK_ID_VALIDATION] Cannot save tasks for user "${user.name}": found ${invalidTaskIds.length} tasks with invalid taskIds: ${invalidTaskIds.map(t => t.taskId).join(", ")}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Log taskIds being written to Firestore (for debugging)
      const taskIdsToSave = userTasks.map(t => t.taskId);
      console.log(`[FIRESTORE_WRITE] Writing ${userTasks.length} tasks to user "${user.name}". taskIds:`, taskIdsToSave);
      
      // Save tasks to user document
      // CRITICAL: Only taskId (Firestore docId) is stored, never display labels
      const userRef = doc(db, "rooms", roomId, "users", user.id);
      await updateDoc(userRef, {
        tasks: userTasks
      });
      
      console.log(`[TASK_ASSIGN_COMPLETE] Assigned ${userTasks.length} tasks to user "${user.name}"`);
    }
    
    // Optionally store assigned task IDs at room level
    // CRITICAL: Only taskIds (Firestore docIds) are stored, never display labels
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
      assignedTasks: assignedTaskIds
    });
    
    console.log(`[ROUND_COMPLETE] Task assignment completed for room ${roomId}. Total assigned taskIds: ${assignedTaskIds.length}`);
  } catch (error) {
    console.error("Error assigning tasks to room:", error);
    throw error;
  }
}

export { assignTasksToRoom, tasksAlreadyAssigned };
