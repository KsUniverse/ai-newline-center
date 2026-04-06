export type AiStep = "TRANSCRIBE" | "DECOMPOSE" | "REWRITE";

export interface AiStepBindingDTO {
  step: AiStep;
  implementationKey: string | null;
  name?: string | null;
  provider?: string | null;
  available?: boolean;
  requiredEnvKeys?: string[];
}

export interface AiImplementationDTO {
  key: string;
  name: string;
  provider?: string;
  supportedSteps: AiStep[];
  available: boolean;
  missingEnvKeys?: string[];
  requiredEnvKeys?: string[];
}

export interface AiSettingsDTO {
  steps: AiStepBindingDTO[];
  bindings: AiStepBindingDTO[];
  implementations: AiImplementationDTO[];
}

export interface UpdateAiSettingsInput {
  steps?: AiStepBindingDTO[];
  bindings?: AiStepBindingDTO[];
}
