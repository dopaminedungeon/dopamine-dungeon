import { useEffect, useState } from "react";
import { getAllCharacters } from "../../data/characters/characters.repo";
import { createApiInvitation, getApiCharacterAssignments } from "../../data/api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useCampaign } from "../../context/CampaignContext";

export default function InvitePlayerForm({ onInvitationCreated, availabilityVersion = 0 }) {
  const { user } = useAuth();
  const { selectedTenantId, workspaceRole } = useTenant();
  const { selectedCampaignId, campaignRole } = useCampaign();

  const [email, setEmail] = useState("");
  const [selectedCampaignRole, setSelectedCampaignRole] = useState("player");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState([]);
  const [charactersVersion, setCharactersVersion] = useState(0);

  const canInvite = workspaceRole === "owner" && campaignRole === "gm";

  useEffect(() => {
    if (!selectedCampaignId) return;

    const loadCharacters = async () => {
      try {
        const [characters, assignmentData] = await Promise.all([
          getAllCharacters(selectedCampaignId),
          getApiCharacterAssignments(selectedCampaignId),
        ]);
        const blockedCharacterIds = new Set([
          ...(assignmentData.assignedCharacterIds || []),
          ...(assignmentData.pendingAssignedCharacterIds || []),
        ]);
        setAvailableCharacters(
          (characters || []).filter((character) => !blockedCharacterIds.has(character.id))
        );
      } catch (err) {
        console.error("[InvitePlayerForm] Failed to load characters", err);
      }
    };

    loadCharacters();
  }, [selectedCampaignId, charactersVersion, availabilityVersion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

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
      const { invitation } = await createApiInvitation({
        email: trimmedEmail,
        tenantId: selectedTenantId,
        campaignId: selectedCampaignId,
        campaignRole: selectedCampaignRole,
        characterIds: selectedCharacterIds,
      });

      setEmail("");
      setSelectedCampaignRole("player");
      setSelectedCharacterIds([]);
      setCharactersVersion((value) => value + 1);
      setSuccessMessage(
        `Invitation created for ${invitation.email}.`
      );
      if (typeof onInvitationCreated === "function") {
        await onInvitationCreated();
      }
    } catch (err) {
      console.error("[InvitePlayerForm] Failed to create invitation", err);
      setError("Failed to create invitation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Player email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. player@example.com"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-zinc-100 outline-none shadow-inner shadow-black/10 placeholder:text-zinc-400 focus:border-fuchsia-400/30 focus:ring-2 focus:ring-fuchsia-400/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200">
            Campaign role
          </label>
          <select
            value={selectedCampaignRole}
            onChange={(e) => setSelectedCampaignRole(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-zinc-100 outline-none shadow-inner shadow-black/10 focus:border-fuchsia-400/30 focus:ring-2 focus:ring-fuchsia-400/20"
          >
            <option value="player">player</option>
            <option value="gm">gm</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          Assign characters (optional)
        </label>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          {availableCharacters.length === 0 ? (
            <p className="text-xs text-zinc-400">
              No characters available in this campaign yet.
            </p>
          ) : (
            availableCharacters.map((character) => {
              const isSelected = selectedCharacterIds.includes(character.id);

              return (
	                <button
	                  key={character.id}
	                  type="button"
                    disabled={isSubmitting}
	                  onClick={() => {
                    setSelectedCharacterIds((prev) =>
                      isSelected
                        ? prev.filter((id) => id !== character.id)
                        : [...prev, character.id]
                    );
                  }}
	                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${isSelected
                      ? "bg-violet-500/20 border border-violet-400/30 text-violet-100"
                      : "bg-white/[0.02] border border-white/10 text-zinc-300 hover:bg-white/[0.05]"
                    }`}
                >
                  <span>{character.name || character.id}</span>
                  {isSelected && <span className="text-xs">✓</span>}
                </button>
              );
            })
          )}
        </div>

        <p className="mt-2 text-xs text-zinc-400">
          You can assign multiple characters now or do it later in campaign management.
        </p>

        {selectedCharacterIds.length > 0 && (
          <p className="mt-1 text-xs text-cyan-300/90">
            {selectedCharacterIds.length} character{selectedCharacterIds.length === 1 ? "" : "s"} selected.
          </p>
        )}
	      </div>
      </fieldset>

	      <div className="rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-zinc-300 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
        <p>
          This will create a pending campaign invitation for the currently selected workspace and campaign.
        </p>
        <p className="mt-2 text-zinc-400">
          The selected campaign role and character assignments will be attached to the invitation now.
        </p>
      </div>

      {error ? (
        <p className="inline-flex items-center rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isSubmitting || !canInvite}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating invitation..." : "Invite player"}
        </button>

        {!canInvite ? (
          <p className="text-xs text-zinc-500">
            Invites are currently limited to the active workspace owner and campaign GM.
          </p>
        ) : null}
      </div>
    </form>
  );
}
