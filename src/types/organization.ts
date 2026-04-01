export interface OrganizationDTO {
  id: string;
  name: string;
  type: "GROUP" | "BRANCH";
  status: "ACTIVE" | "DISABLED";
  parentId: string | null;
  createdAt: string;
  _count?: { users: number };
}
