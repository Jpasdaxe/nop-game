import { useState } from "react";

export default function HostLobby({ socket, roomState, songs, setScreen }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(roomState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function launch() {
  socket.emit("game:launch", { roomCode: roomState.code }, ({ success }) => {
    if (success) setScreen("game");
  });
}

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      gap:24, padding:24, maxWidth:800, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div style={{ background:"var(--gold)", color:"#111", fontWeight:900,
          fontSize:".8rem", padding:"6px 14px", borderRadius:99 }}>ANIMATEUR</div>
        <div style={{ fontFamily:"var(--font-display)", fontSize:"2rem",
          letterSpacing:".05em" }}>Salle d'attente</div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center",
          gap:10, cursor:"pointer", background:"var(--card)",
          border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
          padding:"10px 18px" }} onClick={copyCode}>
          <span style={{ color:"var(--text-dim)", fontWeight:700 }}>Code :</span>
          <span style={{ fontFamily:"var(--font-display)", fontSize:"1.8rem",
            letterSpacing:".2em", color:"var(--gold)" }}>{roomState.code}</span>
          <span style={{ fontSize:"1.1rem" }}>{copied ? "✓" : "⎘"}</span>
        </div>
      </div>

      {/* Joueurs */}
      <div className="card">
        <div style={{ fontFamily:"var(--font-display)", fontSize:"1.3rem",
          letterSpacing:".05em", marginBottom:16 }}>
          Joueurs ({roomState.players.length}/5)
        </div>
        {roomState.players.length === 0
          ? <div style={{ color:"var(--text-dim)", padding:"24px 0", textAlign:"center" }}>
              En attente de joueurs…<br/>
              <span style={{ fontSize:".9rem" }}>Partage le code ci-dessus</span>
            </div>
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {roomState.players.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center",
                  gap:12, background:"var(--bg2)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)", padding:"10px 16px",
                  animation:"fadeInUp .3s ease both" }}>
                  <div style={{ width:36, height:36, background:"var(--pink)", color:"#fff",
                    borderRadius:"50%", display:"flex", alignItems:"center",
                    justifyContent:"center", fontWeight:900, fontSize:"1rem" }}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight:700, flex:1 }}>{p.name}</span>
                </div>
              ))}
            </div>
        }
      </div>

      <button className="btn btn-gold" style={{ fontSize:"1.1rem", padding:"16px",
        opacity: roomState.players.length === 0 ? .4 : 1 }}
        disabled={roomState.players.length === 0}
        onClick={launch}>
        Lancer la partie →
      </button>
    </div>
  );
}