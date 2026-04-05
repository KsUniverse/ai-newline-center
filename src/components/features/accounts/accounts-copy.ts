import type { DouyinAccountDTO } from "@/types/douyin-account";

export const ACCOUNTS_EYEBROW = "Source Accounts";
export const ACCOUNTS_ADD_ACTION_LABEL = "接入账号";
export const ACCOUNTS_BACK_LABEL = "返回账号列表";
export const ACCOUNTS_DETAIL_EYEBROW = "Account Dossier";
export const ACCOUNTS_DETAIL_TITLE = "账号档案";
export const ACCOUNTS_VIDEO_SECTION_TITLE = "内容样本库";
export const ACCOUNTS_VIDEO_SECTION_DESCRIPTION =
  "浏览已同步的视频样本、互动指标和账号登录状态。";

export function getAccountsPageMeta(role: string): { title: string; description: string } {
  switch (role) {
    case "BRANCH_MANAGER":
      return {
        title: "本公司内容账号",
        description: "查看账号接入状态、登录结果和内容样本。",
      };
    case "SUPER_ADMIN":
      return {
        title: "全平台内容账号",
        description: "查看全平台账号接入、同步状态和内容样本。",
      };
    default:
      return {
        title: "我的内容账号",
        description: "接入账号、处理登录态并查看内容样本。",
      };
  }
}

export function getAccountsOverviewTitle(role: string): string {
  return role === "EMPLOYEE"
    ? "把你的内容账号、登录态和同步结果收敛到同一个工作面板"
    : "统一查看组织内内容账号的接入状态、同步质量和样本表现";
}

export function getAccountsOverviewDescription(role: string): string {
  return role === "EMPLOYEE"
    ? "这里承载员工私有的内容源账号，与组织共享研究库分开管理；扫码登录、手动同步和样本浏览都在这里完成。"
    : "内容账号属于员工私有链路，但负责人和超管可以查看组织范围内的接入情况与视频样本，用于排查登录态和同步问题。";
}

export function getAccountsCountLabel(total: number): string {
  return total === 0 ? "等待首个内容账号接入" : `已接入 ${total} 个内容账号`;
}

export function getAccountsScopeLabel(role: string): string {
  switch (role) {
    case "BRANCH_MANAGER":
      return "查看本公司范围";
    case "SUPER_ADMIN":
      return "查看全平台范围";
    default:
      return "仅你自己可维护";
  }
}

export function getAccountsSyncHint(): string {
  return "账号资料每小时同步，视频与快照按更高频率自动刷新。";
}

export function getAccountsLibrarySectionTitle(role: string): string {
  return role === "EMPLOYEE" ? "我负责的账号" : "当前可查看账号";
}

export function getAccountsLibrarySectionDescription(role: string): string {
  return role === "EMPLOYEE"
    ? "点击账号进入档案页，继续处理登录、同步和样本查看。"
    : "点击账号进入档案页，查看同步状态与内容样本。";
}

export function getAccountsEmptyStateTitle(): string {
  return "还没有内容账号接入";
}

export function getAccountsEmptyStateDescription(): string {
  return "接入你管理的抖音内容账号后，系统会统一维护登录态、基础资料和视频样本。";
}

export function getAccountDetailDescription(account?: DouyinAccountDTO | null): string {
  if (!account) {
    return "查看内容账号的同步状态、登录态与视频样本。";
  }

  return `围绕 ${account.nickname} 管理登录态、账号资料和视频样本。`;
}

export function getAccountLoadErrorMessage(): string {
  return "加载账号档案失败，请稍后重试。";
}

export function getAccountVideoLoadErrorMessage(): string {
  return "加载内容样本失败，请稍后重试。";
}

export function getAccountsListLoadErrorMessage(): string {
  return "加载内容账号失败，请稍后重试。";
}

export function getAccountsVideoFeedLoadErrorMessage(): string {
  return "加载视频样本失败，请稍后重试。";
}

export function getAccountSyncSuccessMessage(): string {
  return "账号资料与视频样本已开始同步。";
}

export function getAccountSyncFailureMessage(): string {
  return "同步失败，请稍后再试。";
}

export function getAccountDetailPanelTitle(video?: { title?: string | null } | null): string {
  return video?.title?.trim() ? video.title : "内容样本详情";
}

export function getAccountsVideoEmptyDescription(): string {
  return "当前筛选条件下没有视频样本，或该账号仍在等待首次同步。";
}

export function getAccountsFilterSummary(
  accountId: string | undefined,
  tag: string | undefined,
  sort: "publishedAt" | "likeCount",
  accounts: DouyinAccountDTO[],
): string {
  const accountLabel = accountId
    ? accounts.find((account) => account.id === accountId)?.nickname ?? "指定账号"
    : "全部账号";
  const tagLabel = tag ?? "全部标签";
  const sortLabel = sort === "publishedAt" ? "按发布时间" : "按点赞数";

  return `${accountLabel} · ${tagLabel} · ${sortLabel}`;
}

export function getAccountsVideoCountLabel(total: number): string {
  return total === 0 ? "等待首批内容样本" : `已载入 ${total} 条内容样本`;
}

export function getAccountSourceLabel(accountName: string): string {
  return `内容源账号 · ${accountName}`;
}

export function getAccountSummaryFallback(): string {
  return "系统会围绕这个内容账号持续维护登录态、基础资料与视频样本。";
}