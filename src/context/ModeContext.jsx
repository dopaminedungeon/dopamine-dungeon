// src/context/ModeContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const ModeContext = createContext();

/**
 * "mode" can be:
 * - "gm"     → full control, spoilers allowed
 * - "player" → restricted, no spoilers, no editing
 */
export function ModeProvider({ children }) {
  const [mode, setMode] = useState("gm");

  // remember last chosen mode in localStorage
  useEffect(() => {
    const saved = window.localStorage.getItem("dd-mode");
    if (saved === "gm" || saved === "player") {
      setMode(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dd-mode", mode);
  }, [mode]);

  const value = {
    mode,
    isGM: mode === "gm",
    isPlayer: mode === "player",
    setMode,
  };

  return (
    <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error("useMode must be used inside ModeProvider");
  }
  return ctx;
}