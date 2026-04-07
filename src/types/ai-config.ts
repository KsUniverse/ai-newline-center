export type AiStep = "TRANSCRIBE" | "DECOMPOSE" | "REWRITE";

/** 视频输入方式，决定转录时如何传递视频文件 */
export type AiVideoInputMode =
  | "NONE"            // 纯文本模型，不支持转录
  | "DASHSCOPE_FILE"  // 上传文件到 DashScope OSS，以 oss:// URL 传入（千问 VL 系列）
  | "GOOGLE_FILE";    // 上传到 Google Files API（Google AI Studio）

export interface AiModelConfigDTO {
  id: string;
  name: string;
  baseUrl: string;
  /** API Key，读取时脱敏仅显示末4位 */
  apiKeyMasked: string;
  modelName: string;
  videoInputMode: AiVideoInputMode;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAiModelConfigInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  videoInputMode: AiVideoInputMode;
}

export interface UpdateAiModelConfigInput {
  name?: string;
  baseUrl?: string;
  /** 传入新 key 则覆盖；null 或省略则保留原有 key */
  apiKey?: string | null;
  modelName?: string;
  videoInputMode?: AiVideoInputMode;
}

export interface AiStepBindingDTO {
  step: AiStep;
  modelConfigId: string | null;
  modelConfig?: AiModelConfigDTO | null;
}

export interface AiSettingsDTO {
  bindings: AiStepBindingDTO[];
  modelConfigs: AiModelConfigDTO[];
}

export interface UpdateAiSettingsInput {
  bindings: Array<{ step: AiStep; modelConfigId: string | null }>;
}
