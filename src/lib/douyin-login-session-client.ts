import { apiClient } from "@/lib/api-client";
import type {
  CreateDouyinLoginSessionInput,
  DouyinLoginSessionDTO,
} from "@/types/douyin-account";

export const douyinLoginSessionClient = {
  createSession(input: CreateDouyinLoginSessionInput): Promise<DouyinLoginSessionDTO> {
    return apiClient.post<DouyinLoginSessionDTO>("/douyin-account-login-sessions", input);
  },

  getSession(id: string): Promise<DouyinLoginSessionDTO> {
    return apiClient.get<DouyinLoginSessionDTO>(`/douyin-account-login-sessions/${id}`);
  },

  refreshSession(id: string): Promise<DouyinLoginSessionDTO> {
    return apiClient.post<DouyinLoginSessionDTO>(`/douyin-account-login-sessions/${id}/refresh`);
  },

  cancelSession(id: string): Promise<DouyinLoginSessionDTO> {
    return apiClient.post<DouyinLoginSessionDTO>(`/douyin-account-login-sessions/${id}/cancel`);
  },

  relogin(accountId: string): Promise<DouyinLoginSessionDTO> {
    return apiClient.post<DouyinLoginSessionDTO>(`/douyin-accounts/${accountId}/relogin`);
  },
};