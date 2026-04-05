import { ApiError } from "@/lib/api-client";

export const BENCHMARK_LIBRARY_EYEBROW = "Shared Research Library";
export const BENCHMARK_LIBRARY_TITLE = "组织研究库";
export const BENCHMARK_LIBRARY_DESCRIPTION =
  "集中管理在库研究对象，支持纳入、浏览与归档。";
export const BENCHMARK_LIBRARY_LIST_TITLE = "在库研究对象";
export const BENCHMARK_LIBRARY_LIST_DESCRIPTION =
  "点击卡片进入档案页，继续查看关注画像、状态和研究记录。";
export const BENCHMARK_LIBRARY_ARCHIVED_TITLE = "归档研究库";
export const BENCHMARK_LIBRARY_ARCHIVED_DESCRIPTION =
  "查看已归档对象，按需回看历史素材和研究记录。";
export const BENCHMARK_LIBRARY_ARCHIVED_LIST_TITLE = "历史归档档案";
export const BENCHMARK_LIBRARY_ARCHIVED_LIST_DESCRIPTION =
  "归档不会删除账号资料、作品样本和转录文本。";
export const BENCHMARK_DETAIL_EYEBROW = "Benchmark Dossier";
export const BENCHMARK_DETAIL_TITLE = "研究对象档案";
export const BENCHMARK_DETAIL_DESCRIPTION =
  "查看研究对象资料、关注规模与样本记录。";
export const BENCHMARK_VIDEO_SECTION_TITLE = "作品样本库";
export const BENCHMARK_VIDEO_SECTION_DESCRIPTION =
  "选择作品查看指标、封面与转录；详情在右侧面板内完成。";
export const BENCHMARK_ADD_ACTION_LABEL = "纳入研究对象";
export const BENCHMARK_ARCHIVE_LINK_LABEL = "查看归档库";
export const BENCHMARK_BACK_TO_LIBRARY_LABEL = "返回研究库";

export function getBenchmarkAddPreviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "BENCHMARK_EXISTS":
        return "该账号已在组织共享研究库中，保存后会直接复用现有档案并补充你的成员关联。";
      case "BENCHMARK_ARCHIVED":
        return "该研究对象已移入归档库，请前往归档列表查看。";
      case "ACCOUNT_EXISTS_AS_MY":
        return "该账号已作为员工账号接入，不能重复加入对标研究库。";
      default:
        return error.message;
    }
  }

  return "获取研究对象信息失败，请检查链接是否正确。";
}

export function getBenchmarkAddSuccessMessage(): string {
  return "已加入组织共享研究库。";
}

export function getBenchmarkAddDrawerDescription(): string {
  return "输入抖音主页链接后，系统会优先复用组织已有档案，避免重复沉淀研究对象。";
}

export function getBenchmarkAddInputHint(): string {
  return "支持粘贴完整抖音主页链接；系统会优先识别组织内已有档案。";
}

export function getBenchmarkAddPreviewTitle(): string {
  return "待纳入研究库的账号预览";
}

export function getBenchmarkAddFetchActionLabel(): string {
  return "获取账号预览";
}

export function getBenchmarkAddRetryActionLabel(): string {
  return "重新获取";
}

export function getBenchmarkResetInputLabel(): string {
  return "重新输入";
}

export function getBenchmarkAddMemberHint(): string {
  return "保存后会建立你的成员关联；后续归档权限仍以后端成员关系校验为准。";
}

export function getBenchmarkArchiveSuccessMessage(): string {
  return "研究对象已移入归档库。";
}

export function getBenchmarkArchiveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "FORBIDDEN") {
      return "仅关联成员可将该研究对象移入归档库。";
    }

    return error.message;
  }

  return "归档失败，请稍后重试。";
}

export function getBenchmarkSharedLabel(creatorName: string): string {
  return `组织共享 · 最初由 ${creatorName} 录入`;
}

export function getBenchmarkCreatedByLabel(creatorName: string): string {
  return `最初录入成员：${creatorName}`;
}

