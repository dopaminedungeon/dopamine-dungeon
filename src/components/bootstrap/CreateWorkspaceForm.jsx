import { useState } from "react";
import { createWorkspaceWithOwner } from "../../domain/bootstrap/workspaceBootstrap.service";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";

export default function CreateWorkspaceForm() {
  const { user } = useAuth();
  const { refreshTenants, selectTenant } = useTenant();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.uid) {
      setError("You must be signed in to create a workspace.");
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Workspace name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const { tenant } = await createWorkspaceWithOwner({
        name: trimmedName,
        userId: user.uid,
      });

      await refreshTenants();
      selectTenant(tenant.id);
      setName("");
    } catch (err) {
      console.error("[CreateWorkspaceForm] Failed to create workspace", err);
      setError("Failed to create workspace. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          Workspace name
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

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating workspace..." : "Create workspace"}
      </button>
    </form>
  );
}