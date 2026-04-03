import { describe, expect, it, vi } from "vitest";

describe("storageService", () => {
  it("builds a dated storage path and logs the pending download", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { storageService } = await import("@/server/services/storage.service");
    const path = await storageService.downloadAndStore(
      "https://cdn.example.com/video.mp4",
      "videos",
    );

    expect(path).toMatch(/^storage\/videos\/\d{4}-\d{2}-\d{2}\/video\.mp4$/);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[StorageService] 待下载: https://cdn.example.com/video.mp4 →"),
    );

    consoleInfoSpy.mockRestore();
  });
});
