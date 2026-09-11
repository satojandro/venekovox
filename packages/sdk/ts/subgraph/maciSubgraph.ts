/* eslint-disable no-underscore-dangle, no-await-in-loop */
import { padKey, PublicKey } from "@maci-protocol/domainobjs";

import type { GraphQLMeta, GraphQLResponse, StateLeafRecord } from "./types";

const DEFAULT_PAGE = 1000;

const META_QUERY = `
  query Meta {
    _meta {
      block { number hash }
      hasIndexingErrors
    }
  }
`;

const LEAVES_QUERY = `
  query StateLeaves($maci: Bytes!, $first: Int!, $cursor: BigInt!, $block: Int!) {
    _meta {
      block { number hash }
      hasIndexingErrors
    }
    stateLeaves(
      first: $first
      orderBy: stateIndex
      orderDirection: asc
      where: { maci: $maci, stateIndex_gt: $cursor }
      block: { number: $block }
    ) {
      id
      stateIndex
      publicKeyX
      publicKeyY
      timestamp
    }
  }
`;

export const assertContiguousSignupIndexes = (leaves: StateLeafRecord[]): void => {
  for (let i = 0; i < leaves.length; i += 1) {
    const expected = BigInt(i + 1);
    if (BigInt(leaves[i].stateIndex) !== expected) {
      throw new Error(`signup index gap at ${i}: expected ${expected}, got ${leaves[i].stateIndex}`);
    }
  }
};

/**
 * Indexed MACI SignUp leaves. Pages are pinned to one block; PAD is prepended by getKeys().
 */
export class MaciSubgraph {
  private url: string;

  private pageSize: number;

  private timeoutMs: number;

  constructor(url: string, pageSize = DEFAULT_PAGE, timeoutMs = 8000) {
    this.url = url;
    this.pageSize = pageSize;
    this.timeoutMs = timeoutMs;
  }

  async request(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        body: JSON.stringify({ query, variables }),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`GraphQL query failed: ${res.statusText}`);
      }

      const json = (await res.json()) as GraphQLResponse;
      if (json.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  async readMeta(): Promise<GraphQLMeta> {
    const json = await this.request(META_QUERY);
    const meta = json.data?._meta;
    if (!meta?.block.number) {
      throw new Error("Subgraph _meta is missing.");
    }
    if (meta.hasIndexingErrors) {
      throw new Error("Subgraph hasIndexingErrors is true.");
    }
    return meta;
  }

  async getStateLeaves(
    maciAddress: string,
    blockNumber?: number,
  ): Promise<{ leaves: StateLeafRecord[]; meta: GraphQLMeta }> {
    const meta = blockNumber ? { block: { number: blockNumber }, hasIndexingErrors: false } : await this.readMeta();
    const leaves: StateLeafRecord[] = [];
    let cursor = 0n;
    for (;;) {
      const json = await this.request(LEAVES_QUERY, {
        maci: maciAddress.toLowerCase(),
        first: this.pageSize,
        cursor: cursor.toString(),
        block: meta.block.number,
      });
      if (json.data?._meta?.hasIndexingErrors) {
        throw new Error("Subgraph hasIndexingErrors is true.");
      }
      const page = json.data?.stateLeaves ?? [];
      leaves.push(...page);
      if (page.length < this.pageSize) {
        break;
      }
      cursor = BigInt(page[page.length - 1].stateIndex);
    }
    assertContiguousSignupIndexes(leaves);
    return { leaves, meta };
  }

  /**
   * Public keys including the PAD key at index 0, in signup order.
   */
  async getKeys(maciAddress?: string): Promise<PublicKey[]> {
    if (!maciAddress) {
      // Legacy users(createdAt) path is unsafe for LeanIMT order.
      throw new Error("MaciSubgraph.getKeys requires the MACI address.");
    }
    const { leaves } = await this.getStateLeaves(maciAddress);
    const userKeys = leaves.map((leaf) => new PublicKey([BigInt(leaf.publicKeyX), BigInt(leaf.publicKeyY)]));
    userKeys.unshift(padKey);
    return userKeys;
  }
}
