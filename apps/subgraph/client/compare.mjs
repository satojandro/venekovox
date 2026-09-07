import { readGovernance } from "./governance.mjs";

// Set these privately; Graph gateway URLs can contain API keys. Never print URLs.
const maci = process.env.MACI_GRAPH_URL,
  governor = process.env.GOVERNOR_GRAPH_URL;
if (!maci || !governor) {
  console.error("Set MACI_GRAPH_URL and GOVERNOR_GRAPH_URL to live provider endpoints. No fixture fallback.");
  process.exitCode = 1;
} else {
  try {
    const sources = await Promise.all([
      readGovernance({ endpoint: maci, kind: "maci", label: "VenekoVox MACI" }),
      readGovernance({ endpoint: governor, kind: "governor", label: "Reference Governor" }),
    ]);
    console.log(
      JSON.stringify(
        {
          question: "What can we observe about recent proposals across private and public governance?",
          methodology:
            "Shared proposal identity/provenance fields; source-specific metrics. No cross-system turnout ranking.",
          result: sources,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
