import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, listVideosMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listVideosMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/video.service", () => ({
  videoService: {
    listVideos: listVideosMock,
  },
}));

describe("GET /api/videos", () => {
  beforeEach(() => {
    authMock.mockReset();
    listVideosMock.mockReset();
  });

  it("passes validated query params to the service", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    listVideosMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const { GET } = await import("@/app/api/videos/route");
    const response = await GET(
      new Request(
        "http://localhost/api/videos?page=1&limit=20&accountId=account_1&sort=publishedAt&order=desc",
      ),
    );

    expect(response.status).toBe(200);
    expect(listVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      {
        page: 1,
        limit: 20,
        accountId: "account_1",
        tag: undefined,
        sort: "publishedAt",
        order: "desc",
      },
    );
  });
});
