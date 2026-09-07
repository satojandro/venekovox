/** Product read adapter; public data only. Reusable by the UI or an agent tool. */
export const COMMON_FIELDS = `id txnHash description creationBlock creationTime
  governanceFramework { id name type contractAddress }`;
export const COMMON_QUERY = `query Governance($first: Int!) {
  proposals(first: $first, orderBy: creationTime, orderDirection: desc) { ${COMMON_FIELDS} }
  _meta { block { number hash } hasIndexingErrors }
}`;
export function queryFor(kind) {
  if (kind !== "maci" && kind !== "governor") throw new Error("Unsupported governance source");
  const fields =
    kind === "maci"
      ? `startTime endTime ballotPrivacy coordinatorTrust tallyStatus
    registrationCount publishedMessageCount offchainBatchCount voteOptionCapacity votingMode`
      : "state forWeightedVotes againstWeightedVotes abstainWeightedVotes totalWeightedVotes";
  return COMMON_QUERY.replace(COMMON_FIELDS, `${COMMON_FIELDS} ${fields}`);
}
function integer(value, label) {
  if (typeof value !== "string" || !/^\d{1,78}$/.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}
export function normalize(data, kind, label) {
  if (!data?._meta || data._meta.hasIndexingErrors !== false || !Number.isSafeInteger(data._meta.block?.number)) {
    throw new Error("Indexer metadata missing or indexing errors reported");
  }
  if (!Array.isArray(data.proposals)) throw new Error("Missing proposals");
  return {
    source: label,
    indexedBlock: data._meta.block.number,
    indexedBlockHash: data._meta.block.hash ?? null,
    proposals: data.proposals.map((p) => {
      if (!p.governanceFramework?.contractAddress || !p.id || !p.txnHash)
        throw new Error("Missing proposal provenance");
      const common = {
        id: p.id,
        creationTransaction: p.txnHash,
        description: p.description ?? null,
        creationBlock: integer(p.creationBlock, "creationBlock"),
        creationTime: integer(p.creationTime, "creationTime"),
        framework: p.governanceFramework,
      };
      if (kind === "maci") {
        if (
          p.ballotPrivacy !== "ENCRYPTED" ||
          p.coordinatorTrust !== "COORDINATOR_CAN_DECRYPT" ||
          p.tallyStatus !== "UNAVAILABLE"
        ) {
          throw new Error("Unsupported MACI privacy/result semantics; upgrade the adapter explicitly");
        }
        return {
          ...common,
          ballotPrivacy: p.ballotPrivacy,
          coordinatorTrust: p.coordinatorTrust,
          results: null,
          resultStatus: "UNAVAILABLE",
          registrationCount: integer(p.registrationCount, "registrations"),
          publishedMessageCount: integer(p.publishedMessageCount, "publications"),
          offchainBatchCount: integer(p.offchainBatchCount, "batches"),
          startTime: integer(p.startTime, "startTime"),
          endTime: integer(p.endTime, "endTime"),
          voteOptionCapacity: integer(p.voteOptionCapacity, "capacity"),
          votingMode: integer(p.votingMode, "mode"),
          participationMeaning:
            "Registered poll keys and published commands; neither is unique-human turnout or counted ballots.",
        };
      }
      if (kind !== "governor") throw new Error("Unsupported governance source");
      return {
        ...common,
        ballotPrivacy: "PUBLIC",
        coordinatorTrust: "NONE",
        resultStatus: "PUBLIC_TOTALS_NOT_INDEPENDENTLY_FINALIZED",
        state: p.state,
        results: {
          for: integer(p.forWeightedVotes, "for"),
          against: integer(p.againstWeightedVotes, "against"),
          abstain: integer(p.abstainWeightedVotes, "abstain"),
          total: integer(p.totalWeightedVotes, "total"),
        },
        participationMeaning: "Governance voting-weight units; not people and not comparable to MACI command counts.",
      };
    }),
  };
}
export async function readGovernance({ endpoint, kind, label, first = 5, fetchImpl = fetch }) {
  if (!Number.isInteger(first) || first < 1 || first > 100) throw new Error("first must be 1..100");
  if (!["http:", "https:"].includes(new URL(endpoint).protocol)) throw new Error("Expected HTTP(S) Graph endpoint");
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: queryFor(kind), variables: { first } }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Graph request failed (endpoint omitted to protect API credentials)");
  }
  if (!response.ok) throw new Error(`Graph HTTP ${response.status}`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Graph response is not JSON");
  }
  if (body.errors?.length) throw new Error("GraphQL errors returned; partial data rejected");
  return normalize(body.data, kind, label);
}
