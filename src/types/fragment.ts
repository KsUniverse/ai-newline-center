export interface FragmentDTO {
  id: string;
  content: string;
  organizationId: string;
  createdByUserId: string;
  createdByUser: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface CreateFragmentsInput {
  contents: string[];
}

export type FragmentScope = "today" | "history";

export interface ListFragmentsParams {
  q?: string;
  cursor?: string;
  limit?: number;
  scope?: FragmentScope;
}

export interface CreateFragmentsResult {
  created: number;
  items: FragmentDTO[];
}
