import type { OrganizationDTO } from "@/types/organization";

export const mockOrganizations: OrganizationDTO[] = [
  {
    id: "org_branch_001",
    name: "上海分公司",
    type: "BRANCH",
    status: "ACTIVE",
    parentId: "seed_default_group",
    createdAt: "2026-01-10T08:00:00.000Z",
    _count: { users: 12 },
  },
  {
    id: "org_branch_002",
    name: "北京分公司",
    type: "BRANCH",
    status: "ACTIVE",
    parentId: "seed_default_group",
    createdAt: "2026-01-15T08:00:00.000Z",
    _count: { users: 8 },
  },
  {
    id: "org_branch_003",
    name: "广州分公司",
    type: "BRANCH",
    status: "DISABLED",
    parentId: "seed_default_group",
    createdAt: "2026-02-01T08:00:00.000Z",
    _count: { users: 5 },
  },
  {
    id: "org_branch_004",
    name: "深圳分公司",
    type: "BRANCH",
    status: "ACTIVE",
    parentId: "seed_default_group",
    createdAt: "2026-02-20T08:00:00.000Z",
    _count: { users: 3 },
  },
  {
    id: "org_branch_005",
    name: "成都分公司",
    type: "BRANCH",
    status: "ACTIVE",
    parentId: "seed_default_group",
    createdAt: "2026-03-05T08:00:00.000Z",
    _count: { users: 0 },
  },
];
