import { useState } from "react";
import { createCampaignWithGm } from "../../domain/bootstrap/workspaceBootstrap.service";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { useCampaign } from "../../context/CampaignContext";

export default function CreateCampaignForm() {
  const { user } = useAuth();
  const { selectedTenantId } = useTenant();
  const { refreshCampaigns, selectCampaign } = useCampaign();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("D&D 5.5e");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.uid) {
      setError("You must be signed in to create a campaign.");
      return;
    }

    if (!selectedTenantId) {
      setError("You must select a workspace before creating a campaign.");
      return;
    }

    const trimmedName = name.trim();
    const normalizedDescription = String(description ?? "").trim();
    const normalizedSystem = String(system ?? "").trim();

    if (!trimmedName) {
      setError("Campaign name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { campaign } = await createCampaignWithGm({
        tenantId: selectedTenantId,
        name: trimmedName,
        userId: user.uid,
        description: normalizedDescription,
        system: normalizedSystem,
      });

      await refreshCampaigns();
      selectCampaign(campaign.id);
      setName("");
      setDescription("");
      setSystem("D&D 5.5e");
    } catch (err) {
      console.error("[CreateCampaignForm] Failed to create campaign", err);
      setError("Failed to create campaign. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          Campaign name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chronicles of Varionath"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-violet-500"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          Description <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of your campaign"
          className="min-h-30 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-violet-500"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          System <span className="text-zinc-500">(optional)</span>
        </label>
        <input
          type="text"
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          placeholder="e.g. D&D 5.5e"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-violet-500"
          disabled={isSubmitting}
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating campaign..." : "Create campaign"}
      </button>
    </form>
  );
}