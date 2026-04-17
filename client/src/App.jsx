import { useState, useEffect, useRef } from "react";
import { socket } from "./socket";
import Home from "./pages/Home";
import HostLobby from "./pages/HostLobby";
import PlayerLobby from "./pages/PlayerLobby";
import GameScreen from "./pages/GameScreen";
import RoundEnd from "./pages/RoundEnd";

export default function App() {
  const [screen, setScreen]           = useState("home");
  const [role, setRole]               = useState(null);
  const [roomState, setRoomState]     = useState(null);
  const [myId, setMyId]               = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [songs, setSongs]             = useState([]);
  const [judgeData, setJudgeData]     = useState(null);
  const [usedSongIds, setUsedSongIds] = useState([]);
  const audioRef     = useRef(new Audio());
  const roomCodeRef  = useRef(null);
  const songsRef     = useRef([]);
  // Refs pour lastSongUrl et lastCutAt — jamais périmés dans les closures
  const lastSongUrlRef = useRef(null);
  const lastCutAtRef   = useRef(0);

  const fetchSongs = () => {
    fetch(`${import.meta.env.VITE_SERVER_URL || "http://localhost:3001"}/songs`)
      .then(r => r.json())
      .then(data => {
        console.log("[fetchSongs] chansons chargées:", data.length);
        setSongs(data);
        songsRef.current = data;
      })
      .catch(e => console.error("[fetchSongs] erreur:", e));
  };

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      console.log("[connect] socket id:", socket.id);
      setMyId(socket.id);
      if (roomCodeRef.current) {
        console.log("[reconnect] rejoin room", roomCodeRef.current);
        socket.emit("room:rejoin", { roomCode: roomCodeRef.current });
      }
    });

    socket.on("room:updated", (state) => {
      console.log("[room:updated] status:", state?.status);
      setRoomState(state);
    });

    socket.on("game:launched", (state) => {
      console.log("[game:launched]");
      setRoomState(state);
      setScreen("game");
    });

    socket.on("game:playerSelected", (state) => {
      console.log("[game:playerSelected] activePlayer:", state?.activePlayerId);
      setRoomState(state);
      setJudgeData(null);
    });

    socket.on("game:songChosen", ({ state }) => {
      console.log("[game:songChosen] chanson:", state?.currentSong?.title,
        "url:", state?.currentSong?.audioUrl,
        "cutAt:", state?.currentSong?.cutAt);
      setRoomState(state);
      if (state?.currentSong?.audioUrl) {
        lastSongUrlRef.current = state.currentSong.audioUrl;
        lastCutAtRef.current   = state.currentSong.cutAt || 0;
      }
    });

    socket.on("game:awaitJudge", (data) => {
      console.log("[game:awaitJudge] joueur:", data?.playerName, "réponse:", data?.playerAnswer);
      setJudgeData(data);
    });

    socket.on("game:turnEnded", ({ state, result }) => {
      console.log("[game:turnEnded] correct:", result?.correct, "points:", result?.points);
      console.log("[game:turnEnded] lastSongUrl ref:", lastSongUrlRef.current);
      if (state?.currentSong?.id) {
        setUsedSongIds(prev => [...prev, state.currentSong.id]);
      }
      setRoomState(state);
      setRoundResult(result);
      setJudgeData(null);
      setScreen("roundEnd");
    });

    socket.on("game:goNext", (state) => {
      console.log("[game:goNext] reçu — status:", state?.status,
        "players:", state?.players?.length, "code:", state?.code);
      fetchSongs();
      setRoomState(state);
      setRoundResult(null);
      setJudgeData(null);
      setScreen("game");
    });

    socket.on("room:closed", () => {
      console.log("[room:closed]");
      alert("L'animateur a quitté la partie.");
      setScreen("home");
      setRoomState(null);
      roomCodeRef.current = null;
    });

    fetchSongs();

    return () => {
      socket.off("connect");
      socket.off("room:updated");
      socket.off("game:launched");
      socket.off("game:playerSelected");
      socket.off("game:songChosen");
      socket.off("game:awaitJudge");
      socket.off("game:turnEnded");
      socket.off("game:goNext");
      socket.off("room:closed");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (roomState?.code) roomCodeRef.current = roomState.code;
  }, [roomState?.code]);

  useEffect(() => {
    console.log("[screen]", screen, "| songs:", songsRef.current.length,
      "| status:", roomState?.status, "| role:", role);
  }, [screen]);

  const props = {
    socket, roomState, setRoomState,
    myId, role, setRole, setScreen,
    songs, roundResult, setRoundResult,
    judgeData, setJudgeData,
    audioRef,
    lastSongUrlRef,  // ← ref
    lastCutAtRef,    // ← ref
    usedSongIds,
  };

  return (
    <>
      {screen === "home"        && <Home        {...props} />}
      {screen === "hostLobby"   && <HostLobby   {...props} />}
      {screen === "playerLobby" && <PlayerLobby {...props} />}
      {screen === "game"        && <GameScreen  {...props} />}
      {screen === "roundEnd"    && <RoundEnd    {...props} />}
    </>
  );
}