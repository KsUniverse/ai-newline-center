import { describe, expect, it } from "vitest";

describe("/viewpoints page entry", () => {
  it("exports a default page component", async () => {
    const pageModule = await import("./page");

    expect(pageModule.default).toBeTypeOf("function");
  });
});
