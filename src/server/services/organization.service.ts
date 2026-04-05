import type { Organization } from "@prisma/client";
import { OrganizationStatus, OrganizationType, UserRole, UserStatus } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { BranchWithUserCount, OrganizationWithUserCount } from "@/server/repositories/organization.repository";
import { organizationRepository } from "@/server/repositories/organization.repository";
import type { SessionUser } from "@/types/session";

class OrganizationService {
  async listBranches(): Promise<BranchWithUserCount[]> {
    return organizationRepository.findAllBranches();
  }

  async getBranchById(id: string): Promise<OrganizationWithUserCount> {
    const organization = await organizationRepository.findById(id);

    if (!organization) {
      throw new AppError("NOT_FOUND", "组织不存在", 404);
    }

    if (organization.type === OrganizationType.GROUP) {
      throw new AppError("FORBIDDEN", "集团组织不允许操作", 403);
    }

    return organization;
  }

  async getBranchByIdForCaller(caller: SessionUser, id: string): Promise<OrganizationWithUserCount> {
    if (caller.role === UserRole.BRANCH_MANAGER && caller.organizationId !== id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    return this.getBranchById(id);
  }

  async createBranch(name: string): Promise<Organization> {
    const duplicated = await organizationRepository.findByName(name);
    if (duplicated) {
      throw new AppError("CONFLICT", "分公司名称已存在", 409);
    }

    const group = await organizationRepository.findGroupOrg();
    if (!group) {
      throw new AppError("NOT_FOUND", "集团组织不存在", 404);
    }

    return organizationRepository.create({
      name,
      parentId: group.id,
    });
  }

  async updateBranch(id: string, name: string): Promise<Organization> {
    const organization = await this.getBranchById(id);
    const duplicated = await organizationRepository.findByName(name, organization.id);

    if (duplicated) {
      throw new AppError("CONFLICT", "分公司名称已存在", 409);
    }

    return organizationRepository.update(id, { name });
  }

  async setStatus(id: string, status: OrganizationStatus): Promise<{ org: Organization; affectedUserCount: number }> {
    const organization = await this.getBranchById(id);

    if (status === OrganizationStatus.ACTIVE) {
      const org = await organizationRepository.update(organization.id, { status });
      return { org, affectedUserCount: 0 };
    }

    return prisma.$transaction(async (tx) => {
      const affectedUserCount = await organizationRepository.countActiveUsers(
        organization.id,
        UserStatus.ACTIVE,
        tx,
      );

      await organizationRepository.updateUsersStatusByOrganization(
        organization.id,
        UserStatus.ACTIVE,
        UserStatus.DISABLED,
        tx,
      );

      const org = await organizationRepository.update(
        organization.id,
        { status: OrganizationStatus.DISABLED },
        tx,
      );

      return { org, affectedUserCount };
    });
  }
}

export const organizationService = new OrganizationService();
