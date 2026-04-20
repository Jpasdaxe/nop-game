import { useState, useEffect, useRef } from "react";
import SongChoices from "../components/SongChoices";
import LyricsDisplay from "../components/LyricsDisplay";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function GameScreen({
  socket, roomState, myId, role, songs,
  judgeData, setJudgeData, audioRef,
  usedSongIds = [],
}) {
  const [answer, setAnswer]             = useState("");
  const [submitted, setSubmitted]       = useState(false);
  const [countdown, setCountdown]       = useState(null);
  const [volume, setVolume]             = useState(0.8);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isMyTurn, setIsMyTurn]         = useState(false);
  const countdownRef  = useRef(null);
  const stopRef       = useRef(null);
  const cutCheckRef   = useRef(null);

  const isHost   = role === "host";
  const isActive = roomState?.activePlayerId === myId;
  const status   = roomState?.status;

  // Effet visuel "c'est ton tour"
  useEffect(() => {
    if (status === "choosing" && isActive) {
      setIsMyTurn(true);
      const t = setTimeout(() => setIsMyTurn(false), 3000);
      return () => clearTimeout(t);
    }
  }, [status, isActive]);

  useEffect(() => {
    if (audioRef?.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (status !== "playing" || !roomState?.currentSong) return;
    const { audioUrl, cutAt } = roomState.currentSong;
    const audio = audioRef.current;

    clearTimeout(countdownRef.current);
    clearTimeout(stopRef.current);
    clearInterval(cutCheckRef.current);
    setCountdown(null);
    setSubmitted(false);
    setAnswer("");
    setAudioLoading(true);

    audio.src = SERVER + audioUrl;
    audio.volume = volume;
    audio.load();

    const startAudio = (lagMs = 0) => {
      const lag = Math.min(lagMs, 2000);
      audio.currentTime = lag / 1000;
      audio.play().catch(() => {});

      // Surveille currentTime pour couper exactement à cutAt
      // indépendant des timeouts qui peuvent dériver
      cutCheckRef.current = setInterval(() => {
        if (audio.currentTime >= cutAt) {
          audio.pause();
          audio.currentTime = 0;
          clearInterval(cutCheckRef.current);
          setCountdown(null);
        }
      }, 50);

      // Countdown 3s avant coupure basé sur currentTime
      const checkCountdown = setInterval(() => {
        const remaining = cutAt - audio.currentTime;
        if (remaining <= 3 && remaining > 0) {
          setCountdown(Math.ceil(remaining));
        }
        if (remaining <= 0) {
          clearInterval(checkCountdown);
          setCountdown(null);
        }
      }, 200);

      countdownRef.current = checkCountdown;
    };

    const onCanPlay = () => {
      setAudioLoading(false);
      socket.emit("audio:ready", { roomCode: roomState.code });
    };
    audio.addEventListener("canplaythrough", onCanPlay, { once: true });

    const onGo = ({ serverTime }) => {
      const lag = Date.now() - serverTime;
      console.log("[audio:go] lag:", lag, "ms");
      startAudio(lag);
    };

    const onReplay = () => {
      setAudioLoading(true);
      clearInterval(cutCheckRef.current);
      clearInterval(countdownRef.current);
      clearTimeout(stopRef.current);
      setCountdown(null);
      audio.load();
      audio.addEventListener("canplaythrough", () => {
        setAudioLoading(false);
        startAudio(0);
      }, { once: true });
    };

    socket.on("audio:go",     onGo);
    socket.on("audio:replay", onReplay);

    return () => {
      audio.removeEventListener("canplaythrough", onCanPlay);
      socket.off("audio:go",     onGo);
      socket.off("audio:replay", onReplay);
      clearInterval(cutCheckRef.current);
      clearInterval(countdownRef.current);
      clearTimeout(stopRef.current);
      setCountdown(null);
      setAudioLoading(false);
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
  const pool = available.length > 0 ? available : songs;

  const easy   = pool.filter(s => s.points === 10);
  const medium = pool.filter(s => s.points === 20);
  const hard   = pool.filter(s => s.points === 30);
  const pick   = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

  const choices = [
    easy.length   > 0 ? { ...pick(easy),   points: 10 } : null,
    medium.length > 0 ? { ...pick(medium), points: 20 } : null,
    hard.length   > 0 ? { ...pick(hard),   points: 30 } : null,
  ];

  socket.emit("game:selectPlayer", { roomCode: roomState.code, playerId, choices });
}

  function judge(verdict) {
    socket.emit("game:judge", { roomCode: roomState.code, verdict });
    setJudgeData(null);
  }

  function replayAudio() {
    socket.emit("audio:replay", { roomCode: roomState.code });
  }

  if (!roomState) return null;
  const { players, activePlayerId, songChoices, currentSong } = roomState;
  const activeName = players.find(p => p.id === activePlayerId)?.name || "";

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      gap:16, padding:16, maxWidth:860, margin:"0 auto" }}>

      {/* Overlay "c'est ton tour !" */}
      {isMyTurn && (
        <div style={{
          position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:200,
          display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", pointerEvents:"none",
          background:"rgba(0,0,0,.6)",
          animation:"fadeInOut 3s ease forwards",
        }}>
          <div style={{
            fontFamily:"var(--font-display)", fontSize:"5rem",
            color:"var(--gold)", letterSpacing:".05em",
            textShadow:"0 0 60px rgba(245,200,66,.8)",
            animation:"pop .4s cubic-bezier(.34,1.56,.64,1) both",
          }}>
            C'EST TON TOUR !
          </div>
          <div style={{ color:"var(--text-dim)", fontSize:"1.2rem", marginTop:16 }}>
            Choisis ta chanson
          </div>
        </div>
      )}

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
        minHeight:300,
        // Bordure dorée si c'est le tour du joueur
        border: isActive && status === "choosing"
          ? "2px solid var(--gold)"
          : "1px solid var(--border)",
        boxShadow: isActive && status === "choosing"
          ? "var(--glow-gold)"
          : "none",
        transition:"border .3s, box-shadow .3s",
      }}>

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
            L'animateur choisit le prochain joueur...
          </div>
        )}

        {status === "choosing" && (
          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:24 }}>
            <div style={{ textAlign:"center" }}>
              <span style={{ fontFamily:"var(--font-display)", fontSize:"1.5rem",
                color: isActive ? "var(--gold)" : "var(--text)",
                textShadow: isActive ? "0 0 20px rgba(245,200,66,.5)" : "none" }}>
                {activeName}
              </span>
              <span style={{ color:"var(--text-dim)", marginLeft:10 }}>choisit sa chanson</span>
            </div>
            <SongChoices choices={songChoices} isActive={isActive}
              onChoose={handleChoose} onAbandon={handleAbandon} />
          </div>
        )}

        {(status === "playing" || status === "judging") && currentSong && !judgeData && (
          <div style={{ width:"100%", display:"flex", flexDirection:"column",
            gap:20, alignItems:"center" }}>

            {/* Countdown */}
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

{/* Paroles synchronisées */}
{!audioLoading && currentSong?.lyrics?.length > 0 && (
  <div style={{ width:"100%", maxWidth:600 }}>
    <LyricsDisplay
      audioRef={audioRef}
      lyrics={currentSong.lyrics}
      cutAt={currentSong.cutAt}
    />
  </div>
)}

            {audioLoading && (
              <div style={{ color:"var(--text-dim)", fontSize:".9rem",
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ display:"inline-block", width:12, height:12,
                  border:"2px solid var(--text-dim)", borderTopColor:"var(--gold)",
                  borderRadius:"50%", animation:"spin 1s linear infinite" }} />
                Chargement...
              </div>
            )}

            {isHost && !audioLoading && (
              <button className="btn btn-ghost"
                style={{ fontSize:".85rem", padding:"8px 16px" }}
                onClick={replayAudio}>
                Relancer la musique
              </button>
            )}

            {!audioLoading && isActive && !submitted && (
              <div style={{ width:"100%", maxWidth:500, display:"flex",
                flexDirection:"column", gap:12, alignItems:"center",
                // Highlight si c'est le joueur actif
                background:"rgba(245,200,66,.05)",
                border:"1px solid rgba(245,200,66,.2)",
                borderRadius:"var(--radius)", padding:20 }}>
                <div style={{ color:"var(--gold)", fontWeight:700, fontSize:".95rem" }}>
                  Complete la suite des paroles :
                </div>
                <input type="text" placeholder="Ta reponse..." value={answer}
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

            {!audioLoading && isActive && submitted && (
              <div style={{ color:"var(--text-dim)", fontStyle:"italic" }}>
                Reponse envoyee, l'animateur juge...
              </div>
            )}

            {!audioLoading && !isActive && !isHost && (
              <div style={{ color:"var(--text-dim)", textAlign:"center" }}>
                <span style={{ color:"var(--gold)", fontWeight:700 }}>{activeName}</span> repond...
              </div>
            )}

            {!audioLoading && isHost && !judgeData && (
              <div style={{ color:"var(--text-dim)", textAlign:"center" }}>
                En attente de la reponse de{" "}
                <span style={{ color:"var(--gold)", fontWeight:700 }}>{activeName}</span>...
              </div>
            )}
          </div>
        )}

        {judgeData && (
          <div style={{ width:"100%", maxWidth:560, display:"flex",
            flexDirection:"column", gap:20, alignItems:"center" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"1.6rem",
              letterSpacing:".05em", color:"var(--gold)", textAlign:"center" }}>
              Reponse de {judgeData.playerName}
            </div>
            <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
              <div className="card" style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:".75rem", fontWeight:900, letterSpacing:".1em",
                  color:"var(--text-dim)", marginBottom:6 }}>REPONSE DU JOUEUR</div>
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
                  <span>Correct</span>
                  <span style={{ fontSize:".85rem", opacity:.8 }}>+{judgeData.points} pts</span>
                </button>
                <button className="btn btn-gold"
                  style={{ flex:1, flexDirection:"column", gap:2, padding:"16px" }}
                  onClick={() => judge("half")}>
                  <span>A moitie</span>
                  <span style={{ fontSize:".85rem", opacity:.8 }}>+{Math.floor(judgeData.points/2)} pts</span>
                </button>
                <button className="btn btn-red"
                  style={{ flex:1, flexDirection:"column", gap:2, padding:"16px" }}
                  onClick={() => judge("none")}>
                  <span>Rate</span>
                  <span style={{ fontSize:".85rem", opacity:.8 }}>0 pt</span>
                </button>
              </div>
            )}
            {!isHost && (
              <div style={{ color:"var(--text-dim)", textAlign:"center", fontStyle:"italic" }}>
                L'animateur est en train de juger...
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInOut {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}