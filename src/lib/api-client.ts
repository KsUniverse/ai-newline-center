import type { ApiResponse } from "@/types/api";

const BASE_URL = "/api";

class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    cache: options?.cache ?? "no-store",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json: ApiResponse<T> = await response.json();

  if (!json.success || !response.ok) {
    throw new ApiError(
      json.error?.code ?? "UNKNOWN_ERROR",
      json.error?.message ?? "请求失败，请稍后重试",
    );
  }

  return json.data as T;
}

export const apiClient = {
  get<T>(path: string, options?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown, options?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown, options?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  del<T>(path: string, options?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};

export { ApiError };
