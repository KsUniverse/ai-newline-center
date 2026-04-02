import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-response";

const ALLOWED_IMAGE_HOSTS = [
  "p3-pc.douyinpic.com",
  "p6-pc.douyinpic.com",
  "p9-pc.douyinpic.com",
  "p3-sign.douyinpic.com",
  "p6-sign.douyinpic.com",
  "p26-sign.douyinpic.com",
];

function isAllowedImageHost(hostname: string): boolean {
  return ALLOWED_IMAGE_HOSTS.includes(hostname);
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      throw new AppError("UNAUTHORIZED", "请先登录", 401);
    }

    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      throw new AppError("VALIDATION_ERROR", "缺少 url 参数", 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new AppError("VALIDATION_ERROR", "图片地址不合法", 400);
    }

    if (parsedUrl.protocol !== "https:") {
      throw new AppError("FORBIDDEN", "仅允许 HTTPS 图片地址", 403);
    }

    if (!isAllowedImageHost(parsedUrl.hostname)) {
      throw new AppError("FORBIDDEN", "不允许代理该图片地址", 403);
    }

    const response = await fetch(parsedUrl, {
      headers: {
        Referer: "https://www.douyin.com/",
      },
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
