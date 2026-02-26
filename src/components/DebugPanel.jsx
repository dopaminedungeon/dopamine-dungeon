import React, { useState } from "react";
import { createPortal } from "react-dom";
import { createLink } from "../domain/links/link.service";
import {
  addLink,
  getLinksForEntity,
  clearLinks,
} from "../data/links/links.repo";
import { groupLinksBySection } from "../domain/links/link.sections";

export default function DebugPanel({ context, enabled = true }) {
  if (!enabled) return null;

  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);

  const mode = context?.mode ?? "gm";
  const viewedEntity = {
  type: "Session",
  id: "session-1",
};
const visibilityMode =
  mode.toLowerCase() === "gm" ? "GM" : "Player";
  const scopedLinks = getLinksForEntity(
  viewedEntity.type,
  viewedEntity.id,
  visibilityMode
);

const sections = groupLinksBySection(
  viewedEntity.type,
  scopedLinks
);

  const node = (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 999999,
        width: 520,
        maxWidth: "calc(100vw - 32px)",
        background: "rgba(255, 0, 0, 0.9)",
        color: "white",
        borderRadius: 12,
        padding: 12,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        DEBUG PANEL — MODE: {mode.toUpperCase()}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => {
            const link = createLink({
              entityA: { type: "Session", id: "session-1" },
              entityB: { type: "NPC", id: "npc-1" },
              label: "present",
              visibility: "GM",
            });
            addLink(link);
            refresh();
          }}
        >
          ➕ Add Session ↔ NPC (GM)
        </button>

        <button
          onClick={() => {
            const link = createLink({
              entityA: { type: "Session", id: "session-1" },
              entityB: { type: "NPC", id: "npc-1" },
              label: "present",
              visibility: "Player",
            });
            addLink(link);
            refresh();
          }}
        >
          ➕ Add Session ↔ NPC (Player)
        </button>

        <button
          onClick={() => {
            clearLinks();
            refresh();
          }}
        >
          🧹 Clear links
        </button>
      </div>

      <div>
        <strong>Sections (debug)</strong>

        {Object.entries(sections).length === 0 && (
          <div style={{ opacity: 0.7 }}>No visible links</div>
        )}

        {Object.entries(sections).map(([sectionTitle, links]) => (
          <div key={sectionTitle} style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700 }}>
              {sectionTitle}
            </div>
            <ul>
              {links.map((link) => (
                <li key={link.id}>
                  {link.entityA.type}:{link.entityA.id} ↔{" "}
                  {link.entityB.type}:{link.entityB.id} —{" "}
                  <strong>{link.label}</strong> [{link.visibility}]
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}