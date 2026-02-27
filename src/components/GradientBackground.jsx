import React, { useEffect, useMemo, useState } from "react";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);

    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);

    // Safari compatibility
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function BackgroundLayers({ enableEffects }) {
  return (
    // fixed background = cheaper during scroll
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Base gradient layer (always on) */}
      <div className="absolute inset-0 bg-linear-to-b from-[#09090b] via-[#151521] to-[#0c0c12]" />

      {/* Accent gradients */}
      {enableEffects ? (
        // Desktop: animated blobs
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-600/5 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "2s" }}
          />
        </div>
      ) : (
        // Mobile / reduced motion: static + lighter (still pretty, cheaper)
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-8 left-10 w-72 h-72 bg-purple-600/8 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-blue-600/6 rounded-full blur-3xl" />
        </div>
      )}

      {/* Grid overlay (desktop only) */}
      {enableEffects && (
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      )}
    </div>
  );
}

export default function GradientBackground({ children }) {
  // Disable heavy effects on:
  // - mobile widths (below md)
  // - prefers-reduced-motion
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isMobile = useMediaQuery("(max-width: 767px)");

  const enableEffects = useMemo(() => {
    return !prefersReducedMotion && !isMobile;
  }, [prefersReducedMotion, isMobile]);

  // If used like <GradientBackground />, render ONLY background layers.
  if (children === undefined) return <BackgroundLayers enableEffects={enableEffects} />;

  // If used like <GradientBackground>...</GradientBackground>, wrap content.
  return (
    <div className="relative min-h-screen w-full">
      <BackgroundLayers enableEffects={enableEffects} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}