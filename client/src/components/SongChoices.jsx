export default function SongChoices({ choices, onChoose, onAbandon, isActive }) {
  const colors = ["var(--green)", "var(--gold)", "var(--pink)"];
  const labels = ["FACILE", "MOYEN", "DIFFICILE"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%", maxWidth:560, margin:"0 auto" }}>
      {choices.map((song, i) => {
        // song peut être null si la catégorie est épuisée
        if (!song) {
          return (
            <div key={i} style={{
              background:"var(--bg2)", border:`2px dashed ${colors[i]}44`,
              borderRadius:"var(--radius)", padding:"20px 24px",
              display:"flex", alignItems:"center", gap:16, opacity:.5,
              animation:`fadeInUp .3s ${i * .1}s ease both`
            }}>
              <div style={{ width:52, height:52, borderRadius:10,
                background:`${colors[i]}22`, display:"flex", alignItems:"center",
                justifyContent:"center", flexShrink:0, flexDirection:"column" }}>
                <span style={{ fontSize:"1.2rem" }}>🚫</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"var(--font-display)", fontSize:"1.1rem",
                  color:"var(--text-dim)", letterSpacing:".03em" }}>
                  Plus de chansons disponibles
                </div>
                <div style={{ color:`${colors[i]}99`, fontWeight:600, fontSize:".85rem", marginTop:4 }}>
                  Catégorie {labels[i]} épuisée
                </div>
              </div>
              <div style={{ fontSize:".7rem", fontWeight:900, letterSpacing:".1em",
                color:`${colors[i]}66`, writingMode:"vertical-rl" }}>{labels[i]}</div>
            </div>
          );
        }

        return (
          <button key={i} className="btn"
            disabled={!isActive}
            onClick={() => onChoose(i)}
            style={{ background:"var(--card)", border:`2px solid ${colors[i]}`,
              borderRadius:"var(--radius)", padding:"20px 24px",
              display:"flex", alignItems:"center", gap:16, textAlign:"left",
              boxShadow: isActive ? `0 0 16px ${colors[i]}44` : "none",
              opacity: isActive ? 1 : .7,
              animation:`fadeInUp .3s ${i * .1}s ease both` }}>
            <div style={{ width:52, height:52, borderRadius:10,
              background:colors[i], display:"flex", alignItems:"center",
              justifyContent:"center", flexShrink:0, flexDirection:"column" }}>
              <span style={{ fontFamily:"var(--font-display)", fontSize:"1.4rem", color:"#111", lineHeight:1 }}>
                {song.points}
              </span>
              <span style={{ fontSize:".55rem", color:"#111", fontWeight:900, letterSpacing:".05em" }}>PTS</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:"1.3rem",
                letterSpacing:".03em", color:"var(--text)", lineHeight:1.2 }}>{song.title}</div>
              <div style={{ color:"var(--text-dim)", fontWeight:600, fontSize:".9rem",
                marginTop:4 }}>{song.artist}</div>
            </div>
            <div style={{ fontSize:".7rem", fontWeight:900, letterSpacing:".1em",
              color:colors[i], writingMode:"vertical-rl" }}>{labels[i]}</div>
          </button>
        );
      })}

      {isActive && (
        <button className="btn btn-ghost" onClick={onAbandon}
          style={{ marginTop:4, color:"var(--red)", borderColor:"var(--red)" }}>
          Abandonner ce tour
        </button>
      )}
      {!isActive && (
        <div style={{ textAlign:"center", color:"var(--text-dim)",
          fontStyle:"italic", padding:"8px 0" }}>
          Le joueur actif est en train de choisir...
        </div>
      )}
    </div>
  );
}