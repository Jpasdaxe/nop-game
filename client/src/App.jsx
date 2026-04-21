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
  const audioRef           = useRef(new Audio());
  const roomCodeRef        = useRef(null);
  const songsRef           = useRef([]);
  const lastSongUrlRef     = useRef(null);
  const lastCutAtRef       = useRef(0);

  const fetchSongs = () => {
    fetch(`${import.meta.env.VITE_SERVER_URL || "http://localhost:3001"}/songs`)
      .then(r => r.json())
      .then(data => { setSongs(data); songsRef.current = data; })
      .catch(() => {});
  };

  // Demande la caméra UNE SEULE FOIS quand on entre dans le lobby
  useEffect(() => {
    if (cameraRequestedRef.current) return;
    if (screen === "hostLobby" || screen === "playerLobby" || screen === "game") {
      cameraRequestedRef.current = true;
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          console.log("[camera] stream obtenu");
          setLocalStream(stream);
        })
        .catch(e => {
          console.warn("[camera] refusée ou indisponible:", e);
          setLocalStream(null);
        });
    }
  }, [screen]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      console.log("[connect] socket id:", socket.id);
      setMyId(socket.id);
      if (roomCodeRef.current) {
        socket.emit("room:rejoin", { roomCode: roomCodeRef.current });
      }
    });

    socket.on("room:updated",       (state) => { setRoomState(state); });
    socket.on("game:launched",      (state) => { setRoomState(state); setScreen("game"); });
    socket.on("game:playerSelected",(state) => { setRoomState(state); setJudgeData(null); });

    socket.on("game:songChosen", ({ state }) => {
      setRoomState(state);
      if (state?.currentSong?.audioUrl) {
        lastSongUrlRef.current = state.currentSong.audioUrl;
        lastCutAtRef.current   = state.currentSong.cutAt || 0;
      }
    });

    socket.on("game:awaitJudge", (data) => { setJudgeData(data); });

    socket.on("game:turnEnded", ({ state, result }) => {
      console.log("[game:turnEnded] correct:", result?.correct, "points:", result?.points);
      if (state?.currentSong?.id) {
        setUsedSongIds(prev => [...prev, state.currentSong.id]);
      }
      setRoomState(state);
      setRoundResult(result);
      setJudgeData(null);
      setScreen("roundEnd");
    });

    socket.on("game:goNext", (state) => {
      console.log("[game:goNext] status:", state?.status, "code:", state?.code);
      fetchSongs();
      setRoomState(state);
      setRoundResult(null);
      setJudgeData(null);
      setScreen("game");
    });

    socket.on("room:closed", () => {
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

  c

  const props = {
    socket, roomState, setRoomState,
    myId, role, setRole, setScreen,
    songs, roundResult, setRoundResult,
    judgeData, setJudgeData,
    audioRef, lastSongUrlRef, lastCutAtRef,
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