import {
  ORIGINAL_SEPOLIA_MACI,
  FLAGSHIP_PRESET,
  FLAGSHIP_VOTE_OPTIONS,
  FRANCE_VOTE_OPTIONS,
  MODE_FULL,
  isOriginalProtectedPoll,
  readPollRound,
  type PollRound,
} from "./manifest";

export type LocaleText = { en: string; es: string };

export type PollOption = {
  index: number;
  label: LocaleText;
};

export type PollDescriptor = {
  schemaVersion: 1;
  chainId: string;
  maciAddress: string;
  pollId: string;
  question: LocaleText;
  description: LocaleText;
  options: PollOption[];
  metadataSource: "operator";
  topic?: string;
  eligibilityLabel?: string;
  preset?: typeof FLAGSHIP_PRESET;
  expectedVoteOptions: number;
  expectedMode: number;
  expectedPollAddress?: string;
  round: PollRound;
};

export type EnvLike = Record<string, string | undefined>;

function readEnv(env: EnvLike, key: string): string {
  return (env[key] ?? "").trim();
}

function franceDescriptor(
  chainId: string,
  maciAddress: string,
  pollId: string,
  round: PollRound,
  expectedPollAddress?: string,
): PollDescriptor {
  return {
    schemaVersion: 1,
    chainId,
    maciAddress,
    pollId,
    metadataSource: "operator",
    expectedVoteOptions: FRANCE_VOTE_OPTIONS,
    expectedMode: MODE_FULL,
    expectedPollAddress,
    round,
    topic: "FRANCE 2027",
    eligibilityLabel: "Verified citizens, age 18+",
    question: {
      en: `Who do you support for the next French presidential election? (Poll ${pollId})`,
      es: `¿A quién apoyas para las próximas elecciones presidenciales de Francia? (Encuesta ${pollId})`,
    },
    description: {
      en: "Eligibility: verified citizens 18+ (ZKPassport, one vote per person). Demo gate: Australian passports (operator's available document). The question text is operator metadata. It is not stored on the Poll contract. Read the voting window from the chain before treating this as an open poll.",
      es: "Elegibilidad: ciudadanos verificados 18+ (ZKPassport, un voto por persona). Puerta de demo: pasaportes australianos (documento disponible del operador). El texto de la pregunta es metadato del operador. No está guardado en el contrato Poll. Lee la ventana de votación en la cadena antes de tratarla como abierta.",
    },
    options: [
      { index: 0, label: { en: "Marine Le Pen", es: "Marine Le Pen" } },
      { index: 1, label: { en: "Édouard Philippe", es: "Édouard Philippe" } },
      { index: 2, label: { en: "Jean-Luc Mélenchon", es: "Jean-Luc Mélenchon" } },
      { index: 3, label: { en: "Jordan Bardella", es: "Jordan Bardella" } },
      { index: 4, label: { en: "Gabriel Attal", es: "Gabriel Attal" } },
      { index: 5, label: { en: "Other / None of these", es: "Otro / Ninguno de estos" } },
    ],
  };
}

function flagshipDescriptor(
  chainId: string,
  maciAddress: string,
  pollId: string,
  round: PollRound,
  expectedPollAddress?: string,
): PollDescriptor {
  return {
    schemaVersion: 1,
    chainId,
    maciAddress,
    pollId,
    metadataSource: "operator",
    preset: FLAGSHIP_PRESET,
    expectedVoteOptions: FLAGSHIP_VOTE_OPTIONS,
    expectedMode: MODE_FULL,
    expectedPollAddress,
    round,
    topic: "AI & SOCIETY",
    eligibilityLabel: "US, Canada, Australia, and EU citizens · age 18+",
    question: {
      en: "Do you support a global ban on developing artificial superintelligence?",
      es: "¿Apoyas una prohibición mundial del desarrollo de superinteligencia artificial?",
    },
    description: {
      en: "For this poll, artificial superintelligence means AI that substantially exceeds human abilities across almost all intellectual tasks. A global ban means countries agreeing to prohibit its development, rather than a temporary pause or a ban on all AI. This is a broad policy question, not an endorsement of every provision in a particular bill. Eligible participants: citizens of the United States, Canada, Australia or an EU member state, age 18+, verified through ZKPassport. Nationality is checked from the document; this does not establish residence. The United Kingdom is not included.",
      es: "En esta encuesta, superinteligencia artificial significa IA que supera ampliamente las capacidades humanas en casi todas las tareas intelectuales. Una prohibición mundial significa un acuerdo entre países para prohibir su desarrollo, no una pausa temporal ni una prohibición de toda la IA. Es una pregunta de política amplia, no un respaldo de cada cláusula de un proyecto de ley. Participantes: ciudadanos de Estados Unidos, Canadá, Australia o un país de la UE, mayores de 18 años, verificados con ZKPassport. La nacionalidad del documento no acredita residencia. El Reino Unido no está incluido.",
    },
    options: [
      { index: 0, label: { en: "Support", es: "A favor" } },
      { index: 1, label: { en: "Oppose", es: "En contra" } },
      { index: 2, label: { en: "Unsure", es: "No estoy seguro/a" } },
    ],
  };
}

