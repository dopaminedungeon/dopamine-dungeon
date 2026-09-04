import { useId, useRef, useState } from "react";

import { createBootstrapSignOutRunner } from "../../auth/bootstrapSignOut";

export default function BootstrapSignOutControl({ onLogout }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  const runBootstrapSignOutRef = useRef(null);

  if (runBootstrapSignOutRef.current == null) {
    runBootstrapSignOutRef.current = createBootstrapSignOutRunner();
  }

  const handleSignOut = () => {
    void runBootstrapSignOutRef.current({
      logout: onLogout,
      onStart: () => {
        setError("");
        setIsSigningOut(true);
      },
      onError: setError,
      onSettled: () => setIsSigningOut(false),
    });
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <p className="text-sm font-medium text-zinc-200">Need to use another account?</p>
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-300">
            {error}
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">You can safely return to sign in.</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-describedby={error ? errorId : undefined}
        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
