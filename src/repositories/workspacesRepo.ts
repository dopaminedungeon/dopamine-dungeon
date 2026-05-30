export const workspacesRepo = {
  async getByUser() {
    const response = await fetch("/api/me");

    if (!response.ok) {
      throw new Error("Failed to load workspaces");
    }

    const data = await response.json();
    return data.workspaces ?? [];
  },
};