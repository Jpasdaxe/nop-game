import { useState } from "react";

export default function Home({ socket, setScreen, setRole, setRoomState }) {
  const [view, setView]         = useState("menu"); // menu | join
  const [hostName, setHostName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");

  function createRoom() {
    if (!hostName.trim()) return setError("Entre ton prénom");
    socket.emit("room:create", { hostName: hostName.trim() }, ({ success, code }) => {
      if (!success) return setError("Erreur serveur");
      setRole("host");
      setRoomState({ code, hostName: hostName.trim(), status: "waiting", players: [] });
      setScreen("hostLobby");
    });
  }

  function joinRoom() {
    if (!playerName.trim()) return setError("Entre ton prénom");
    if (code.trim().length < 6) return setError("Code invalide");
    socket.emit("room:join", { roomCode: code.trim().toUpperCase(), playerName: playerName.trim() },
      ({ success, error, state }) => {
        if (!success) return setError(error || "Erreur");
        setRole("player");
        setRoomState(state);
        setScreen("playerLobby");
      });
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:32, padding:24 }}>

      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"4.5rem", fontFamily:"var(--font-display)",
          letterSpacing:".04em", color:"var(--gold)",
          textShadow:"0 0 40px rgba(245,200,66,.4), 3px 3px 0 rgba(0,0,0,.5)" }}>
          N'OUBLIEZ PAS
        </div>
        <div style={{ fontSize:"2rem", fontFamily:"var(--font-display)",
          letterSpacing:".1em", color:"var(--text-dim)" }}>
          LES PAROLES
        </div>
      </div>

      {view === "menu" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", maxWidth:360 }}>
          <button className="btn btn-gold" style={{ fontSize:"1.1rem", padding:"16px" }}
            onClick={() => setView("host")}>
            Je suis l'animateur
          </button>
          <button className="btn btn-pink" style={{ fontSize:"1.1rem", padding:"16px" }}
            onClick={() => setView("join")}>
            Je rejoins la partie
          </button>
        </div>
      )}

      {view === "host" && (
        <div className="card" style={{ width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"1.6rem",
            letterSpacing:".05em", color:"var(--gold)" }}>Animateur</div>
          <input type="text" placeholder="Ton prénom" value={hostName}
            onChange={e => { setHostName(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && createRoom()} />
          {error && <div style={{ color:"var(--red)", fontWeight:700, fontSize:".9rem" }}>{error}</div>}
          <button className="btn btn-gold" onClick={createRoom}>Créer la partie</button>
          <button className="btn btn-ghost" onClick={() => setView("menu")}>Retour</button>
        </div>
      )}

      {view === "join" && (
        <div className="card" style={{ width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"1.6rem",
            letterSpacing:".05em", color:"var(--pink)" }}>Rejoindre</div>
          <input type="text" placeholder="Ton prénom" value={playerName}
            onChange={e => { setPlayerName(e.target.value); setError(""); }} />
          <input type="text" placeholder="Code de la partie" value={code}
            maxLength={6} style={{ textTransform:"uppercase", letterSpacing:".2em",
              textAlign:"center", fontFamily:"var(--font-display)", fontSize:"1.4rem" }}
            onChange={e => { setCode(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && joinRoom()} />
          {error && <div style={{ color:"var(--red)", fontWeight:700, fontSize:".9rem" }}>{error}</div>}
          <button className="btn btn-pink" onClick={joinRoom}>Rejoindre</button>
          <button className="btn btn-ghost" onClick={() => setView("menu")}>Retour</button>
        </div>
      )}
    </div>
  );
}