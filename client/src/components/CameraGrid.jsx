import { useEffect, useRef, useState } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export default function CameraGrid({ players, myId, activePlayerId, localStream, socket }) {
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef       = useRef({});
  const localStreamRef = useRef(null);
  const initiatedRef   = useRef(false);

  useEffect(() => {
    if (localStream) localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!socket || !localStream || initiatedRef.current) return;
    initiatedRef.current = true;

    socket.emit("webrtc:ready");

    const handlePeerList = async ({ peerIds }) => {
      for (const peerId of peerIds) {
        if (peerId !== myId) await createOffer(peerId);
      }
    };

    const handleReady = async ({ peerId }) => {
      if (peerId === myId) return;
      await createOffer(peerId);
    };

    const handleOffer = async ({ from, offer }) => {
      await createAnswer(from, offer);
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch {}
    };

    const handleIce = async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };

    socket.on("webrtc:peerList", handlePeerList);
    socket.on("webrtc:ready",    handleReady);
    socket.on("webrtc:offer",    handleOffer);
    socket.on("webrtc:answer",   handleAnswer);
    socket.on("webrtc:ice",      handleIce);

    return () => {
      socket.off("webrtc:peerList", handlePeerList);
      socket.off("webrtc:ready",    handleReady);
      socket.off("webrtc:offer",    handleOffer);
      socket.off("webrtc:answer",   handleAnswer);
      socket.off("webrtc:ice",      handleIce);
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current  = {};
      initiatedRef.current = false;
    };
  }, [socket, localStream]);

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
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (e) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: e.streams[0] }));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("webrtc:ice", { to: peerId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        delete peersRef.current[peerId];
        setRemoteStreams(prev => { const n = { ...prev }; delete n[peerId]; return n; });
      }
    };
    peersRef.current[peerId] = pc;
    return pc;
  }

  async function createOffer(peerId) {
    const pc = createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { to: peerId, offer });
    } catch {}
  }

  async function createAnswer(peerId, offer) {
    const pc = createPeerConnection(peerId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: peerId, answer });
    } catch {}
  }

  return (
    <div style={{ display:"flex", gap:10, justifyContent:"center",
      flexWrap:"wrap" }}>
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
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const borderColor = isActive ? "var(--gold)" : isMe ? "var(--pink)" : "var(--border)";
  const glow        = isActive ? "var(--glow-gold)" : isMe ? "var(--glow-pink)" : "none";

  return (
    <div style={{ width:130, display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ position:"relative", aspectRatio:"4/3", background:"var(--bg2)",
        borderRadius:8, border:`2px solid ${borderColor}`, boxShadow:glow, overflow:"hidden" }}>
        {stream
          ? <video ref={videoRef} autoPlay muted={isMe} playsInline
              style={{ width:"100%", height:"100%", objectFit:"cover",
                transform: isMe ? "scaleX(-1)" : "none", display:"block" }} />
          : <div style={{ width:"100%", height:"100%", display:"flex",
              alignItems:"center", justifyContent:"center",
              fontSize:"1.8rem", color:"var(--text-dim)" }}>
              {player.name[0].toUpperCase()}
            </div>
        }
        {isActive && (
          <div style={{ position:"absolute", top:4, right:4, background:"var(--gold)",
            color:"#111", fontWeight:900, fontSize:".6rem", padding:"2px 6px", borderRadius:99 }}>
            JOUE
          </div>
        )}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", padding:"0 2px" }}>
        <span style={{ fontWeight:700, fontSize:".8rem",
          color: isMe ? "var(--pink)" : "var(--text)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:85 }}>
          {player.name}
        </span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:".95rem", color:"var(--gold)" }}>
          {player.score}
        </span>
      </div>
    </div>
  );
}