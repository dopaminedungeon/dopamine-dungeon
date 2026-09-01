import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { useCampaign } from "../../context/CampaignContext";
import { useTenant } from "../../context/TenantContext";

// Campaign access refreshes can briefly remount this onboarding screen while a
// workspace switch is resolved. Keep only the local, unsubmitted draft in memory
// so the user can see the changed context without losing their work.
const campaignDraftsByUserId = new Map();

export default function CreateCampaignForm() {
  const { user } = useAuth();
  const { createCampaign } = useCampaign();
  const { selectedTenantId, tenantStatus, tenants } = useTenant();
  const restoredDraft = user?.uid ? campaignDraftsByUserId.get(user.uid) : null;
  const [name, setName] = useState(() => restoredDraft?.name ?? "");
  const [description, setDescription] = useState(() => restoredDraft?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [systemError, setSystemError] = useState("");
  const initialTenantIdRef = useRef(restoredDraft?.initialTenantId ?? selectedTenantId ?? null);
  const idempotencyKeyRef = useRef(null);
  const inputRef = useRef(null);
  const systemErrorRef = useRef(null);
  const submissionInFlightRef = useRef(false);
  const validationErrorId = useId();
  const systemErrorId = useId();
  const workspaceNoticeId = useId();

  const selectedWorkspace = useMemo(
    () =>
      (tenants ?? []).find((workspace) => workspace?.tenantId === selectedTenantId) ?? null,
    [selectedTenantId, tenants]
  );
  const hasValidWorkspace = tenantStatus === "ready" && Boolean(selectedWorkspace);
  const workspaceChanged = Boolean(
    initialTenantIdRef.current &&
      selectedTenantId &&
      initialTenantIdRef.current !== selectedTenantId
  );

  useEffect(() => {
    if (validationError) inputRef.current?.focus();
  }, [validationError]);

  useEffect(() => {
    if (systemError) systemErrorRef.current?.focus();
  }, [systemError]);

  useEffect(() => {
    if (!user?.uid) return;

    campaignDraftsByUserId.set(user.uid, {
      name,
      description,
      initialTenantId: initialTenantIdRef.current,
    });
  }, [description, name, user?.uid]);

  const handleNameChange = (event) => {
    const nextName = event.target.value;
    setName(nextName);

    if (nextName.trim()) {
      setValidationError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submissionInFlightRef.current || !hasValidWorkspace) return;

    const submittedName = name.trim();
    const submittedDescription = String(description ?? "").trim();

    if (!submittedName) {
      setSystemError("");
      setValidationError("Enter a campaign name.");
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setValidationError("");
    setSystemError("");

    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      await createCampaign({
        name: submittedName,
        description: submittedDescription,
        idempotencyKey: idempotencyKeyRef.current,
      });

      idempotencyKeyRef.current = null;
      campaignDraftsByUserId.delete(user?.uid);
    } catch {
      setSystemError(
        "We couldn't create your campaign. Your details are still here. Try again."
      );
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
      {!hasValidWorkspace ? (
        <div
          id={workspaceNoticeId}
          role="status"
          className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-4 py-3 text-sm leading-6 text-amber-100"
        >
          Your workspace changed. This campaign hasn&apos;t been created. Choose an available workspace to continue.
        </div>
      ) : workspaceChanged ? (
        <div
          id={workspaceNoticeId}
          role="status"
          className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-4 py-3 text-sm leading-6 text-amber-100"
        >
          Workspace changed. You&apos;re now creating this campaign in {selectedWorkspace.name}.
        </div>
      ) : null}

      <fieldset disabled={isSubmitting} className="space-y-5 disabled:opacity-60">
        <div>
          <label htmlFor="campaign-name" className="mb-2 block text-sm font-medium text-zinc-200">
            Campaign name <span className="text-violet-300" aria-hidden="true">*</span>
            <span className="sr-only"> required</span>
          </label>
          <input
            ref={inputRef}
            id="campaign-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. The Lantern Accord"
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

        <div>
          <label htmlFor="campaign-description" className="mb-2 block text-sm font-medium text-zinc-200">
            Description <span className="text-zinc-500">(optional)</span>
          </label>
          <textarea
            id="campaign-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short description of your campaign"
            className="min-h-30 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 focus:border-violet-500"
          />
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
        disabled={isSubmitting || !hasValidWorkspace}
        aria-describedby={systemError ? systemErrorId : undefined}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating campaign…" : "Create campaign"}
      </button>
    </form>
  );
}
