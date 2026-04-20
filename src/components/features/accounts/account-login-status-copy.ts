import type {
  DouyinAccountLoginStatus,
  DouyinLoginSessionCurrentStep,
  DouyinLoginSessionDTO,
  DouyinLoginSessionPurpose,
  DouyinLoginSessionStatus,
} from "@/types/douyin-account";

export type AccountLoginViewState =
  | "IDLE"
  | "CREATING_SESSION"
  | "QRCODE_READY"
  | "SCANNED"
  | "SUCCESS"
  | "EXPIRED"
  | "FAILED";

interface AccountLoginViewCopy {
  title: string;
  description: string;
}

interface AccountLoginStatusMeta {
  label: string;
  description: string;
  className: string;
  dotClassName: string;
}

export interface AccountLoginProcessStep {
  key: string;
  label: string;
  state: "done" | "active" | "upcoming" | "failed";
}

interface LoginProcessStepDefinition {
  key: string;
  label: string;
  activeSteps: DouyinLoginSessionCurrentStep[];
}

const BASE_PROCESS_STEPS: LoginProcessStepDefinition[] = [
  {
    key: "browser",
    label: "启动浏览器",
    activeSteps: ["PREPARING_BROWSER", "OPENING_LOGIN_PAGE", "FETCHING_QRCODE"],
  },
  {
    key: "qrcode",
    label: "二维码待扫码",
    activeSteps: ["WAITING_FOR_SCAN"],
  },
  {
    key: "confirm",
    label: "手机确认登录",
    activeSteps: ["WAITING_FOR_CONFIRM"],
  },
  {
    key: "identity",
    label: "识别账号身份",
    activeSteps: ["PERSISTING_LOGIN_STATE", "RESOLVING_IDENTITY", "FETCHING_PROFILE"],
  },
];

const CREATE_ACCOUNT_FINAL_STEP: LoginProcessStepDefinition = {
  key: "finalize",
  label: "创建账号并同步",
  activeSteps: ["CREATING_ACCOUNT", "SYNCING_ACCOUNT", "SUCCESS"],
};

const RELOGIN_FINAL_STEP: LoginProcessStepDefinition = {
  key: "finalize",
  label: "更新登录态",
  activeSteps: ["UPDATING_ACCOUNT_LOGIN_STATE", "SUCCESS"],
};

function getProcessStepDefinitions(
  purpose: DouyinLoginSessionPurpose,
): LoginProcessStepDefinition[] {
  return [
    ...BASE_PROCESS_STEPS,
    purpose === "CREATE_ACCOUNT" ? CREATE_ACCOUNT_FINAL_STEP : RELOGIN_FINAL_STEP,
  ];
}

function getCurrentProcessIndex(
  currentStep: DouyinLoginSessionCurrentStep,
  definitions: LoginProcessStepDefinition[],
): number {
  const index = definitions.findIndex((definition) =>
    definition.activeSteps.includes(currentStep),
  );

  if (index >= 0) {
    return index;
  }

  if (currentStep === "FAILED" || currentStep === "EXPIRED" || currentStep === "CANCELLED") {
    return definitions.findIndex((definition) => definition.key === "finalize");
  }

  return 0;
}

export function isDouyinLoginSessionTerminal(status: DouyinLoginSessionStatus): boolean {
  return (
    status === "SUCCESS" ||
    status === "FAILED" ||
    status === "EXPIRED" ||
    status === "CANCELLED"
  );
}

export function getAccountLoginProcessSteps(
  purpose: DouyinLoginSessionPurpose,
  session: DouyinLoginSessionDTO | null,
): AccountLoginProcessStep[] {
  const definitions = getProcessStepDefinitions(purpose);
  const currentStep = session?.currentStep ?? "PREPARING_BROWSER";
  const currentIndex = getCurrentProcessIndex(currentStep, definitions);
  const isFailed =
    currentStep === "FAILED" || currentStep === "EXPIRED" || currentStep === "CANCELLED";

  return definitions.map((definition, index) => {
    if (isFailed && index === currentIndex) {
      return { key: definition.key, label: definition.label, state: "failed" };
    }

    if (index < currentIndex) {
      return { key: definition.key, label: definition.label, state: "done" };
    }

    if (index === currentIndex) {
      return { key: definition.key, label: definition.label, state: "active" };
    }

    return { key: definition.key, label: definition.label, state: "upcoming" };
  });
}

