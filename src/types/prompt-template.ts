import type { PromptStepType } from "@prisma/client";

export type { PromptStepType };

export interface PromptTemplateDTO {
  id: string;
  name: string;
  stepType: PromptStepType;
  systemContent: string | null;
  content: string;
  modelConfigId: string | null;
  modelConfigName: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptTemplateInput {
  name: string;
  stepType: PromptStepType;
  systemContent?: string | null;
  content: string;
  modelConfigId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  systemContent?: string | null;
  content?: string;
  modelConfigId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ListPromptTemplatesParams {
  stepType?: PromptStepType;
  isActive?: boolean;
}
