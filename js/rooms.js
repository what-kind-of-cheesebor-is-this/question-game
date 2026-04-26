import { db } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Generate a 4-character room code (A-Z, 0-9)
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// createRoom

async function createRoom() {
  // создаём новый документ с авто-ID
  const roomRef = doc(collection(db, "rooms"));
  
  // Generate room code
  const code = generateRoomCode();

  await setDoc(roomRef, {
    status: "waiting",
    code: code,
    createdAt: serverTimestamp(),
  });

  console.log("Room created with id:", roomRef.id, "code:", code);

  return { roomId: roomRef.id, code: code };
}


async function joinRoom(roomId, userName, role = "player") {
    const userRef = doc(
      collection(db, "rooms", roomId, "users")
    );
  
    await setDoc(userRef, {
      name: userName,
      role: role,
      ready: false,
      joinedAt: serverTimestamp(),
    });
  
    console.log("User joined room:", userName, "→", roomId, "as", role);
  
    return userRef.id;
  }

// Find room by access code
async function findRoomByCode(code) {
  const roomsRef = collection(db, "rooms");
  const q = query(roomsRef, where("code", "==", code));
  
  try {
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("Room not found with code:", code);
      return null;
    }
    
    // Get the first matching room (assuming unique codes)
    const roomDoc = querySnapshot.docs[0];
    const roomId = roomDoc.id;
    
    console.log("Room found with code:", code, "roomId:", roomId);
    return roomId;
  } catch (error) {
    console.error("Error finding room by code:", error);
    return null;
  }
}

// Update user ready state
async function updateUserReady(roomId, userId, ready) {
  const userRef = doc(db, "rooms", roomId, "users", userId);
  
  await updateDoc(userRef, {
    ready: ready
  });
  
  console.log("User ready state updated:", userId, "ready:", ready);
}

// Update room status (e.g. waiting -> active)
async function updateRoomStatus(roomId, status, roundId = null) {
  const roomRef = doc(db, "rooms", roomId);
  const payload = {
    status: status
  };

  // Persist active round ID so all clients can sync voting writes.
  if (roundId) {
    payload.roundId = roundId;
    payload.roundStartedAt = serverTimestamp();
  }

  await updateDoc(roomRef, payload);

  console.log("Room status updated:", roomId, "status:", status, "roundId:", roundId);
}

export { createRoom, joinRoom, findRoomByCode, updateUserReady, updateRoomStatus };
