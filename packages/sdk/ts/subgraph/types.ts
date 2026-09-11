export interface GraphQLMeta {
  block: { number: number; hash?: string | null };
  hasIndexingErrors?: boolean;
}

export interface StateLeafRecord {
  id: string;
  stateIndex: string;
  publicKeyX: string;
  publicKeyY: string;
  timestamp?: string;
}

export interface GraphQLResponse {
  data?: {
    users?: { id: string }[];
    stateLeaves?: StateLeafRecord[];
    poll?: {
      id: string;
      pollId: string;
      registrationCount: string;
      startDate?: string;
      endDate?: string;
      voteOptions?: string;
    };
    _meta?: GraphQLMeta;
  };
  errors?: { message: string }[];
}
