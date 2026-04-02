import Card from "../components/Card";
import CreateWorkspaceForm from "../components/bootstrap/CreateWorkspaceForm";

export default function BootstrapWorkspace() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Card>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-white">Create your workspace</h1>
          <p className="text-sm text-zinc-300">
            Your workspace is the home for your campaigns, members, and shared game data.
          </p>
        </div>
      </Card>

      <Card>
        <CreateWorkspaceForm />
      </Card>
    </div>
  );
}