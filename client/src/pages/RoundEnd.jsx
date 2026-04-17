import { useEffect } from "react";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function RoundEnd({
  roomState, roundResult, myId, role, socket,
  audioRef, lastSongUrlRef, lastCutAtRef
}) {
  const isHost = role === "host";
  const sorted = [...(roomState?.players || [])].sort((a, b) => b.score - a.score);

  useEffect(() => {
    const audio  = audioRef?.current;
    const url    = lastSongUrlRef?.current;
    const cutAt  = lastCutAtRef?.current || 0;

    console.log("[RoundEnd] audio url:", url, "| cutAt:", cutAt);

    if (!audio || !url) {
      console.warn("[RoundEnd] pas d'audio ou d'url — skip");
      return;
    }

    const fullUrl = SERVER + url;

    const playFromCutAt = () => {
      console.log("[RoundEnd] lecture depuis", cutAt, "s");
      audio.currentTime = cutAt;
      audio.volume = audio.volume > 0 ? audio.volume : 0.8;
      audio.play().catch(e => console.error("[RoundEnd] erreur play:", e));
    };

    audio.src = fullUrl;
    audio.load();
    audio.addEventListener("canplay", playFromCutAt, { once: true });

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", gap:24, padding:32, maxWidth:560, margin:"0 auto" }}>

      {roundResult && (
        <div className="card" style={{ width:"100%", textAlign:"center",
          border:`2px solid ${roundResult.correct ? "var(--green)" : roundResult.abandoned ? "var(--border)" : "var(--red)"}`,
          boxShadow: roundResult.correct ? "0 0 20px rgba(61,220,132,.3)"
            : roundResult.abandoned ? "none" : "0 0 20px rgba(255,77,77,.3)" }}>
          <div style={{ fontSize:"3.5rem", marginBottom:8 }}>
            {roundResult.abandoned ? "🏳️" : roundResult.correct ? "✅" : "❌"}
          </div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"2.2rem",
            letterSpacing:".05em",
            color: roundResult.correct ? "var(--green)" : roundResult.abandoned ? "var(--text-dim)" : "var(--red)" }}>
            {roundResult.abandoned ? "Abandonné"
              : roundResult.correct ? `+${roundResult.points} points !`
              : "Raté !"}
          </div>
          {!roundResult.abandoned && (
            <div style={{ display:"flex", flexDirection:"column", gap:10,
              marginTop:20, textAlign:"left" }}>
              <div style={{ background:"var(--bg2)", borderRadius:"var(--radius-sm)",
                padding:"12px 16px" }}>
                <div style={{ fontSize:".7rem", fontWeight:900, letterSpacing:".1em",
                  color:"var(--text-dim)", marginBottom:4 }}>RÉPONSE DU JOUEUR</div>
                <div style={{ fontWeight:700, fontSize:"1.05rem" }}>
                  « {roundResult.playerAnswer || "—"} »
                </div>
              </div>
              <div style={{ background:"var(--bg2)", border:"1px solid var(--gold)",
                borderRadius:"var(--radius-sm)", padding:"12px 16px" }}>
                <div style={{ fontSize:".7rem", fontWeight:900, letterSpacing:".1em",
                  color:"var(--gold)", marginBottom:4 }}>PAROLES ATTENDUES</div>
                <div style={{ fontWeight:700, fontSize:"1.05rem", color:"var(--gold)" }}>
                  « {roundResult.expected} »
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ width:"100%" }}>
        <div style={{ fontFamily:"var(--font-display)", fontSize:"1.4rem",
          letterSpacing:".05em", marginBottom:16 }}>🏆 Classement</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12,
              padding:"10px 16px", borderRadius:"var(--radius-sm)",
              background: p.id === myId ? "rgba(255,77,141,.1)" : "var(--bg2)",
              border: p.id === myId ? "1px solid rgba(255,77,141,.4)" : "1px solid var(--border)",
              animation:`fadeInUp .3s ${i*.08}s ease both` }}>
              <span style={{ fontWeight:800, width:28, fontSize:"1.1rem" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`}
              </span>
              <span style={{ flex:1, fontWeight:700 }}>{p.name}</span>
              <span style={{ fontFamily:"var(--font-display)", fontSize:"1.3rem",
                color:"var(--gold)" }}>{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <button className="btn btn-gold"
          style={{ width:"100%", fontSize:"1.1rem", padding:"16px",
            animation:"pulse-glow 2s ease-in-out infinite" }}
          onClick={() => {
            console.log("[Tour suivant] code:", roomState?.code,
              "connecté:", socket?.connected, "id:", socket?.id);
            socket.emit("game:nextTurn", { roomCode: roomState.code });
          }}>
          Tour suivant →
        </button>
      )}

      {!isHost && (
        <div style={{ color:"var(--text-dim)", textAlign:"center", fontSize:".9rem" }}>
          En attente de l'animateur…
        </div>
      )}
    </div>
  );
}