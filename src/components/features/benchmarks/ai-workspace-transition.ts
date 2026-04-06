export interface AiWorkspaceTransitionOrigin {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
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