export function getBenchmarkArchiveEntryHint(canArchive: boolean): string {
  return canArchive
    ? "你当前已关联该研究对象，可将其移入归档库。"
    : "仅已关联成员可执行归档；当前档案仍可继续浏览和研究。";
}

export function getBenchmarkLibraryOverviewTitle(archived = false): string {
  return archived
    ? "归档并不等于删除，历史研究判断仍应可回溯"
    : "让研究对象成为组织资产，而不是创建者的私人列表";
}

export function getBenchmarkLibraryOverviewDescription(archived = false): string {
  return archived
    ? "归档后的研究对象会退出主库，但账号资料、作品样本和 AI 转录仍完整保留，方便团队在之后回看素材来源和曾经的判断。"
    : "同一个研究对象只保留一份组织档案。成员再次纳入时只会建立新的关联关系，避免因创建者身份不同而出现多份重复记录。";
}

export function getBenchmarkArchiveDialogTitle(nickname?: string): string {
  return nickname ? `将 ${nickname} 移入归档库？` : "将研究对象移入归档库？";
}

export function getBenchmarkArchiveDialogDescription(nickname?: string): string {
  const targetLabel = nickname ? `${nickname} 的` : "该";

  return `${targetLabel}账号会从主研究库移出，但资料、样本和转录会继续保留。`;
}

export function getBenchmarkArchiveActionLabel(): string {
  return "移入归档";
}

export function getBenchmarkArchiveHint(): string {
  return "归档权限以成员关系为准；手动添加或收藏同步建立关联后可操作。";
}

export function getBenchmarkLibraryCountLabel(total: number, archived = false): string {
  if (total === 0) {
    return archived ? "归档库暂时为空" : "等待首个研究对象入库";
  }

  return archived ? `已归档 ${total} 个研究对象` : `在库 ${total} 个研究对象`;
}

export function getBenchmarkVideoCountLabel(total: number): string {
  return total === 0 ? "作品同步中" : `已同步 ${total} 条作品样本`;
}

export function getBenchmarkLibrarySyncHint(archived = false): string {
  return archived ? "可随时回看历史素材与研究上下文" : "组织内列表每分钟自动刷新一次";
}

export function getBenchmarkEmptyStateTitle(archived = false): string {
  return archived ? "归档库暂时为空" : "还没有研究对象入库";
}

export function getBenchmarkEmptyStateDescription(archived = false): string {
  return archived
    ? "归档后的研究对象会保留账号资料、作品样本与转录记录，方便之后回溯。"
    : "可手动添加抖音主页，或通过收藏同步把研究对象纳入组织共享研究库。";
}

export function getBenchmarkVideoEmptyDescription(): string {
  return "作品样本仍在同步中，稍后会自动补全到研究档案。";
}

export function getBenchmarkCardSummaryFallback(): string {
  return "组织会持续同步这个研究对象的账号资料、关注画像与研究记录。";
}

export function getBenchmarkVideoDetailTitle(title?: string): string {
  return title && title.trim() ? title : "作品详情";
}

export function getBenchmarkVideoStatusLabel(videoStoragePath: string | null): string {
  return videoStoragePath ? "可转录" : "待同步";
}

export function getBenchmarkVideoStatusHint(videoStoragePath: string | null): string {
  return videoStoragePath
    ? "视频文件已落库，可发起或编辑研究转录。"
    : "视频文件仍在同步，暂时无法生成研究转录。";
}

export function getBenchmarkListLoadErrorMessage(): string {
  return "加载研究对象列表失败，请稍后重试。";
}

export function getBenchmarkArchivedListLoadErrorMessage(): string {
  return "加载归档研究对象失败，请稍后重试。";
}

export function getBenchmarkDetailLoadErrorMessage(): string {
  return "加载研究对象档案失败，请稍后重试。";
}

export function getBenchmarkVideoLoadErrorMessage(): string {
  return "加载作品样本失败，请稍后重试。";
}

export function getBenchmarkTranscriptionUnavailableHint(): string {
  return "视频文件下载完成后，才能发起 AI 转录。";
}