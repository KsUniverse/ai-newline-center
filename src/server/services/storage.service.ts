import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

class StorageService {
  async downloadAndStore(url: string, category: string): Promise<string> {
    const parsedUrl = this.parseUrl(url);

    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`资源下载失败: ${response.status}`);
    }

    const storagePath = this.generatePath(
      category,
      url,
      response.headers.get("content-type"),
      parsedUrl,
    );
    const filePath = path.join(process.cwd(), "public", storagePath);

    console.info(`[StorageService] 待下载: ${url} → ${storagePath}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);

    return `/${storagePath}`;
  }

  private generatePath(
    category: string,
    url: string,
    contentType?: string | null,
    parsedUrl?: URL | null,
  ): string {
    const date = new Date().toISOString().slice(0, 10);
    const filename = this.extractFilename(url, contentType, parsedUrl);

    return `storage/${category}/${date}/${filename}`;
  }

  private extractFilename(
    url: string,
    contentType?: string | null,
    parsedUrl?: URL | null,
  ): string {
    try {
      const targetUrl = parsedUrl ?? new URL(url);
      const filename = targetUrl.pathname.split("/").filter(Boolean).pop();
      if (filename && filename.length > 0 && filename.includes(".")) {
        return filename;
      }

      const ext = this.inferExtension(targetUrl, contentType);
      return `${createHash("md5").update(url).digest("hex")}.${ext}`;
    } catch {
      return "file.bin";
    }
  }

  private inferExtension(url: URL, contentType?: string | null): string {
    const normalized = url.pathname.toLowerCase();

    if (normalized.endsWith(".mp4")) return "mp4";
    if (normalized.endsWith(".gif")) return "gif";
    if (normalized.endsWith(".png")) return "png";
    if (normalized.endsWith(".webp")) return "webp";
    if (normalized.endsWith(".jpeg")) return "jpeg";
    if (normalized.endsWith(".jpg")) return "jpg";

    const mimeType = url.searchParams.get("mime_type")?.toLowerCase();
    if (mimeType === "video_mp4" || mimeType === "video/mp4") return "mp4";
    if (mimeType === "image_gif" || mimeType === "image/gif") return "gif";
    if (mimeType === "image_png" || mimeType === "image/png") return "png";
    if (mimeType === "image_webp" || mimeType === "image/webp") return "webp";
    if (mimeType === "image_jpeg" || mimeType === "image/jpeg") return "jpeg";
    if (mimeType === "image_jpg" || mimeType === "image/jpg") return "jpg";

    const normalizedContentType = contentType?.toLowerCase() ?? "";
    if (normalizedContentType.includes("video/mp4")) return "mp4";
    if (normalizedContentType.includes("image/gif")) return "gif";
    if (normalizedContentType.includes("image/png")) return "png";
    if (normalizedContentType.includes("image/webp")) return "webp";
    if (normalizedContentType.includes("image/jpeg")) return "jpeg";
    if (normalizedContentType.includes("image/jpg")) return "jpg";

    return "bin";
  }

  private parseUrl(url: string): URL | null {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }
}

export const storageService = new StorageService();
