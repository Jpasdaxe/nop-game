import { useEffect, useState, useRef } from "react";

export default function LyricsDisplay({ audioRef, lyrics, cutAt }) {
  const [currentLine, setCurrentLine] = useState("");
  const [prevLine, setPrevLine]       = useState("");
  const rafRef = useRef(null);

  useEffect(() => {
    if (!lyrics || lyrics.length === 0) return;

    // Trie par timestamp au cas où
    const sorted = [...lyrics].sort((a, b) => a.t - b.t);

    const tick = () => {
      const audio = audioRef?.current;
      if (!audio) { rafRef.current = requestAnimationFrame(tick); return; }

      const ct = audio.currentTime;

      // Trouve la ligne active
      let active = null;
      let prev   = null;
      for (let i = 0; i < sorted.length; i++) {
        if (ct >= sorted[i].t) {
          if (active) prev = active;
          active = sorted[i];
        }
      }

      setCurrentLine(active?.text || "");
      setPrevLine(prev?.text || "");

      // Arrête quand on dépasse le cutAt
      if (ct < cutAt) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lyrics, cutAt]);

  if (!lyrics || lyrics.length === 0) return null;

  return (
    <div style={{
      textAlign: "center",
      padding: "16px 24px",
      minHeight: 80,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}>
      {/* Ligne précédente — estompée */}
      {prevLine && (
        <div style={{
          fontSize: "1rem",
          color: "var(--text-dim)",
          fontWeight: 600,
          transition: "opacity .3s",
          opacity: .5,
        }}>
          {prevLine}
        </div>
      )}
      {/* Ligne active — mise en valeur */}
      {currentLine && (
        <div style={{
          fontSize: "1.4rem",
          fontWeight: 800,
          color: "var(--text)",
          textShadow: "0 0 20px rgba(245,200,66,.3)",
          animation: "popIn .2s ease",
          transition: "all .15s",
        }}>
          {currentLine}
        </div>
      )}
      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}