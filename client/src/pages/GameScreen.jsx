import { useState, useEffect, useRef } from "react";
import SongChoices from "../components/SongChoices";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function GameScreen({
  socket, roomState, myId, role, songs,
  judgeData, setJudgeData, audioRef,
  usedSongIds = [],
}) {
  const [answer, setAnswer]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [volume, setVolume]       = useState(0.8);
  const countdownRef = useRef(null);
  const stopRef      = useRef(null);

  const isHost   = role === "host";
  const isActive = roomState?.activePlayerId === myId;
  const status   = roomState?.status;

  useEffect(() => {
    if (audioRef?.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (status !== "playing" || !roomState?.currentSong) return;
    const { audioUrl, cutAt } = roomState.currentSong;
    const audio = audioRef.current;

    clearTimeout(countdownRef.current);
    clearTimeout(stopRef.current);
    setCountdown(null);
    setSubmitted(false);
    setAnswer("");

    audio.src = SERVER + audioUrl;
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});

    const countdownStartMs = Math.max(0, (cutAt - 3) * 1000);
    countdownRef.current = setTimeout(() => {
      setCountdown(3);
      let c = 3;
      const iv = setInterval(() => {
        c -= 1;
        if (c > 0) setCountdown(c);
        else { setCountdown(null); clearInterval(iv); }
      }, 1000);
    }, countdownStartMs);

    stopRef.current = setTimeout(() => {
      audio.pause();
    }, cutAt * 1000);

    return () => {
      clearTimeout(countdownRef.current);
      clearTimeout(stopRef.current);
      setCountdown(null);
    };
  }, [status, roomState?.currentSong?.audioUrl]);

  function handleSubmit() {
    if (submitted || !answer.trim()) return;
    setSubmitted(true);
    socket.emit("game:answer", { roomCode: roomState.code, answer });
  }

  function handleChoose(index) {
    socket.emit("game:chooseSong", { roomCode: roomState.code, choiceIndex: index });
  }

  function handleAbandon() {
    socket.emit("game:abandon", { roomCode: roomState.code });
  }

  function selectPlayer(playerId) {
    if (!isHost) return;
    const available = songs.filter(s => !usedSongIds.includes(s.id));
    const pool = available.length >= 3 ? available : songs;
    const picked = [];
    const copy = [...pool];
    while (picked.length < 3 && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }
    const choices = picked.map((s, i) => ({ ...s, points: [10, 20, 30][i] }));
    socket.emit("game:selectPlayer", { roomCode: roomState.code, playerId, choices });
  }

  function judge(verdict) {
    socket.emit("game:judge", { roomCode: roomState.code, verdict });
    setJudgeData(null);
  }

  if (!roomState) return null;
  const { players, activePlayerId, songChoices, currentSong } = roomState;
  const activeName = players.find(p => p.id === activePlayerId)?.name || "";

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      gap:16, padding:16, maxWidth:860, margin:"0 auto" }}>

      {/* Volume */}
      <div style={{ display:"flex", alignItems:"center", gap:10,
        background:"var(--card)", border:"1px solid var(--border)",
        borderRadius:"var(--radius-sm)", padding:"10px 16px" }}>
        <span style={{ fontSize:"1.1rem" }}>🔊</span>
        <input type="range" min={0} max={1} step={0.05} value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          style={{ flex:1, accentColor:"var(--gold)", cursor:"pointer" }} />
        <span style={{ color:"var(--text-dim)", fontSize:".85rem",
          fontWeight:700, width:36, textAlign:"right" }}>
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Zone centrale */}
      <div className="card" style={{ flex:1, display:"flex", flexDirection:"column",
        gap:20, alignItems:"center", justifyContent:"center", padding:"32px 24px",
        minHeight:300 }}>

        {isHost && status === "waiting" && !judgeData && (
          <div style={{ textAlign:"center", display:"flex",
            flexDirection:"column", gap:20, width:"100%" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"1.8rem",
              letterSpacing:".05em", color:"var(--gold)" }}>
              Choisissez un joueur
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              {players.map(p => (
                <button key={p.id} className="btn btn-ghost"
                  style={{ minWidth:130, flexDirection:"column", gap:4, padding:"16px 20px" }}
                  onClick={() => selectPlayer(p.id)}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:"1.2rem" }}>{p.name}</span>
                  <span style={{ color:"var(--gold)", fontFamily:"var(--font-display)" }}>{p.score} pts</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isHost && status === "waiting" && !judgeData && (
          <div style={{ color:"var(--text-dim)", textAlign:"center", fontSize:"1.1rem" }}>
            L'animateur choisit le prochain joueur…
          </div>
        )}

        {status === "choosing" && (
          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:24 }}>
            <div style={{ textAlign:"center" }}>
              <span style={{ fontFamily:"var(--font-display)", fontSize:"1.5rem",
                color:"var(--gold)" }}>{activeName}</span>
              <span style={{ color:"var(--text-dim)", marginLeft:10 }}>choisit sa chanson</span>
            </div>
            <SongChoices choices={songChoices} isActive={isActive}
              onChoose={handleChoose} onAbandon={handleAbandon} />
          </div>
        )}

        {(status === "playing" || status === "judging") && currentSong && !judgeData && (
          <div style={{ width:"100%", display:"flex", flexDirection:"column",
            gap:20, alignItems:"center" }}>

            {countdown !== null && (
              <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                pointerEvents:"none", zIndex:100 }}>
                <div style={{ fontFamily:"var(--font-display)", fontSize:"10rem",
                  color:"var(--red)", opacity:.95,
                  textShadow:"0 0 60px rgba(255,77,77,.7)" }}>
                  {countdown}
                </div>
              </div>
            )}

            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:"2rem",
                color:"var(--gold)" }}>{currentSong.title}</div>
              <div style={{ color:"var(--text-dim)", fontWeight:600 }}>{currentSong.artist}</div>
              <div style={{ marginTop:8, background:"var(--bg2)", display:"inline-block",
                padding:"4px 16px", borderRadius:99, color:"var(--gold)",
                fontFamily:"var(--font-display)", fontSize:"1.1rem" }}>
                {currentSong.points} pts
              </div>
            </div>

            {isActive && !submitted && (
              <div style={{ display:"flex", flexDirection:"column", gap:12,
                width:"100%", maxWidth:500, alignItems:"center" }}>
                <div style={{ color:"var(--text-dim)", textAlign:"center" }}>
                  Complète la suite des paroles :
                </div>
                <input type="text" placeholder="Ta réponse…" value={answer}
                  autoFocus
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()} />
                <button className="btn btn-gold"
                  style={{ width:"100%", fontSize:"1.1rem" }}
                  disabled={!answer.trim()} onClick={handleSubmit}>
                  Valider
                </button>
              </div>
            )}

            {isActive && submitted && (
              <div style={{ color:"var(--text-dim)", fontStyle:"italic" }}>
                Réponse envoyée, l'animateur juge…
              </div>
            )}

            {!isActive && !isHost && (
              <div style={{ color:"var(--text-dim)", textAlign:"center" }}>
                <span style={{ color:"var(--gold)", fontWeight:700 }}>{activeName}</span> répond…
              </div>
            )}

            {isHost && !judgeData && (
              <div style={{ color:"var(--text-dim)", textAlign:"center" }}>
                En attente de la réponse de{" "}
                <span style={{ color:"var(--gold)", fontWeight:700 }}>{activeName}</span>…
              </div>
            )}
          </div>
        )}

        {judgeData && (
          <div style={{ width:"100%", maxWidth:560, display:"flex",
            flexDirection:"column", gap:20, alignItems:"center" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"1.6rem",
              letterSpacing:".05em", color:"var(--gold)", textAlign:"center" }}>
              Réponse de {judgeData.playerName}
            </div>
            <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
              <div className="card" style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:".75rem", fontWeight:900, letterSpacing:".1em",
                  color:"var(--text-dim)", marginBottom:6 }}>RÉPONSE DU JOUEUR</div>
                <div style={{ fontSize:"1.2rem", fontWeight:700 }}>
                  « {judgeData.playerAnswer} »
                </div>
              </div>
              <div className="card" style={{ padding:"16px 20px",
                border:"1px solid var(--gold)" }}>
                <div style={{ fontSize:".75rem", fontWeight:900, letterSpacing:".1em",
                  color:"var(--gold)", marginBottom:6 }}>PAROLES ATTENDUES</div>
                <div style={{ fontSize:"1.2rem", fontWeight:700, color:"var(--gold)" }}>
                  « {judgeData.expected} »
                </div>
              </div>
            </div>
            {isHost && (
              <div style={{ display:"flex", gap:12, width:"100%", flexWrap:"wrap" }}>
                <button className="btn btn-green"
                  style={{ flex:1, flexDirection:"column", gap:2, padding:"16px" }}
                  onClick={() => judge("full")}>
                  <span>✅ Correct</span>
                  <span style={{ fontSize:".85rem", opacity:.8 }}>+{judgeData.points} pts</span>
                </button>
                <button className="btn btn-gold"
                  style={{ flex:1, flexDirection:"column", gap:2, padding:"16px" }}
                  onClick={() => judge("half")}>
                  <span>🤏 À moitié</span>
                  <span style={{ fontSize:".85rem", opacity:.8 }}>+{Math.floor(judgeData.points/2)} pts</span>
                </button>
                <button className="btn btn-red"
                  style={{ flex:1, flexDirection:"column", gap:2, padding:"16px" }}
                  onClick={() => judge("none")}>
                  <span>❌ Raté</span>
                  <span style={{ fontSize:".85rem", opacity:.8 }}>0 pt</span>
                </button>
              </div>
            )}
            {!isHost && (
              <div style={{ color:"var(--text-dim)", textAlign:"center", fontStyle:"italic" }}>
                L'animateur est en train de juger…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}