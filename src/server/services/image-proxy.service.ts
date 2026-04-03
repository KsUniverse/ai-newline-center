import { AppError } from "@/lib/errors";

const ALLOWED_IMAGE_HOSTS = [
  "p3-pc.douyinpic.com",
  "p6-pc.douyinpic.com",
  "p9-pc.douyinpic.com",
  "p3-sign.douyinpic.com",
  "p6-sign.douyinpic.com",
  "p26-sign.douyinpic.com",
] as const;

class ImageProxyService {
  proxyImage(rawUrl: string): Promise<Response> {
    const parsedUrl = this.parseAndValidateUrl(rawUrl);
    return this.fetchImage(parsedUrl);
  }

  private parseAndValidateUrl(rawUrl: string): URL {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new AppError("VALIDATION_ERROR", "图片地址不合法", 400);
    }

    if (parsedUrl.protocol !== "https:") {
      throw new AppError("FORBIDDEN", "仅允许 HTTPS 图片地址", 403);
    }

    if (!ALLOWED_IMAGE_HOSTS.includes(parsedUrl.hostname as (typeof ALLOWED_IMAGE_HOSTS)[number])) {
      throw new AppError("FORBIDDEN", "不允许代理该图片地址", 403);
    }

    return parsedUrl;
  }

  private async fetchImage(parsedUrl: URL): Promise<Response> {
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
  }
}

export const imageProxyService = new ImageProxyService();
