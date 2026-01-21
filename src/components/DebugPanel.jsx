import React from "react";
import { createPortal } from "react-dom";

export default function DebugPanel({ context, enabled = true }) {
  if (!enabled) return null;

  // TEMP: disable dev-guard completely so we can see it no matter what.
  const node = (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 999999,
        width: 520,
        maxWidth: "calc(100vw - 32px)",
        background: "rgba(255, 0, 0, 0.85)", // bright on purpose
        color: "white",
        borderRadius: 12,
        padding: 12,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        fontSize: 12,
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ fontWeight: 800 }}>DEBUG PANEL IS RENDERING ✅</div>
      <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(context ?? null, null, 2)}
      </pre>
    </div>
  );

  return createPortal(node, document.body);
}