import { describe, expect, it, vi } from "vitest";

import {
  BOOTSTRAP_SIGN_OUT_ERROR_MESSAGE,
  createBootstrapSignOutRunner,
} from "./bootstrapSignOut";

describe("bootstrap sign out", () => {
  it("shares one active logout attempt across rapid activations", async () => {
    let resolveLogout;
    const logout = vi.fn(
      () => new Promise((resolve) => {
        resolveLogout = resolve;
      })
    );
    const onStart = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    const runBootstrapSignOut = createBootstrapSignOutRunner();

    const firstAttempt = runBootstrapSignOut({
      logout,
      onStart,
      onError,
      onSettled,
    });
    const duplicateAttempt = runBootstrapSignOut({
      logout,
      onStart,
      onError,
      onSettled,
    });

    expect(duplicateAttempt).toBe(firstAttempt);
    expect(logout).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    expect(logout).toHaveBeenCalledTimes(1);

    resolveLogout();
    await firstAttempt;

    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("reports a generic error and permits a retry after logout rejects", async () => {
    const firebaseError = new Error("sensitive Firebase detail");
    const logout = vi
      .fn()
      .mockRejectedValueOnce(firebaseError)
      .mockResolvedValueOnce(undefined);
    const onStart = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();
    const runBootstrapSignOut = createBootstrapSignOutRunner();

    await runBootstrapSignOut({ logout, onStart, onError, onSettled });

    expect(onError).toHaveBeenCalledWith(BOOTSTRAP_SIGN_OUT_ERROR_MESSAGE);
    expect(onError).not.toHaveBeenCalledWith(firebaseError);
    expect(onSettled).toHaveBeenCalledTimes(1);

    await runBootstrapSignOut({ logout, onStart, onError, onSettled });

    expect(logout).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onSettled).toHaveBeenCalledTimes(2);
  });
});
