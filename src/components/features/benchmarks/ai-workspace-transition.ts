export interface AiWorkspaceTransitionOrigin {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

export function parseBorderRadiusPx(value: string | null | undefined): number {
  const parsedValue = Number.parseFloat(value ?? "");

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return parsedValue;
}

export function buildAiWorkspaceTransitionOrigin(
  rect: Pick<DOMRect, "top" | "left" | "width" | "height">,
  borderRadius: number = 16,
): AiWorkspaceTransitionOrigin {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius,
  };
}
