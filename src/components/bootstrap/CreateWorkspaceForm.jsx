import { useRef, useState } from "react";
import { useTenant } from "../../context/TenantContext";

export default function CreateWorkspaceForm() {
  const { createTenant } = useTenant();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Workspace name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      await createTenant({
        name: trimmedName,
        idempotencyKey: idempotencyKeyRef.current,
      });

      idempotencyKeyRef.current = null;
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
      <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-60">
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
        />
      </div>
      </fieldset>

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
