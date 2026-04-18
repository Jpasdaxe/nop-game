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

const roomPeers      = new Map(); // roomCode => Set of socketIds
const roomAudioReady = new Map(); // roomCode => Set of socketIds

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
    // Reset les ready audio pour cette room
    roomAudioReady.delete(roomCode);

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
    gm.endRound(roomCode);
    const state = gm.getRoomState(roomCode);
    console.log("[nextTurn] state:", state?.status, "activePlayer:", state?.activePlayerId);
    io.to(roomCode).emit("game:goNext", state);
    socket.emit("game:goNext", state);
  });

  // ── Sync audio ───────────────────────────────────────────────────────────

  socket.on("audio:ready", ({ roomCode }) => {
    const found = gm.findRoomBySocket(socket.id);
    if (!found) return;

    if (!roomAudioReady.has(roomCode)) roomAudioReady.set(roomCode, new Set());
    roomAudioReady.get(roomCode).add(socket.id);

    const roomSockets = io.sockets.adapter.rooms.get(roomCode);
    const total = roomSockets ? roomSockets.size : 0;
    const ready = roomAudioReady.get(roomCode).size;

    console.log(`[audio:ready] ${ready}/${total} prêts dans ${roomCode}`);

    // Quand tout le monde est prêt → go
    if (ready >= total) {
      roomAudioReady.delete(roomCode);
      console.log(`[audio:go] tout le monde prêt dans ${roomCode}`);
      io.to(roomCode).emit("audio:go", { serverTime: Date.now() });
    }
  });

  // ── WebRTC ───────────────────────────────────────────────────────────────

  socket.on("webrtc:ready", () => {
    const found = gm.findRoomBySocket(socket.id);
    if (!found) return;
    const code = found.room.code;

    const existing = roomPeers.get(code) || new Set();
    socket.emit("webrtc:peerList", { peerIds: [...existing] });

    if (!roomPeers.has(code)) roomPeers.set(code, new Set());
    roomPeers.get(code).add(socket.id);

    socket.to(code).emit("webrtc:ready", { peerId: socket.id });
  });

  socket.on("webrtc:offer",  ({ to, offer })     => io.to(to).emit("webrtc:offer",  { from: socket.id, offer }));
  socket.on("webrtc:answer", ({ to, answer })    => io.to(to).emit("webrtc:answer", { from: socket.id, answer }));
  socket.on("webrtc:ice",    ({ to, candidate }) => io.to(to).emit("webrtc:ice",    { from: socket.id, candidate }));

  // ── Déconnexion ──────────────────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id}`);

    for (const [code, peers] of roomPeers) {
      if (peers.has(socket.id)) {
        peers.delete(socket.id);
        if (peers.size === 0) roomPeers.delete(code);
      }
    }

    for (const [code, ready] of roomAudioReady) {
      if (ready.has(socket.id)) {
        ready.delete(socket.id);
        if (ready.size === 0) roomAudioReady.delete(code);
      }
    }

    const found = gm.findRoomBySocket(socket.id);
    if (!found) return;
    const { room, isHost } = found;
    if (isHost) {
      io.to(room.code).emit("room:closed", { reason: "Host déconnecté" });
      gm.deleteRoom(room.code);
      roomPeers.delete(room.code);
      roomAudioReady.delete(room.code);
    } else {
      gm.leaveRoom(room.code, socket.id);
      io.to(room.code).emit("room:updated", gm.getRoomState(room.code));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ Serveur sur :${PORT}  |  Client : ${CLIENT_URL}`);
});