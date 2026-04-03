import { useState } from "react";
import { invitePlayerToCampaign } from "../../domain/invitations/invitation.service";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useCampaign } from "../../context/CampaignContext";

export default function InvitePlayerForm() {
  const { user } = useAuth();
  const { selectedTenantId, workspaceRole } = useTenant();
  const { selectedCampaignId, campaignRole } = useCampaign();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canInvite = workspaceRole === "owner" && campaignRole === "gm";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.uid) {
      setError("You must be signed in to invite a player.");
      return;
    }

    if (!selectedTenantId) {
      setError("You must select a workspace before inviting a player.");
      return;
    }

    if (!selectedCampaignId) {
      setError("You must select a campaign before inviting a player.");
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Invite email cannot be empty.");
      return;
    }

    if (!canInvite) {
      setError("Only the workspace owner and campaign GM can invite players right now.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const invitation = await invitePlayerToCampaign({
        email: trimmedEmail,
        tenantId: selectedTenantId,
        campaignId: selectedCampaignId,
        invitedBy: user.uid,
      });

      setEmail("");
      setSuccessMessage(`Invitation created for ${invitation.email}.`);
    } catch (err) {
      console.error("[InvitePlayerForm] Failed to create invitation", err);
      setError("Failed to create invitation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          Player email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. player@example.com"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-violet-500"
          disabled={isSubmitting}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
        <p>
          This will create a pending player invitation for the currently selected campaign.
        </p>
        <p className="mt-2 text-zinc-500">
          Email delivery comes next. For now, this creates the invitation record in Dopamine Dungeon.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-400">{successMessage}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || !canInvite}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating invitation..." : "Invite player"}
      </button>

      {!canInvite ? (
        <p className="text-xs text-zinc-500">
          Invites are currently limited to the active workspace owner and campaign GM.
        </p>
      ) : null}
    </form>
  );
}