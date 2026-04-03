export interface DouyinAccountDTO {
  id: string;
  profileUrl: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
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
  followersCount: number;
  videosCount: number;
}

export interface DouyinVideoDTO {
  id: string;
  videoId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  tags: string[];
  createdAt: string;
}

export interface DouyinVideoWithAccountDTO extends DouyinVideoDTO {
  accountNickname: string;
  accountAvatar: string;
}
