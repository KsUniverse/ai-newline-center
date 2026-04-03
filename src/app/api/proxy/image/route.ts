import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-response";
import { imageProxyService } from "@/server/services/image-proxy.service";

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
    return imageProxyService.proxyImage(rawUrl);
  } catch (error) {
    return handleApiError(error);
  }
}
