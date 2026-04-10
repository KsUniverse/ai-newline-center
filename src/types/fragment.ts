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

export interface ListFragmentsParams {
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface CreateFragmentsResult {
  created: number;
  items: FragmentDTO[];
}
