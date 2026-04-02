export type WorkspaceRole = "owner" | "admin" | "member";

export type Tenant = {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
};

export type TenantMember = {
  id: string;
  tenantId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: number;
  createdBy: string;
};