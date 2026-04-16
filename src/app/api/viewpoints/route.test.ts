import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, createFragmentsMock, listFragmentsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createFragmentsMock: vi.fn(),
  listFragmentsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/fragment.service", () => ({
  fragmentService: {
    createFragments: createFragmentsMock,
    listFragments: listFragmentsMock,
  },
}));

describe("GET /api/viewpoints", () => {
  beforeEach(() => {
    authMock.mockReset();
    createFragmentsMock.mockReset();
    listFragmentsMock.mockReset();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/viewpoints/route");
    const response = await GET(new Request("http://localhost/api/viewpoints"));

    expect(response.status).toBe(401);
  });

  it("passes validated query params to the fragment service", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        name: "Alice",
        account: "alice",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    listFragmentsMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    const { GET } = await import("@/app/api/viewpoints/route");
    const response = await GET(
      new Request("http://localhost/api/viewpoints?q=ideas&cursor=cursor_1&limit=15"),
    );

    expect(response.status).toBe(200);
    expect(listFragmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_1",
        account: "alice",
        organizationId: "org_1",
      }),
      {
        q: "ideas",
        cursor: "cursor_1",
        limit: 15,
      },
    );
  });

  it("allows an empty cursor and rejects q values longer than 200 characters", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        name: "Alice",
        account: "alice",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    listFragmentsMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    const { GET } = await import("@/app/api/viewpoints/route");

    const emptyCursorResponse = await GET(
      new Request("http://localhost/api/viewpoints?q=ideas&cursor=&limit=15"),
    );

    expect(emptyCursorResponse.status).toBe(200);
    expect(listFragmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_1",
      }),
      {
        q: "ideas",
        cursor: "",
        limit: 15,
      },
    );

    const longQuery = "x".repeat(201);
    const longQueryResponse = await GET(
      new Request(`http://localhost/api/viewpoints?q=${longQuery}`),
    );

    expect(longQueryResponse.status).toBe(400);
  });
});

describe("POST /api/viewpoints", () => {
  beforeEach(() => {
    authMock.mockReset();
    createFragmentsMock.mockReset();
    listFragmentsMock.mockReset();
  });

  it("creates fragments and returns 201", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        name: "Alice",
        account: "alice",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
    });
    createFragmentsMock.mockResolvedValue({
      created: 1,
      items: [],
    });

    const { POST } = await import("@/app/api/viewpoints/route");
    const response = await POST(
      new Request("http://localhost/api/viewpoints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: ["  First viewpoint  "],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createFragmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_1",
        account: "alice",
        organizationId: "org_1",
      }),
      {
        contents: ["  First viewpoint  "],
      },
    );
  });

  it("rejects empty array and non-array bodies with 400 and does not call createFragments", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        name: "Alice",
        account: "alice",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
    });

    const { POST } = await import("@/app/api/viewpoints/route");

    const emptyContentsResponse = await POST(
      new Request("http://localhost/api/viewpoints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [],
        }),
      }),
    );

    expect(emptyContentsResponse.status).toBe(400);
    expect(createFragmentsMock).not.toHaveBeenCalled();

    createFragmentsMock.mockReset();

    const nonArrayResponse = await POST(
      new Request("http://localhost/api/viewpoints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: "First viewpoint",
        }),
      }),
    );

    expect(nonArrayResponse.status).toBe(400);
    expect(createFragmentsMock).not.toHaveBeenCalled();
  });
});
