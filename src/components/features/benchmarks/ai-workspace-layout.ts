export type AiWorkspaceMode = "understanding" | "rewrite";
export type AiWorkspaceColumn = "video" | "transcript" | "decomposition" | "rewrite";

export function getAiWorkspaceColumnOrder(mode: AiWorkspaceMode): AiWorkspaceColumn[] {
  return mode === "rewrite"
    ? ["decomposition", "transcript", "rewrite"]
    : ["video", "transcript", "decomposition"];
}

export function getAiWorkspaceModeCopy(mode: AiWorkspaceMode) {
  return mode === "rewrite"
    ? {
        modeLabel: "仿写态",
        switchLabel: "返回理解态",
        videoCardLabel: "源视频缩略卡",
      }
    : {
        modeLabel: "理解态",
        switchLabel: "进入仿写态",
        videoCardLabel: "完整视频详情卡",
      };
}
