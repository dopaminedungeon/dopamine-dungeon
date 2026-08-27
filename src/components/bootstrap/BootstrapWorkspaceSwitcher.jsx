import { useCampaign } from "../../context/CampaignContext";
import { useTenant } from "../../context/TenantContext";

export default function BootstrapWorkspaceSwitcher() {
  const { tenants, selectedTenantId, selectTenant } = useTenant();
  const { selectCampaign } = useCampaign();
  const workspaces = (tenants ?? []).filter((workspace) => workspace?.tenantId);

  if (workspaces.length <= 1) {
    return null;
  }

  const currentWorkspace =
    workspaces.find((workspace) => workspace.tenantId === selectedTenantId) ?? null;

  const handleWorkspaceChange = (event) => {
    const nextTenantId = event.target.value || null;
    selectTenant(nextTenantId);
    selectCampaign(null);
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <label
        htmlFor="bootstrap-workspace-switcher"
        className="block text-sm font-medium text-zinc-200"
      >
        Workspace
      </label>
      <p className="mt-1 text-sm text-zinc-400">
        Current workspace: {currentWorkspace?.name ?? "Select a workspace"}
      </p>
      <select
        id="bootstrap-workspace-switcher"
        value={selectedTenantId ?? ""}
        onChange={handleWorkspaceChange}
        className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.tenantId} value={workspace.tenantId}>
            {workspace.name ?? "Unnamed workspace"}
          </option>
        ))}
      </select>
    </div>
  );
}
