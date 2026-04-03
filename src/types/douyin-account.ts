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
  type: "MY_ACCOUNT" | "BENCHMARK_ACCOUNT";
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
