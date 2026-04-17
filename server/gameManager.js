/**
 * gameManager.js – v2
 * Nouvelles règles : 5 joueurs max, host désigne qui joue,
 * 3 chansons proposées (10/20/30 pts), extrait audio + réponse libre
 */

const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  rooms.set(code, {
    code,
    hostId,
    hostName,
    status: "waiting",       // waiting | choosing | playing | roundEnd
    players: [],             // [{ id, name, score }]
    activePlayerId: null,    // joueur qui joue ce tour
    songChoices: [],         // 3 chansons proposées
    currentSong: null,       // chanson choisie
    roundTimer: null,
  });
  console.log(`[Room] Créée : ${code} par ${hostName}`);
  return code;
}

function joinRoom(roomCode, playerId, playerName) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: "Room introuvable" };
  if (room.status !== "waiting") return { success: false, error: "Partie déjà commencée" };
  if (room.players.length >= 5) return { success: false, error: "Room complète (5/5)" };
  if (room.players.find((p) => p.name === playerName))
    return { success: false, error: "Pseudo déjà pris" };

  room.players.push({ id: playerId, name: playerName, score: 0 });
  return { success: true };
}

function leaveRoom(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== playerId);
}

/**
 * Host désigne un joueur actif + envoie 3 chansons proposées
 * choices = [{ title, artist, points, audioUrl, answer, cutAt }]
 *   cutAt = timestamp en secondes où l'audio est coupé
 *   answer = texte attendu après la coupure
 */
function setActivePlayer(roomCode, playerId, songChoices) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: "Room introuvable" };

  room.activePlayerId = playerId;
  room.songChoices = songChoices; // on stocke avec les réponses côté serveur
  room.status = "choosing";
  return { success: true };
}

/**
 * Le joueur actif choisit une chanson (par index 0/1/2)
 */
function chooseSong(roomCode, playerId, choiceIndex) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: "Room introuvable" };
  if (room.activePlayerId !== playerId) return { success: false, error: "Pas ton tour" };
  if (room.status !== "choosing") return { success: false, error: "Mauvais état" };

  const song = room.songChoices[choiceIndex];
  if (!song) return { success: false, error: "Choix invalide" };

  room.currentSong = song;
  room.status = "playing";
  room.roundStartTime = Date.now();
  return { success: true, song };
}

/**
 * Le joueur abandonne son tour → 0 pt, retour à waiting
 */
function abandonTurn(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room) return { success: false };
  room.status = "roundEnd";
  return { success: true };
}

/**
 * Valide la réponse libre du joueur
 */
function submitAnswer(roomCode, playerId, answer) {
  const room = rooms.get(roomCode);
  if (!room || room.status !== "playing") return { correct: false, points: 0 };
  if (room.activePlayerId !== playerId) return { correct: false, points: 0 };

  // On stocke la réponse du joueur pour que l'host puisse juger
  room.playerAnswer = answer;
  room.status = "judging"; // nouvel état : host doit juger

  return {
    points: room.currentSong.points,
    playerAnswer: answer,
    expected: room.currentSong.answer,
  };
}
function judgeAnswer(roomCode, verdict) {
  // verdict: "full" | "half" | "none"
  const room = rooms.get(roomCode);
  if (!room) return { success: false };

  const basePoints = room.currentSong.points;
  const points = verdict === "full" ? basePoints
               : verdict === "half" ? Math.floor(basePoints / 2)
               : 0;

  if (points > 0) {
    const p = room.players.find((p) => p.id === room.activePlayerId);
    if (p) p.score += points;
  }

  const correct = verdict !== "none";
  room.status = "roundEnd";

  return {
    correct,
    points,
    verdict,
    playerAnswer: room.playerAnswer,
    expected: room.currentSong.answer,
  };
}

function endRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }
  room.status = "waiting";
  room.activePlayerId = null;   // ← remet à null AVANT que getRoomState soit appelé
  room.currentSong = null;
  room.songChoices = [];
  room.playerAnswer = null;
}

function getRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  return {
    code: room.code,
    hostName: room.hostName,
    status: room.status,
    players: room.players,
    activePlayerId: room.activePlayerId,
    // Choix de chansons sans les réponses
    songChoices: room.songChoices.map(({ title, artist, points, audioUrl, cutAt }) => ({
      title, artist, points, audioUrl, cutAt
    })),
    currentSong: room.currentSong
      ? { title: room.currentSong.title, artist: room.currentSong.artist,
          points: room.currentSong.points, audioUrl: room.currentSong.audioUrl,
          cutAt: room.currentSong.cutAt }
      : null,
  };
}

function deleteRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (room?.roundTimer) clearTimeout(room.roundTimer);
  rooms.delete(roomCode);
}

function findRoomBySocket(socketId) {
  for (const [code, room] of rooms) {
    if (room.hostId === socketId) return { room, isHost: true };
    if (room.players.find((p) => p.id === socketId)) return { room, isHost: false };
  }
  return null;
}

module.exports = {
  createRoom, joinRoom, leaveRoom,
  setActivePlayer, chooseSong, abandonTurn,
  submitAnswer, judgeAnswer, endRound,
  getRoomState, deleteRoom, findRoomBySocket,
};