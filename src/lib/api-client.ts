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

interface StreamEvent {
  event: string;
  data: unknown;
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

  async stream(
    path: string,
    options: Omit<RequestInit, "body"> & { body?: unknown },
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      cache: options.cache ?? "no-store",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        const text = await response.text();
        const dataLine = text
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (dataLine) {
          try {
            const payload = JSON.parse(dataLine.slice(5).trim()) as {
              code?: string;
              message?: string;
            };

            throw new ApiError(
              payload.code ?? "UNKNOWN_ERROR",
              payload.message ?? "请求失败，请稍后重试",
            );
          } catch (error) {
            if (error instanceof ApiError) {
              throw error;
            }
          }
        }
      }

      const json = (await response.json().catch(() => null)) as ApiResponse<never> | null;
      throw new ApiError(
        json?.error?.code ?? "UNKNOWN_ERROR",
        json?.error?.message ?? "请求失败，请稍后重试",
      );
    }

    if (!response.body) {
      throw new ApiError("EMPTY_STREAM", "流式响应为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const flushEventBlock = (block: string) => {
      const lines = block.split("\n");
      let event = "message";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) {
        return;
      }

      onEvent({
        event,
        data: JSON.parse(dataLines.join("\n")),
      });
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      let boundaryIndex = buffer.indexOf("\n\n");
      while (boundaryIndex >= 0) {
        const block = buffer.slice(0, boundaryIndex).trim();
        buffer = buffer.slice(boundaryIndex + 2);

        if (block && !block.startsWith(":")) {
          flushEventBlock(block);
        }

        boundaryIndex = buffer.indexOf("\n\n");
      }

      if (done) {
        break;
      }
    }
  },
};

export { ApiError };
