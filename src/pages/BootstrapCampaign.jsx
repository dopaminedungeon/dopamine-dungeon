import Card from "../components/Card";
import CreateCampaignForm from "../components/bootstrap/CreateCampaignForm";
import BootstrapSignOutControl from "../components/bootstrap/BootstrapSignOutControl";
import BootstrapWorkspaceSwitcher from "../components/bootstrap/BootstrapWorkspaceSwitcher";

export default function BootstrapCampaign({ onLogout }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Card>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-white">Create your first campaign</h1>
          <p className="text-sm text-zinc-300">
            Your campaign is where sessions, characters, inventory, and story state come together.
          </p>
        </div>
      </Card>

      <BootstrapWorkspaceSwitcher />

      <Card>
        <CreateCampaignForm />
      </Card>

      <BootstrapSignOutControl onLogout={onLogout} />
    </div>
  );
}
