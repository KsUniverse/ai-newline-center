export const REWRITE_STAGE_GRID_TEMPLATE_COLUMNS = "2fr 4fr 4fr";

export type WorkspaceShellColumn = "video" | "transcript" | "decomposition" | "rewrite";
export type WorkspaceShellStage = "transcribe" | "decompose" | "rewrite";

export function getWorkspaceShellColumns(stage: WorkspaceShellStage): WorkspaceShellColumn[] {
  return stage === "rewrite"
    ? ["rewrite"]
    : ["video", "transcript", "decomposition"];
}
