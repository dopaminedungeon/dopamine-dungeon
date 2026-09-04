import { useEffect, useId, useRef, useState } from "react";

import { useTenant } from "../../context/TenantContext";

export default function CreateWorkspaceForm() {
  const { createTenant, tenantStatus } = useTenant();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [systemError, setSystemError] = useState("");
  const idempotencyKeyRef = useRef(null);
  const inputRef = useRef(null);
  const systemErrorRef = useRef(null);
  const submissionInFlightRef = useRef(false);
  const validationErrorId = useId();
  const systemErrorId = useId();

  useEffect(() => {
    if (validationError) inputRef.current?.focus();
  }, [validationError]);

  useEffect(() => {
    if (systemError) systemErrorRef.current?.focus();
  }, [systemError]);

  const handleNameChange = (event) => {
    const nextName = event.target.value;
    setName(nextName);

    if (nextName.trim()) {
      setValidationError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submissionInFlightRef.current || tenantStatus !== "empty") return;

    const submittedName = name.trim();

    if (!submittedName) {
      setSystemError("");
      setValidationError("Enter a workspace name.");
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setValidationError("");
    setSystemError("");

    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      await createTenant({
        name: submittedName,
        idempotencyKey: idempotencyKeyRef.current,
      });

      idempotencyKeyRef.current = null;
    } catch {
      setSystemError(
        "We couldn't create your workspace. Your details are still here. Try again."
      );
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
      <fieldset disabled={isSubmitting} className="space-y-5 disabled:opacity-60">
        <div>
          <label htmlFor="workspace-name" className="mb-2 block text-sm font-medium text-zinc-200">
            Workspace name <span className="text-violet-300" aria-hidden="true">*</span>
            <span className="sr-only"> required</span>
          </label>
          <input
            ref={inputRef}
            id="workspace-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Adventurers Guild"
            required
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? validationErrorId : undefined}
            className={`min-h-12 w-full rounded-xl border bg-zinc-800 px-4 py-3 text-zinc-100 outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
              validationError
                ? "border-red-400 focus:border-red-400"
                : "border-zinc-700 focus:border-violet-500"
            }`}
          />
          {validationError ? (
            <p id={validationErrorId} role="alert" className="mt-2 text-sm text-red-300">
              {validationError}
            </p>
          ) : null}
        </div>
      </fieldset>

      {systemError ? (
        <div
          ref={systemErrorRef}
          id={systemErrorId}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm leading-6 text-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
        >
          {systemError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-describedby={systemError ? systemErrorId : undefined}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
