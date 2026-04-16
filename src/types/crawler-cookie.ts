export interface CrawlerCookieDTO {
  id: string;
  valueRedacted: string;
  createdAt: string;
}

export interface CreateCrawlerCookieInput {
  value: string;
}

export interface DeleteCrawlerCookiesInput {
  ids: string[];
}
