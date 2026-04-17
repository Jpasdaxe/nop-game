import { useEffect, useRef } from "react";

export default function CameraGrid({ players, myId, activePlayerId, localStream }) {
  return (
    <div style={{ display:"flex", gap:10, justifyContent:"center",
      flexWrap:"wrap", padding:"12px 0" }}>
      {players.map(p => (
        <PlayerTile key={p.id} player={p} isMe={p.id === myId}
          isActive={p.id === activePlayerId}
          stream={p.id === myId ? localStream : null} />
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
    <div style={{ width:140, display:"flex", flexDirection:"column",
      gap:6, animation:"fadeInUp .3s ease both" }}>
      <div style={{ position:"relative", aspectRatio:"4/3",
        background:"var(--bg2)", borderRadius:10,
        border:`2px solid ${borderColor}`, boxShadow:glow, overflow:"hidden" }}>
        {stream
          ? <video ref={videoRef} autoPlay muted playsInline
              style={{ width:"100%", height:"100%", objectFit:"cover",
                transform:"scaleX(-1)", display:"block" }} />
          : <div style={{ width:"100%", height:"100%", display:"flex",
              alignItems:"center", justifyContent:"center",
              fontSize:"1.8rem", color:"var(--text-dim)" }}>
              {player.name[0].toUpperCase()}
            </div>
        }
        {isActive && (
          <div style={{ position:"absolute", top:6, right:6,
            background:"var(--gold)", color:"#111", fontWeight:900,
            fontSize:".65rem", padding:"2px 7px", borderRadius:99 }}>
            JOUE
          </div>
        )}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", padding:"0 2px" }}>
        <span style={{ fontWeight:700, fontSize:".85rem",
          color: isMe ? "var(--pink)" : "var(--text)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:90 }}>
          {player.name}
        </span>
        <span style={{ fontFamily:"var(--font-display)", fontSize:"1rem",
          color:"var(--gold)", letterSpacing:".03em" }}>{player.score}</span>
      </div>
    </div>
  );
}