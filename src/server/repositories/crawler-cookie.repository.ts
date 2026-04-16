import { prisma } from "@/lib/prisma";
import { decryptCookieValue, encryptCookieValue } from "@/lib/crypto";
import type { CrawlerCookieDTO } from "@/types/crawler-cookie";

function maskCookieValue(plaintext: string): string {
  if (plaintext.length <= 30) return plaintext.slice(0, 3) + "...";
  return plaintext.slice(0, 20) + "..." + plaintext.slice(-10);
}

class CrawlerCookieRepository {
  /** 查询全量记录并返回脱敏 DTO（按 createdAt ASC） */
  async findAllByOrganization(organizationId: string): Promise<CrawlerCookieDTO[]> {
    const records = await prisma.crawlerCookie.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });

    return records.map((record) => {
      const plaintext = decryptCookieValue(record.value);
      return {
        id: record.id,
        valueRedacted: maskCookieValue(plaintext),
        createdAt: record.createdAt.toISOString(),
      };
    });
  }

  /** 内部使用：返回原始加密 value（不解密），用于 CrawlerService 读取后自行解密 */
  async findRawByOrganization(
    organizationId: string,
  ): Promise<Array<{ id: string; value: string }>> {
    const records = await prisma.crawlerCookie.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, value: true },
    });
    return records;
  }

  /** 加密后创建，返回脱敏 DTO */
  async create(organizationId: string, plaintextValue: string): Promise<CrawlerCookieDTO> {
    const encryptedValue = encryptCookieValue(plaintextValue);
    const record = await prisma.crawlerCookie.create({
      data: {
        organizationId,
        value: encryptedValue,
      },
    });
    return {
      id: record.id,
      valueRedacted: maskCookieValue(plaintextValue),
      createdAt: record.createdAt.toISOString(),
    };
  }

  /** 单条删除（含 organizationId 校验，防越权） */
  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await prisma.crawlerCookie.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return false;

    await prisma.crawlerCookie.delete({ where: { id } });
    return true;
  }

  /** 批量删除（WHERE id IN (...) AND organizationId = ?），返回实际删除数量 */
  async deleteMany(ids: string[], organizationId: string): Promise<number> {
    const result = await prisma.crawlerCookie.deleteMany({
      where: { id: { in: ids }, organizationId },
    });
    return result.count;
  }
}

export const crawlerCookieRepository = new CrawlerCookieRepository();