export function mapLoginSessionToViewState(
  session: DouyinLoginSessionDTO | null,
  isCreatingSession: boolean,
): AccountLoginViewState {
  if (isCreatingSession) {
    return "CREATING_SESSION";
  }

  if (!session) {
    return "IDLE";
  }

  switch (session.status) {
    case "CREATED":
      return "CREATING_SESSION";
    case "QRCODE_READY":
      return "QRCODE_READY";
    case "SCANNED":
      return "SCANNED";
    case "CONFIRMED":
    case "SUCCESS":
      return "SUCCESS";
    case "EXPIRED":
      return "EXPIRED";
    case "FAILED":
    case "CANCELLED":
      return "FAILED";
    default:
      return "IDLE";
  }
}

export function getAccountLoginViewCopy(
  state: AccountLoginViewState,
  purpose: DouyinLoginSessionPurpose,
  session: DouyinLoginSessionDTO | null,
): AccountLoginViewCopy {
  const fallbackSuccessCopy =
    purpose === "CREATE_ACCOUNT" ? "登录成功，正在创建账号" : "登录成功，正在更新登录态";

  switch (state) {
    case "CREATING_SESSION":
      return {
        title: "正在准备二维码",
        description: session?.message ?? "正在准备登录二维码",
      };
    case "QRCODE_READY":
      return {
        title: "请扫码登录",
        description: session?.message ?? "请使用抖音 App 扫码登录",
      };
    case "SCANNED":
      return {
        title: "等待手机确认",
        description: session?.message ?? "已扫码，请在手机上确认登录",
      };
    case "SUCCESS":
      return {
        title: purpose === "CREATE_ACCOUNT" ? "正在创建账号" : "正在更新登录态",
        description: session?.message ?? fallbackSuccessCopy,
      };
    case "EXPIRED":
      return {
        title: "二维码已失效",
        description: session?.message ?? "二维码已失效，请刷新后重新扫码",
      };
    case "FAILED":
      if (session?.errorCode === "RELOGIN_ACCOUNT_UNVERIFIED") {
        return {
          title: "请检查扫码账号",
          description:
            "系统检测到本次扫码未能确认与你当前要更新的账号一致。通常是扫错号了，请切换到目标抖音账号后重新扫码。",
        };
      }
      if (session?.errorCode === "RELOGIN_ACCOUNT_MISMATCH") {
        return {
          title: "扫码账号不一致",
          description:
            "当前扫码登录的账号与目标账号不一致，请切换到目标抖音账号后重新扫码。",
        };
      }
      return {
        title: session?.status === "CANCELLED" ? "登录已取消" : "登录失败",
        description: session?.errorMessage ?? session?.message ?? "登录失败，请重试",
      };
    case "IDLE":
    default:
      return {
        title: "等待开始",
        description: "准备就绪后会在这里展示二维码与状态。",
      };
  }
}

export function getAccountLoginStatusMeta(
  status: DouyinAccountLoginStatus,
): AccountLoginStatusMeta {
  switch (status) {
    case "LOGGED_IN":
      return {
        label: "已登录",
        description: "当前账号已绑定可用登录态，可安全用于当前账号的收藏同步与重登校验。",
        className:
          "border-[hsl(var(--success)/0.28)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]",
        dotClassName: "bg-[hsl(var(--success))]",
      };
    case "PENDING":
      return {
        label: "登录中",
        description: "当前账号正在等待本次扫码登录完成，成功后只会更新这一条账号记录。",
        className:
          "border-[hsl(var(--info)/0.28)] bg-[hsl(var(--info)/0.14)] text-[hsl(var(--info))]",
        dotClassName: "bg-[hsl(var(--info))]",
      };
    case "EXPIRED":
      return {
        label: "已失效",
        description: "原有登录态已不可用，当前账号的收藏同步会被跳过，需要重新扫码绑定。",
        className:
          "border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]",
        dotClassName: "bg-[hsl(var(--warning))]",
      };
    case "FAILED":
      return {
        label: "登录失败",
        description: "最近一次登录绑定未完成，系统不会保留半成品登录态，需要重新发起扫码。",
        className:
          "border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.12)] text-destructive",
        dotClassName: "bg-destructive",
      };
    case "NOT_LOGGED_IN":
    default:
      return {
        label: "未登录",
        description: "当前账号尚未绑定独立登录态，涉及登录态的同步能力暂不可用。",
        className: "border-border/50 bg-muted/50 text-muted-foreground",
        dotClassName: "bg-muted-foreground/70",
      };
  }
}

export function getReloginActionLabel(status: DouyinAccountLoginStatus): string {
  switch (status) {
    case "LOGGED_IN":
      return "更新登录";
    case "NOT_LOGGED_IN":
      return "立即登录";
    case "PENDING":
      return "继续登录";
    case "EXPIRED":
    case "FAILED":
    default:
      return "重新登录";
  }
}
