const META_QUERY = `query Meta { _meta { block { number hash } hasIndexingErrors } }`;

const LEAVES_QUERY = `
  query StateLeaves($maci: Bytes!, $first: Int!, $cursor: BigInt!, $block: Int!) {
    _meta { block { number hash } hasIndexingErrors }
    stateLeaves(
      first: $first
      orderBy: stateIndex
      orderDirection: asc
      where: { maci: $maci, stateIndex_gt: $cursor }
      block: { number: $block }
    ) {
      id stateIndex publicKeyX publicKeyY timestamp
    }
  }
`;

const POLL_QUERY = `
  query PollJoinedCount($id: ID!, $block: Int!) {
    _meta { block { number hash } hasIndexingErrors }
    poll(id: $id, block: { number: $block }) {
      id pollId registrationCount startDate endDate voteOptions
    }
  }
`;

export interface GraphMeta {
  block: { number: number; hash: string };
  hasIndexingErrors?: boolean;
}

export async function graphQuery<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`GraphQL HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    if (!json.data) {
      throw new Error("GraphQL response missing data.");
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMeta(url: string, timeoutMs: number): Promise<GraphMeta> {
  const data = await graphQuery<{ _meta: GraphMeta }>(url, META_QUERY, {}, timeoutMs);
  return data._meta;
}

export async function fetchLeafPage(
  url: string,
  timeoutMs: number,
  args: { maci: string; first: number; cursor: string; block: number },
): Promise<{ _meta: GraphMeta; stateLeaves: { stateIndex: string; publicKeyX: string; publicKeyY: string }[] }> {
  return graphQuery(url, LEAVES_QUERY, args, timeoutMs);
}

export async function fetchPollStats(
  url: string,
  timeoutMs: number,
  args: { id: string; block: number },
): Promise<{
  _meta: GraphMeta;
  poll: { registrationCount: string; pollId: string; startDate?: string; endDate?: string } | null;
}> {
  return graphQuery(url, POLL_QUERY, args, timeoutMs);
}
