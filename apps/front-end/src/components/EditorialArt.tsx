const illustrations = {
  problem: {
    file: "v3-problem",
    caption: "THE COST OF AN HONEST ANSWER",
    alt: "Resistance collage of a censored face behind bars, surveillance camera, empty seats, a tilted scale and a manipulated ballot box.",
  },
  "ai-objects": {
    file: "v3-flagship",
    caption: "WHO GETS TO DECIDE WHAT COMES NEXT?",
    alt: "Halftone collage of a brain wired to a microchip, a globe, circuit boards and a hand holding a ballot.",
  },
  "france-objects": {
    file: "v3-france",
    caption: "FRANCE / YOUR PERSPECTIVE",
    alt: "Ballot box, paper and French civic architecture in a torn-paper collage.",
  },
  "brazil-objects": {
    file: "v3-brazil",
    caption: "BRAZIL / YOUR PERSPECTIVE",
    alt: "Electronic voting machine, paper and Brazilian civic architecture in a torn-paper collage.",
  },
  gathering: {
    file: "v3-problem",
    caption: "WHY INDEPENDENT VOICES MATTER",
    alt: "Resistance collage of censorship, surveillance, exclusion and manipulated polling.",
  },
  introduction: {
    file: "v3-name",
    caption: "A NAME YOU CAN OWN",
    alt: "A hand grips a key beside a blank name card, registry drawer and computer window.",
  },
  proof: {
    file: "v3-proof",
    caption: "A PROOF, NOT A PUBLIC PASSPORT",
    alt: "Hands hold a redacted passport and a scanning phone; a small proof token emerges from the device.",
  },
  ballot: {
    file: "v3-maci",
    caption: "ENCRYPT THE CHOICE. VERIFY THE COUNT.",
    alt: "A ballot passes through a cipher machine as sealed envelopes emerge, linked to a proof prism and inspection lens.",
  },
  records: {
    file: "v3-graph",
    caption: "FOLLOW THE RECORD",
    alt: "A magnifying glass, linked paper records, card catalog and computer terminal represent inspecting public evidence.",
  },
};

export type EditorialScene = keyof typeof illustrations;

/** Illustrative content only; never a verification, transaction or result indicator. */
export function EditorialArt({ scene, compact = false }: { scene: EditorialScene; compact?: boolean }) {
  const art = illustrations[scene];
  return (
    <figure className={`editorial-figure${compact ? " editorial-compact" : ""}`}>
      <img src={`/story/${art.file}.jpg`} alt={art.alt} width={1536} height={1024} loading="lazy" decoding="async" />
      <figcaption>
        <span>{art.caption}</span>
        <span>AI-GENERATED EDITORIAL ILLUSTRATION</span>
      </figcaption>
    </figure>
  );
}
