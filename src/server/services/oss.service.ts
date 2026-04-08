import { createHmac } from "node:crypto";

import { env } from "@/lib/env";

/**
 * 阿里云 OSS 上传服务
 *
 * 使用 OSS REST API + HMAC-SHA1 签名，无需额外 SDK 依赖。
 * 配置方式: 在环境变量中设置以下三项即可启用:
 *   OSS_ACCESS_KEY_ID
 *   OSS_ACCESS_KEY_SECRET
 *   OSS_ACCESS_BUCKET_ENDPOINT  # 格式: https://bucket-name.oss-cn-hangzhou.aliyuncs.com
 */
class OssService {
  /** 当前是否已配置 OSS（三项缺一不可） */
  isConfigured(): boolean {
    return !!(
      env.OSS_ACCESS_KEY_ID &&
      env.OSS_ACCESS_KEY_SECRET &&
      env.OSS_ACCESS_BUCKET_ENDPOINT
    );
  }

  /**
   * 上传 Buffer 到 OSS
   * @param key        OSS 对象键，如 storage/covers/2024-01-01/image.jpg
   * @param buffer     文件内容
   * @param contentType  MIME 类型，如 image/jpeg
   * @returns    文件的公开访问 URL
   */
  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const endpoint = env.OSS_ACCESS_BUCKET_ENDPOINT!;
    const accessKeyId = env.OSS_ACCESS_KEY_ID!;
    const accessKeySecret = env.OSS_ACCESS_KEY_SECRET!;

    const bucket = this.parseBucket(endpoint);
    const date = new Date().toUTCString();

    // OSS 签名: HMAC-SHA1(StringToSign, AccessKeySecret)
    // StringToSign = Verb + \n + Content-MD5 + \n + Content-Type + \n + Date + \n + CanonicalizedResource
    const stringToSign = `PUT\n\n${contentType}\n${date}\n/${bucket}/${key}`;
    const signature = createHmac("sha1", accessKeySecret)
      .update(stringToSign)
      .digest("base64");

    const url = `${endpoint.replace(/\/$/, "")}/${key}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `OSS ${accessKeyId}:${signature}`,
        "Content-Type": contentType,
        Date: date,
        "Content-Length": String(buffer.byteLength),
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OSS 上传失败: ${response.status} ${body}`);
    }

    return url;
  }

  private parseBucket(endpoint: string): string {
    try {
      const hostname = new URL(endpoint).hostname; // bucket-name.oss-cn-hangzhou.aliyuncs.com
      const bucket = hostname.split(".")[0];
      if (!bucket) throw new Error("empty bucket");
      return bucket;
    } catch {
      throw new Error(`OSS_ACCESS_BUCKET_ENDPOINT 格式不正确: ${endpoint}`);
    }
  }
}

export const ossService = new OssService();
