import { describe, expect, it } from "vitest";

describe("/viewpoints page entry", () => {
  it("exports a default page component", async () => {
    const module = await import("./page");

    expect(module.default).toBeTypeOf("function");
  });
});
