const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const gm = require("./gameManager");

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3001", CLIENT_URL],
  credentials: true,
}));
app.use(express.json());

const audioDir = path.join(__dirname, "audio");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);
app.use("/audio", express.static(audioDir));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3001", CLIENT_URL],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/songs", (req, res) => {
  try {
    const songs = JSON.parse(
      fs.readFileSync(path.join(__dirname, "songs.json"), "utf8")
    );
    res.json(songs);
  } catch {
    res.json([]);
  }
});

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on("room:create", ({ hostName }, cb) => {
    const code = gm.createRoom(socket.id, hostName);
    socket.join(code);
    cb({ success: true, code });
  });

  socket.on("room:join", ({ roomCode, playerName }, cb) => {
    const result = gm.joinRoom(roomCode, socket.id, playerName);
    if (!result.success) return cb(result);
    socket.join(roomCode);
    const state = gm.getRoomState(roomCode);
    io.to(roomCode).emit("room:updated", state);
    cb({ success: true, state });
  });

  socket.on("game:launch", ({ roomCode }, cb) => {
    const state = gm.getRoomState(roomCode);
    if (!state) return cb?.({ success: false });
    io.to(roomCode).emit("game:launched", state);
    cb?.({ success: true });
  });

  socket.on("game:selectPlayer", ({ roomCode, playerId, choices }, cb) => {
    const result = gm.setActivePlayer(roomCode, playerId, choices);
    if (!result.success) return cb?.(result);
    const state = gm.getRoomState(roomCode);
    io.to(roomCode).emit("game:playerSelected", state);
    cb?.({ success: true });
  });

  socket.on("game:chooseSong", ({ roomCode, choiceIndex }, cb) => {
    const result = gm.chooseSong(roomCode, socket.id, choiceIndex);
    if (!result.success) return cb?.(result);
    const state = gm.getRoomState(roomCode);
    io.to(roomCode).emit("game:songChosen", { state, serverTime: Date.now() });
    cb?.({ success: true });
  });

  socket.on("game:abandon", ({ roomCode }, cb) => {
    const result = gm.abandonTurn(roomCode, socket.id);
    const state = gm.getRoomState(roomCode);
    io.to(roomCode).emit("game:turnEnded", {
      state,
      result: { correct: false, points: 0, abandoned: true },
    });
    cb?.(result);
  });

  socket.on("game:answer", ({ roomCode, answer }, cb) => {
  const result = gm.submitAnswer(roomCode, socket.id, answer);
  const state = gm.getRoomState(roomCode);

  io.to(roomCode).emit("room:updated", state);

  // Tout le monde voit les deux réponses
  io.to(roomCode).emit("game:awaitJudge", {
    playerAnswer: result.playerAnswer,
    expected: result.expected,
    points: result.points,
    playerName: state.players.find(p => p.id === state.activePlayerId)?.name,
  });

  cb?.(result);
});

socket.on("game:judge", ({ roomCode, verdict }, cb) => {
  const result = gm.judgeAnswer(roomCode, verdict);
  const state = gm.getRoomState(roomCode);
  // Envoie le résultat + les deux réponses à tout le monde
  io.to(roomCode).emit("game:turnEnded", {
    state,
    result: {
      ...result,
      playerAnswer: result.playerAnswer,
      expected: result.expected,
    }
  });
  cb?.(result);
});

socket.on("game:nextTurn", ({ roomCode }) => {
  console.log(`[nextTurn] reçu de ${socket.id} pour room ${roomCode}`);
  socket.join(roomCode);
  
  // Vérifie qui est dans la room
  const socketsInRoom = io.sockets.adapter.rooms.get(roomCode);
  console.log("[nextTurn] sockets dans la room:", socketsInRoom ? [...socketsInRoom] : "VIDE");
  
  gm.endRound(roomCode);
  const state = gm.getRoomState(roomCode);
  console.log("[nextTurn] state:", state?.status, "activePlayer:", state?.activePlayerId);
  io.to(roomCode).emit("game:goNext", state);
  socket.emit("game:goNext", state);
});
  socket.on("webrtc:offer",  ({ to, offer })     => io.to(to).emit("webrtc:offer",  { from: socket.id, offer }));
  socket.on("webrtc:answer", ({ to, answer })    => io.to(to).emit("webrtc:answer", { from: socket.id, answer }));
  socket.on("webrtc:ice",    ({ to, candidate }) => io.to(to).emit("webrtc:ice",    { from: socket.id, candidate }));

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id}`);
    const found = gm.findRoomBySocket(socket.id);
    if (!found) return;
    const { room, isHost } = found;
    if (isHost) {
      io.to(room.code).emit("room:closed", { reason: "Host déconnecté" });
      gm.deleteRoom(room.code);
    } else {
      gm.leaveRoom(room.code, socket.id);
      io.to(room.code).emit("room:updated", gm.getRoomState(room.code));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ Serveur sur :${PORT}  |  Client : ${CLIENT_URL}`);
});