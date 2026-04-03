class StorageService {
  async downloadAndStore(url: string, category: string): Promise<string> {
    const storagePath = this.generatePath(category, url);
    console.info(`[StorageService] 待下载: ${url} → ${storagePath}`);
    return storagePath;
  }

  private generatePath(category: string, url: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const filename = this.extractFilename(url);

    return `storage/${category}/${date}/${filename}`;
  }

  private extractFilename(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const filename = parsedUrl.pathname.split("/").filter(Boolean).pop();
      return filename && filename.length > 0 ? filename : "file.bin";
    } catch {
      return "file.bin";
    }
  }
}

export const storageService = new StorageService();
