import type { OrganizationDTO } from "@/types/organization";

export interface UserDTO {
  id: string;
  account: string;
  name: string;
  role: "SUPER_ADMIN" | "BRANCH_MANAGER" | "EMPLOYEE";
  status: "ACTIVE" | "DISABLED";
  organizationId: string;
  organization: Pick<OrganizationDTO, "id" | "name">;
  createdAt: string;
}
