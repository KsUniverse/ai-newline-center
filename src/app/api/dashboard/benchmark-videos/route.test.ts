import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, listDashboardVideosMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listDashboardVideosMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/benchmark-video.service", () => ({
  benchmarkVideoService: {
    listDashboardVideos: listDashboardVideosMock,
  },
}));

describe("GET /api/dashboard/benchmark-videos", () => {
  beforeEach(() => {
    authMock.mockReset();
    listDashboardVideosMock.mockReset();
  });

  it("defaults sortBy to recommended and passes explicit time sort", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    listDashboardVideosMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      total: 0,
    });

    const { GET } = await import("@/app/api/dashboard/benchmark-videos/route");

    const defaultResponse = await GET(new Request("http://localhost/api/dashboard/benchmark-videos"));
    expect(defaultResponse.status).toBe(200);
    expect(listDashboardVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      {
        dateRange: "today",
        customTag: undefined,
        isBringOrder: undefined,
        cursor: undefined,
        limit: 20,
        sortBy: "recommended",
      },
    );

    const timeResponse = await GET(
      new Request(
        "http://localhost/api/dashboard/benchmark-videos?dateRange=this_week&sortBy=time&limit=10",
      ),
    );
    expect(timeResponse.status).toBe(200);
    expect(listDashboardVideosMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      {
        dateRange: "this_week",
        customTag: undefined,
        isBringOrder: undefined,
        cursor: undefined,
        limit: 10,
        sortBy: "time",
      },
    );
  });

  it("rejects invalid sort values", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });

    const { GET } = await import("@/app/api/dashboard/benchmark-videos/route");
    const response = await GET(
      new Request("http://localhost/api/dashboard/benchmark-videos?sortBy=unknown"),
    );

    expect(response.status).toBe(400);
  });
});
