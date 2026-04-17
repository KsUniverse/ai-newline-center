import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { benchmarkVideoRepository } from "@/server/repositories/benchmark-video.repository";

describe("benchmarkVideoRepository.findDashboardVideos", () => {
  it("orders by likeCount for recommended sorting", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = {
      benchmarkVideo: {
        findMany,
        count,
      },
    };

    await benchmarkVideoRepository.findDashboardVideos(
      {
        publishedAtGte: new Date("2026-04-17T00:00:00.000Z"),
        limit: 20,
        sortBy: "recommended",
      },
      db as never,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ likeCount: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("orders by publishedAt for time sorting and decodes time cursor", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = {
      benchmarkVideo: {
        findMany,
        count,
      },
    };
    const cursor = Buffer.from(
      JSON.stringify({
        publishedAt: "2026-04-17T09:00:00.000Z",
        id: "video_2",
      }),
    ).toString("base64url");

    await benchmarkVideoRepository.findDashboardVideos(
      {
        publishedAtGte: new Date("2026-04-17T00:00:00.000Z"),
        limit: 20,
        sortBy: "time",
        cursor,
      },
      db as never,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.any(Object),
            {
              OR: [
                { publishedAt: { lt: new Date("2026-04-17T09:00:00.000Z") } },
                {
                  publishedAt: new Date("2026-04-17T09:00:00.000Z"),
                  id: { gt: "video_2" },
                },
              ],
            },
          ]),
        }),
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      }),
    );
  });
});
