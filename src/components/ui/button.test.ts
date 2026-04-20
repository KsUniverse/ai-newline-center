import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

describe("button variants", () => {
  it("keeps default buttons flat and compact", () => {
    expect(buttonVariants({ variant: "default" })).toContain("rounded-md");
    expect(buttonVariants({ variant: "default" })).not.toContain("shadow-sm");
  });

  it("keeps outline buttons defined by border contrast instead of lift", () => {
    expect(buttonVariants({ variant: "outline" })).toContain("border-border/65");
    expect(buttonVariants({ variant: "outline" })).not.toContain("shadow-sm");
  });
});
