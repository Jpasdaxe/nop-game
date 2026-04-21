import { useEffect, useState, useRef } from "react";

export default function LyricsDisplay({ audioRef, lyrics, cutAt }) {
  const [prevLine, setPrevLine]   = useState("");
  const [curLine, setCurLine]     = useState("");
  const [nextLine, setNextLine]   = useState("");
  const rafRef = useRef(null);

  useEffect(() => {
    if (!lyrics || lyrics.length === 0) return;
    const sorted = [...lyrics].sort((a, b) => a.t - b.t);

    const tick = () => {
      const audio = audioRef?.current;
      if (!audio) { rafRef.current = requestAnimationFrame(tick); return; }
      const ct = audio.currentTime;

      let activeIdx = -1;
      for (let i = 0; i < sorted.length; i++) {
        if (ct >= sorted[i].t) activeIdx = i;
      }

      setPrevLine(activeIdx > 0 ? sorted[activeIdx - 1].text : "");
      setCurLine(activeIdx >= 0 ? sorted[activeIdx].text : "");
      setNextLine(activeIdx < sorted.length - 1 ? sorted[activeIdx + 1].text : "");

      if (ct < cutAt) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lyrics, cutAt]);

  if (!lyrics || lyrics.length === 0) return null;

  return (
    <div style={{ textAlign:"center", padding:"12px 0", display:"flex",
      flexDirection:"column", gap:6, alignItems:"center" }}>
      {prevLine && (
        <div style={{ fontSize:".9rem", color:"var(--text-dim)", opacity:.4, fontWeight:600 }}>
          {prevLine}
        </div>
      )}
      {curLine && (
        <div style={{ fontSize:"1.3rem", fontWeight:800, color:"var(--text)",
          textShadow:"0 0 20px rgba(245,200,66,.3)", animation:"popIn .2s ease" }}>
          {curLine}
        </div>
      )}
      {nextLine && (
        <div style={{ fontSize:".9rem", color:"var(--text-dim)", opacity:.4, fontWeight:600 }}>
          {nextLine}
        </div>
      )}
      <style>{`@keyframes popIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}