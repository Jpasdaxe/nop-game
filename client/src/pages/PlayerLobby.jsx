export default function PlayerLobby({ roomState, myId }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      gap:24, padding:24, maxWidth:700, margin:"0 auto" }}>

      <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div style={{ background:"var(--pink)", color:"#fff", fontWeight:900,
          fontSize:".8rem", padding:"6px 14px", borderRadius:99 }}>JOUEUR</div>
        <div style={{ fontFamily:"var(--font-display)", fontSize:"2rem" }}>
          Salle d'attente
        </div>
        <div style={{ marginLeft:"auto", background:"var(--card)",
          border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
          padding:"10px 18px", fontFamily:"var(--font-display)",
          fontSize:"1.4rem", letterSpacing:".15em", color:"var(--pink)" }}>
          {roomState.code}
        </div>
      </div>

      <div className="card" style={{ textAlign:"center", padding:"48px 24px" }}>
        <div style={{ fontSize:"3rem", marginBottom:16 }}>🎤</div>
        <div style={{ fontSize:"1.2rem", fontWeight:800, marginBottom:8 }}>
          En attente de l'animateur…
        </div>
        <div style={{ color:"var(--text-dim)", fontSize:".9rem" }}>
          La partie va bientôt commencer
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily:"var(--font-display)", fontSize:"1.2rem",
          letterSpacing:".05em", marginBottom:16 }}>
          Joueurs ({roomState.players.length}/5)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px,1fr))", gap:12 }}>
          {roomState.players.map(p => (
            <div key={p.id} style={{ display:"flex", flexDirection:"column",
              alignItems:"center", gap:8, padding:"16px 8px",
              background:"var(--bg2)", borderRadius:"var(--radius-sm)",
              border: p.id === myId ? "2px solid var(--pink)" : "2px solid var(--border)",
              boxShadow: p.id === myId ? "var(--glow-pink)" : "none",
              animation:"fadeInUp .3s ease both" }}>
              <div style={{ width:44, height:44, background:"var(--pink)", color:"#fff",
                borderRadius:"50%", display:"flex", alignItems:"center",
                justifyContent:"center", fontWeight:900, fontSize:"1.2rem" }}>
                {p.name[0].toUpperCase()}
              </div>
              <span style={{ fontWeight:700, fontSize:".9rem", textAlign:"center" }}>{p.name}</span>
              {p.id === myId && (
                <span style={{ background:"var(--pink)", color:"#fff", fontSize:".7rem",
                  fontWeight:900, padding:"2px 8px", borderRadius:99 }}>Toi</span>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 5 - roomState.players.length) }).map((_, i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column",
              alignItems:"center", gap:8, padding:"16px 8px",
              background:"var(--bg2)", borderRadius:"var(--radius-sm)",
              border:"2px dashed var(--border)", opacity:.4 }}>
              <div style={{ width:44, height:44, background:"var(--border)",
                borderRadius:"50%", display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:"1.2rem", color:"var(--text-dim)" }}>?</div>
              <span style={{ color:"var(--text-dim)", fontSize:".8rem" }}>Libre</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}