import { useEffect, useRef, useState } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function CameraGrid({ players, myId, activePlayerId, localStream, socket }) {
  const [remoteStreams, setRemoteStreams] = useState({}); // { peerId: MediaStream }
  const peersRef = useRef({}); // { peerId: RTCPeerConnection }

  // Quand localStream est prêt, on annonce notre présence
  useEffect(() => {
    if (!socket || !localStream) return;

    // Informe les autres qu'on est prêt avec une caméra
    socket.emit("webrtc:ready", { myId });

    // Un nouveau pair est prêt → on lui envoie une offre
    socket.on("webrtc:ready", async ({ peerId }) => {
      if (peerId === myId) return;
      await createOffer(peerId);
    });

    // On reçoit une offre → on répond
    socket.on("webrtc:offer", async ({ from, offer }) => {
      await createAnswer(from, offer);
    });

    // On reçoit une réponse
    socket.on("webrtc:answer", async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // On reçoit un ICE candidate
    socket.on("webrtc:ice", async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.off("webrtc:ready");
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice");
    };
  }, [socket, localStream, myId]);

  // Nettoie les peers quand un joueur part
  useEffect(() => {
    const currentIds = players.map(p => p.id);
    Object.keys(peersRef.current).forEach(peerId => {
      if (!currentIds.includes(peerId)) {
        peersRef.current[peerId]?.close();
        delete peersRef.current[peerId];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    });
  }, [players]);

  function createPeerConnection(peerId) {
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Ajoute notre stream local
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    // Reçoit le stream distant
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
    };

    // Envoie les ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc:ice", { to: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        delete peersRef.current[peerId];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    peersRef.current[peerId] = pc;
    return pc;
  }

  async function createOffer(peerId) {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc:offer", { to: peerId, offer });
  }

  async function createAnswer(peerId, offer) {
    const pc = createPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc:answer", { to: peerId, answer });
  }

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", padding: "12px 0" }}>
      {players.map(p => (
        <PlayerTile
          key={p.id}
          player={p}
          isMe={p.id === myId}
          isActive={p.id === activePlayerId}
          stream={p.id === myId ? localStream : remoteStreams[p.id] || null}
        />
      ))}
    </div>
  );
}

function PlayerTile({ player, isMe, isActive, stream }) {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const borderColor = isActive ? "var(--gold)" : isMe ? "var(--pink)" : "var(--border)";
  const glow = isActive ? "var(--glow-gold)" : isMe ? "var(--glow-pink)" : "none";

  return (
    <div style={{ width: 140, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: "var(--bg2)",
        borderRadius: 10, border: `2px solid ${borderColor}`, boxShadow: glow, overflow: "hidden" }}>
        {stream
          ? <video ref={videoRef} autoPlay muted={isMe} playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover",
                transform: isMe ? "scaleX(-1)" : "none", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: "1.8rem", color: "var(--text-dim)" }}>
              {player.name[0].toUpperCase()}
            </div>
        }
        {isActive && (
          <div style={{ position: "absolute", top: 6, right: 6, background: "var(--gold)",
            color: "#111", fontWeight: 900, fontSize: ".65rem", padding: "2px 7px", borderRadius: 99 }}>
            JOUE
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
        <span style={{ fontWeight: 700, fontSize: ".85rem", color: isMe ? "var(--pink)" : "var(--text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
          {player.name}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem",
          color: "var(--gold)", letterSpacing: ".03em" }}>{player.score}</span>
      </div>
    </div>
  );
}