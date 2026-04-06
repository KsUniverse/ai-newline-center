export type DouyinAccountLoginStatus =
  | "NOT_LOGGED_IN"
  | "PENDING"
  | "LOGGED_IN"
  | "EXPIRED"
  | "FAILED";

export type DouyinLoginSessionPurpose = "CREATE_ACCOUNT" | "RELOGIN";

export interface CreateDouyinLoginSessionForCreateAccountInput {
  purpose: "CREATE_ACCOUNT";
}

export interface CreateDouyinLoginSessionForReloginInput {
  purpose: "RELOGIN";
  accountId: string;
}

export type CreateDouyinLoginSessionInput =
  | CreateDouyinLoginSessionForCreateAccountInput
  | CreateDouyinLoginSessionForReloginInput;

export type DouyinLoginSessionStatus =
  | "CREATED"
  | "QRCODE_READY"
  | "SCANNED"
  | "CONFIRMED"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export type DouyinLoginSessionCurrentStep =
  | "PREPARING_BROWSER"
  | "OPENING_LOGIN_PAGE"
  | "FETCHING_QRCODE"
  | "WAITING_FOR_SCAN"
  | "WAITING_FOR_CONFIRM"
  | "PERSISTING_LOGIN_STATE"
  | "RESOLVING_IDENTITY"
  | "FETCHING_PROFILE"
  | "CREATING_ACCOUNT"
  | "UPDATING_ACCOUNT_LOGIN_STATE"
  | "SYNCING_ACCOUNT"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface DouyinAccountDTO {
  id: string;
  profileUrl: string;
  secUserId: string | null;
  nickname: string;
  avatar: string;
  bio: string | null;
  signature: string | null;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  douyinNumber: string | null;
  ipLocation: string | null;
  age: number | null;
  province: string | null;
  city: string | null;
  verificationLabel: string | null;
  verificationIconUrl: string | null;
  verificationType: number | null;
  loginStatus: DouyinAccountLoginStatus;
  loginStateUpdatedAt: string | null;
  loginStateCheckedAt: string | null;
  loginStateExpiresAt: string | null;
  loginErrorMessage: string | null;
  userId: string;
  organizationId: string;
  createdAt: string;
}

export interface DouyinAccountDetailDTO extends DouyinAccountDTO {
  user: {
    id: string;
    name: string;
  };
  lastSyncedAt: string | null;
}

export interface AccountPreview {
  profileUrl: string;
  secUserId: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  signature: string | null;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  douyinNumber: string | null;
  ipLocation: string | null;
  age: number | null;
  province: string | null;
  city: string | null;
  verificationLabel: string | null;
  verificationIconUrl: string | null;
  verificationType: number | null;
}

export interface DouyinVideoDTO {
  id: string;
  videoId: string;
  title: string;
  shareUrl: string | null;
  coverUrl: string | null;
  coverSourceUrl: string | null;
  coverStoragePath: string | null;
  videoUrl: string | null;
  videoSourceUrl: string | null;
  videoStoragePath: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  admireCount: number;
  recommendCount: number;
  tags: string[];
  createdAt: string;
}

export interface DouyinVideoWithAccountDTO extends DouyinVideoDTO {
  accountNickname: string;
  accountAvatar: string;
}

export interface BenchmarkAccountDTO extends DouyinAccountDTO {
  creatorName: string;
  deletedAt: string | null;
  canArchive: boolean;
}

export interface BenchmarkAccountDetailDTO extends BenchmarkAccountDTO {
  lastSyncedAt: string | null;
}

export interface BenchmarkAccountView extends Omit<BenchmarkAccountDTO, "userId"> {
  createdByUserId: string;
}

export interface BenchmarkAccountDetailView extends Omit<BenchmarkAccountDetailDTO, "userId"> {
  createdByUserId: string;
}

export interface CreateBenchmarkResultDTO {
  id: string;
  profileUrl: string;
  secUserId: string;
}

export function normalizeBenchmarkAccount(account: BenchmarkAccountDTO): BenchmarkAccountView {
  const { userId, ...rest } = account;

  return {
    ...rest,
    createdByUserId: userId,
  };
}

export function normalizeBenchmarkAccounts(
  accounts: BenchmarkAccountDTO[],
): BenchmarkAccountView[] {
  return accounts.map(normalizeBenchmarkAccount);
}

export function normalizeBenchmarkAccountDetail(
  account: BenchmarkAccountDetailDTO,
): BenchmarkAccountDetailView {
  const { userId, ...rest } = account;

  return {
    ...rest,
    createdByUserId: userId,
  };
}

export interface DouyinLoginSessionDTO {
  id: string;
  purpose: DouyinLoginSessionPurpose;
  status: DouyinLoginSessionStatus;
  currentStep: DouyinLoginSessionCurrentStep;
  qrcodeDataUrl: string | null;
  expiresAt: string | null;
  resolvedSecUserId: string | null;
  accountId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  message: string;
}
