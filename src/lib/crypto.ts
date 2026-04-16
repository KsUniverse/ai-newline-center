import * as nodeCrypto from "node:crypto";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * 加密 Cookie 明文，返回格式：<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptCookieValue(plaintext: string): string {
  const key = Buffer.from(env.CRAWLER_COOKIE_ENCRYPTION_KEY, "hex");
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * 解密 Cookie 密文，格式：<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * 解密失败抛 AppError("CRYPTO_ERROR", "Cookie 解密失败", 500)
 */
export function decryptCookieValue(encrypted: string): string {
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) {
      throw new AppError("CRYPTO_ERROR", "Cookie 解密失败", 500);
    }

    const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
    const key = Buffer.from(env.CRAWLER_COOKIE_ENCRYPTION_KEY, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("CRYPTO_ERROR", "Cookie 解密失败", 500);
  }
}
