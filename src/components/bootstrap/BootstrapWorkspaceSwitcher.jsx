import { useCampaign } from "../../context/CampaignContext";
import { useTenant } from "../../context/TenantContext";

export default function BootstrapWorkspaceSwitcher() {
  const { tenants, selectedTenantId, selectTenant } = useTenant();
  const { selectCampaign } = useCampaign();
  const workspaces = (tenants ?? []).filter((workspace) => workspace?.tenantId);

  const handleWorkspaceChange = (event) => {
    const nextTenantId = event.target.value || null;
    selectTenant(nextTenantId);
    selectCampaign(null);
  };

  return (
    <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <label
        htmlFor="bootstrap-workspace-switcher"
        className="text-sm font-medium text-zinc-200"
      >
        Current Workspace:
      </label>
      <select
        id="bootstrap-workspace-switcher"
        value={selectedTenantId ?? ""}
        onChange={handleWorkspaceChange}
        className="min-h-11 max-w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 sm:min-w-60"
      >
        {workspaces.length ? (
          workspaces.map((workspace) => (
            <option key={workspace.tenantId} value={workspace.tenantId}>
              {workspace.name ?? "Unnamed workspace"}
            </option>
          ))
        ) : (
          <option value="">No accessible workspace</option>
        )}
      </select>
    </div>
  );
}