/**
 * Operator-supplied metadata bound to the configured MACI poll.
 * MACI does not store the question text. Do not treat this as on-chain copy.
 */
export function readConfiguredDescriptor(env: EnvLike): PollDescriptor | null {
  const chainId = readEnv(env, "VITE_CHAIN_ID");
  const maciAddress = readEnv(env, "VITE_MACI_ADDRESS");
  const pollId = readEnv(env, "VITE_POLL_ID");
  if (!/^(0|[1-9][0-9]{0,77})$/.test(chainId) || !/^0x[0-9a-fA-F]{40}$/.test(maciAddress)) {
    return null;
  }
  if (!/^(0|[1-9][0-9]{0,77})$/.test(pollId)) return null;

  const preset = readEnv(env, "VITE_POLL_PRESET");
  const round = readPollRound(readEnv(env, "VITE_POLL_ROUND"));
  const expectedPollAddress = readEnv(env, "VITE_POLL_ADDRESS");
  const boundAddress = /^0x[0-9a-fA-F]{40}$/.test(expectedPollAddress) ? expectedPollAddress : undefined;

  if (preset && preset !== FLAGSHIP_PRESET) return null;

  // Preserve main's deployed poll 3 question; a pause is not a development ban.
  if (chainId === "11155111" && maciAddress.toLowerCase() === ORIGINAL_SEPOLIA_MACI.toLowerCase() && pollId === "3") {
    const descriptor = flagshipDescriptor(chainId, maciAddress, pollId, round, boundAddress);
    return {
      ...descriptor,
      preset: undefined,
      eligibilityLabel: "Worldwide participation · ZKPassport verification; active policy applies",
      question: { en: "Should development of superintelligence be paused?", es: "¿Debería pausarse el desarrollo de la superinteligencia?" },
      description: {
        en: "A question about pausing superintelligence development. Participation requires ZKPassport verification under the active poll policy. Ballots are encrypted; the MACI coordinator can decrypt them. Question text is operator metadata, and availability is checked against the chain.",
        es: "Una pregunta sobre pausar el desarrollo de la superinteligencia. Se requiere verificación con ZKPassport según la política activa. Los votos se cifran; el coordinador MACI puede descifrarlos. La pregunta es metadato del operador y la disponibilidad se comprueba en la cadena."
      },
      options: [
        { index: 0, label: { en: "Yes, pause it", es: "Sí, pausar" } },
        { index: 1, label: { en: "No, keep going", es: "No, seguir adelante" } },
        { index: 2, label: { en: "Unsure", es: "No estoy seguro" } }
      ]
    };
  }

  if (preset === FLAGSHIP_PRESET) {
    // Never relabel the two existing polls on the original Sepolia MACI.
    if (isOriginalProtectedPoll(maciAddress, pollId)) return null;
    return flagshipDescriptor(chainId, maciAddress, pollId, round, boundAddress);
  }

  if (pollId !== "0" && pollId !== "1") {
    return {
      ...franceDescriptor(chainId, maciAddress, pollId, round, boundAddress),
      topic: "POLL", eligibilityLabel: "Check the configured policy",
      question: { en: `Poll ${pollId}`, es: `Encuesta ${pollId}` },
      description: { en: "This poll’s question metadata has not been configured.", es: "Los metadatos de esta encuesta no están configurados." },
      options: [], expectedVoteOptions: 0
    };
  }
  return franceDescriptor(chainId, maciAddress, pollId, round, boundAddress);
}

export function viteDescriptorEnv(): EnvLike {
  return {
    VITE_CHAIN_ID: import.meta.env.VITE_CHAIN_ID,
    VITE_MACI_ADDRESS: import.meta.env.VITE_MACI_ADDRESS,
    VITE_POLL_ID: import.meta.env.VITE_POLL_ID,
    VITE_POLL_PRESET: import.meta.env.VITE_POLL_PRESET,
    VITE_POLL_ADDRESS: import.meta.env.VITE_POLL_ADDRESS,
    VITE_POLL_ROUND: import.meta.env.VITE_POLL_ROUND,
  };
}
