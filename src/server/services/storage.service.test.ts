import { describe, expect, it, vi } from "vitest";

describe("storageService", () => {
  it("builds a dated storage path and logs the pending download", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("video/mp4"),
        },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    );

    const { storageService } = await import("@/server/services/storage.service");
    const path = await storageService.downloadAndStore(
      "https://cdn.example.com/video.mp4",
      "videos",
    );

    expect(path).toMatch(/^\/storage\/videos\/\d{4}-\d{2}-\d{2}\/video\.mp4$/);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[StorageService] 待下载: https://cdn.example.com/video.mp4 →"),
    );

    consoleInfoSpy.mockRestore();
  });

  it("uses mime_type query parameter to infer mp4 extension when pathname has no suffix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("video/mp4"),
        },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    );

    const { storageService } = await import("@/server/services/storage.service");
    const path = await storageService.downloadAndStore(
      "https://cdn.example.com/abc123?mime_type=video_mp4&foo=bar",
      "videos",
    );

    expect(path).toMatch(/^\/storage\/videos\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{32}\.mp4$/);
  });

  it("uses response content-type to infer gif extension when url has no suffix", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) =>
            name.toLowerCase() === "content-type" ? "image/gif" : null,
          ),
        },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
    );

    const { storageService } = await import("@/server/services/storage.service");
    const path = await storageService.downloadAndStore(
      "https://cdn.example.com/no-extension-resource",
      "covers",
    );

    expect(path).toMatch(/^\/storage\/covers\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{32}\.gif$/);
  });
});
