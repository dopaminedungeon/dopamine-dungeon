import { useEffect, useMemo, useState } from "react";
import {
  ApiRequestError,
  getApiInvitations,
  resendApiInvitation,
  revokeApiInvitation,
} from "../../data/api/apiClient";

function formatTimestamp(value) {
  if (!value) return "—";
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? "—"
    : timestamp.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status) {
  if (status === "accepted") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "pending") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
}

export default function InvitationManagementList({
  tenantId,
  campaignId,
  availabilityVersion = 0,
  onInvitationChanged,
}) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionId, setActionId] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!tenantId || !campaignId) {
      setInvitations([]);
      return undefined;
    }

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await getApiInvitations(tenantId, campaignId);
        if (!cancelled) setInvitations(response.invitations || []);
      } catch {
        if (!cancelled) {
          setInvitations([]);
          setError("Could not load invitations for this campaign.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, campaignId, availabilityVersion]);

  const pendingFirst = useMemo(
    () => [...invitations].sort((left, right) => {
      const leftPending = left.status === "pending" ? 0 : 1;
      const rightPending = right.status === "pending" ? 0 : 1;
      if (leftPending !== rightPending) return leftPending - rightPending;
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    }),
    [invitations]
  );

  async function runAction(invitation, action) {
    if (actionId) return;
    const label = action === "resend" ? "resend" : "revoke";

    try {
      setActionId(`${label}-${invitation.id}`);
      setError("");
      setNotice("");
      const response = action === "resend"
        ? await resendApiInvitation({ tenantId, campaignId, invitationId: invitation.id })
        : await revokeApiInvitation({ tenantId, campaignId, invitationId: invitation.id });
      setInvitations((current) =>
        current.map((entry) => (entry.id === response.invitation.id ? response.invitation : entry))
      );
      setNotice(action === "resend" ? "Invitation resent." : "Invitation revoked.");
      await onInvitationChanged?.();
    } catch (actionError) {
      if (actionError instanceof ApiRequestError && actionError.retryAfterSeconds) {
        setError(`Please wait ${actionError.retryAfterSeconds}s before resending this invitation.`);
      } else {
        setError(action === "resend" ? "Could not resend this invitation." : "Could not revoke this invitation.");
      }
    } finally {
      setActionId("");
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]" aria-labelledby="invitation-management-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="invitation-management-title" className="text-sm font-medium text-zinc-100">Invitations</h3>
          <p className="mt-1 text-xs text-zinc-400">Pending invitations appear first. Accepted, expired, and revoked invitations remain as a compact record.</p>
        </div>
        <span className="text-xs text-zinc-400">{loading ? "Loading…" : `${pendingFirst.length} total`}</span>
      </div>

      {error ? <p role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {notice ? <p role="status" className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{notice}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading invitations…</p>
      ) : pendingFirst.length === 0 ? (
        <p className="text-sm text-zinc-400">No invitations for this campaign yet.</p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {pendingFirst.map((invitation) => {
            const isPending = invitation.status === "pending";
            const isResending = actionId === `resend-${invitation.id}`;
            const isRevoking = actionId === `revoke-${invitation.id}`;
            return (
              <li key={invitation.id} className="rounded-xl border border-white/10 bg-zinc-950/35 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-zinc-100">{invitation.email}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {invitation.campaignRole} · sent {formatTimestamp(invitation.lastSentAt || invitation.createdAt)}
                      {invitation.expiresAt && invitation.status === "pending" ? ` · expires ${formatTimestamp(invitation.expiresAt)}` : ""}
                    </p>
                    {invitation.characterIds?.length ? (
                      <p className="mt-1 text-xs text-cyan-200/90">{invitation.characterIds.length} character{invitation.characterIds.length === 1 ? "" : "s"} reserved</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(invitation.status)}`}>{invitation.status}</span>
                    {isPending ? (
                      <>
                        <button type="button" disabled={Boolean(actionId)} onClick={() => runAction(invitation, "resend")} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50">
                          {isResending ? "Resending…" : "Resend"}
                        </button>
                        <button type="button" disabled={Boolean(actionId)} onClick={() => runAction(invitation, "revoke")} className="rounded-lg border border-red-400/20 bg-red-400/10 px-2.5 py-1.5 text-xs text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50">
                          {isRevoking ? "Revoking…" : "Revoke"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
