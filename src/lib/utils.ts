import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function proxyImageUrl(originalUrl: string): string {
  if (!originalUrl) return "";
  // 本地路径（本地存储模式）
  if (originalUrl.startsWith("/")) return originalUrl;
  if (originalUrl.startsWith("storage/")) return `/${originalUrl}`;
  // 完整 URL：douyinpic.com 需要 referer 绕过代理，其他（如 OSS）直接返回
  try {
    const { hostname } = new URL(originalUrl);
    if (hostname.endsWith("douyinpic.com")) {
      return `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
    }
    return originalUrl;
  } catch {
    return `/api/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  }
}

export function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString("zh-CN");
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatRelativeTime(date: string | Date | null): string {
  if (date === null) return "尚未同步";
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;

  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}
