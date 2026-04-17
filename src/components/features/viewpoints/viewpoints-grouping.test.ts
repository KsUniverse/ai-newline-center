import { describe, expect, it } from "vitest";

import { groupHistoricalViewpointsByDate } from "@/components/features/viewpoints/viewpoints-grouping";

describe("groupHistoricalViewpointsByDate", () => {
  it("groups history items by Shanghai calendar day in descending order", () => {
    const groups = groupHistoricalViewpointsByDate([
      {
        id: "fragment_2",
        content: "4 月 9 日晚观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdByUser: { id: "user_1", name: "Alice" },
        createdAt: "2026-04-09T13:00:00.000Z",
      },
      {
        id: "fragment_1",
        content: "4 月 9 日早观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdByUser: { id: "user_1", name: "Alice" },
        createdAt: "2026-04-09T01:00:00.000Z",
      },
      {
        id: "fragment_3",
        content: "4 月 8 日观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdByUser: { id: "user_1", name: "Alice" },
        createdAt: "2026-04-08T03:00:00.000Z",
      },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-04-09", "2026-04-08"]);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[1]?.items).toHaveLength(1);
  });
});
