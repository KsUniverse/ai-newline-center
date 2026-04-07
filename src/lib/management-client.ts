import { apiClient } from "@/lib/api-client";
import type { PaginatedData } from "@/types/api";
import type {
  AiModelConfigDTO,
  AiSettingsDTO,
  CreateAiModelConfigInput,
  UpdateAiModelConfigInput,
  UpdateAiSettingsInput,
} from "@/types/ai-config";
import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";

type OrganizationStatus = OrganizationDTO["status"];
type UserStatus = UserDTO["status"];

interface UpdateOrganizationPayload {
  name: string;
}

interface UpdateOrganizationStatusPayload {
  status: OrganizationStatus;
}

interface CreateUserPayload {
  account: string;
  password: string;
  name: string;
  role: UserDTO["role"];
  organizationId: string;
}

interface UpdateUserPayload {
  name?: string;
  role?: UserDTO["role"];
}

interface UpdateUserStatusPayload {
  status: UserStatus;
}

interface ListUsersParams {
  page: number;
  limit: number;
  organizationId?: string;
}

interface OrganizationStatusResult {
  org: OrganizationDTO;
  affectedUserCount: number;
}



function buildUserListPath(params: ListUsersParams): string {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });

  if (params.organizationId) {
    searchParams.set("organizationId", params.organizationId);
  }

  return `/users?${searchParams.toString()}`;
}

export const managementClient = {
  listOrganizations(): Promise<OrganizationDTO[]> {
    return apiClient.get<OrganizationDTO[]>("/organizations");
  },

  getOrganization(id: string): Promise<OrganizationDTO> {
    return apiClient.get<OrganizationDTO>(`/organizations/${id}`);
  },

  createOrganization(payload: UpdateOrganizationPayload): Promise<OrganizationDTO> {
    return apiClient.post<OrganizationDTO>("/organizations", payload);
  },

  updateOrganization(id: string, payload: UpdateOrganizationPayload): Promise<OrganizationDTO> {
    return apiClient.put<OrganizationDTO>(`/organizations/${id}`, payload);
  },

  setOrganizationStatus(
    id: string,
    payload: UpdateOrganizationStatusPayload,
  ): Promise<OrganizationStatusResult> {
    return apiClient.patch<OrganizationStatusResult>(`/organizations/${id}/status`, payload);
  },

  listUsers(params: ListUsersParams): Promise<PaginatedData<UserDTO>> {
    return apiClient.get<PaginatedData<UserDTO>>(buildUserListPath(params));
  },

  getUser(id: string): Promise<UserDTO> {
    return apiClient.get<UserDTO>(`/users/${id}`);
  },

  createUser(payload: CreateUserPayload): Promise<UserDTO> {
    return apiClient.post<UserDTO>("/users", payload);
  },

  updateUser(id: string, payload: UpdateUserPayload): Promise<UserDTO> {
    return apiClient.put<UserDTO>(`/users/${id}`, payload);
  },

  setUserStatus(id: string, payload: UpdateUserStatusPayload): Promise<UserDTO> {
    return apiClient.patch<UserDTO>(`/users/${id}/status`, payload);
  },

  getAiConfig(): Promise<AiSettingsDTO> {
    return apiClient.get<AiSettingsDTO>("/system-settings/ai");
  },

  updateAiConfig(payload: UpdateAiSettingsInput): Promise<AiSettingsDTO> {
    return apiClient.put<AiSettingsDTO>("/system-settings/ai", payload);
  },

  listAiModelConfigs(): Promise<AiModelConfigDTO[]> {
    return apiClient.get<AiModelConfigDTO[]>("/system-settings/ai/model-configs");
  },

  createAiModelConfig(payload: CreateAiModelConfigInput): Promise<AiModelConfigDTO> {
    return apiClient.post<AiModelConfigDTO>("/system-settings/ai/model-configs", payload);
  },

  updateAiModelConfig(id: string, payload: UpdateAiModelConfigInput): Promise<AiModelConfigDTO> {
    return apiClient.patch<AiModelConfigDTO>(`/system-settings/ai/model-configs/${id}`, payload);
  },

  deleteAiModelConfig(id: string): Promise<{ deleted: boolean }> {
    return apiClient.del<{ deleted: boolean }>(`/system-settings/ai/model-configs/${id}`);
  },
};
