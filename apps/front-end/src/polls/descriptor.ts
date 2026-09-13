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
};

export type EnvLike = Record<string, string | undefined>;

function readEnv(env: EnvLike, key: string): string {
  return (env[key] ?? "").trim();
}

/**
 * Operator-supplied metadata bound to the configured MACI poll.
 * MACI does not store the question text. Do not treat this as on-chain copy.
 *
 * Poll 3 is the flagship judge-engagement poll open for 24 hours.
 * Poll 1 was the French presidential election demo (6 options).
 */
export function readConfiguredDescriptor(env: EnvLike): PollDescriptor | null {
  const chainId = readEnv(env, "VITE_CHAIN_ID");
  const maciAddress = readEnv(env, "VITE_MACI_ADDRESS");
  const pollId = readEnv(env, "VITE_POLL_ID");
  if (!/^(0|[1-9][0-9]{0,77})$/.test(chainId) || !/^0x[0-9a-fA-F]{40}$/.test(maciAddress)) {
    return null;
  }
  if (!/^(0|[1-9][0-9]{0,77})$/.test(pollId)) return null;

  // Poll-specific metadata — question, description and options vary per poll.
  const pollMeta: Record<string, { question: LocaleText; description: LocaleText; options: PollOption[] }> = {
    "3": {
      question: {
        en: "Should development of superintelligence be paused?",
        es: "¿Debería pausarse el desarrollo de la superinteligencia?",
      },
      description: {
        en: "Eligibility: verified people worldwide (ZKPassport, one vote per person). Your ballot is encrypted and anonymous — no one can see how you voted. This is a live opinion poll on a question affecting all of humanity.",
        es: "Elegibilidad: personas verificadas del mundo (ZKPassport, un voto por persona). Tu voto es cifrado y anónimo — nadie puede ver cómo votaste. Esta es una encuesta de opinión en vivo sobre una pregunta que afecta a toda la humanidad.",
      },
      options: [
        { index: 0, label: { en: "Yes, pause it", es: "Sí, pausar" } },
        { index: 1, label: { en: "No, keep going", es: "No, seguir adelante" } },
        { index: 2, label: { en: "Unsure", es: "No estoy seguro" } },
      ],
    },
    "1": {
      question: {
        en: "Who do you support for the next French presidential election? (Poll 1)",
        es: "¿A quién apoyas para las próximas elecciones presidenciales de Francia? (Encuesta 1)",
      },
      description: {
        en: "Eligibility: verified citizens 18+ (ZKPassport, one vote per person). Demo gate: Australian passports (operator\u2019s available document). The question text is operator metadata. It is not stored on the Poll contract. Read the voting window from the chain before treating this as an open poll.",
        es: "Elegibilidad: ciudadanos verificados 18+ (ZKPassport, un voto por persona). Puerta de demo: pasaportes australianos (disponible del operador). El texto de la pregunta es metadato del operador. No est\u00e1 guardado en el contrato Poll.",
      },
      options: [
        { index: 0, label: { en: "Marine Le Pen", es: "Marine Le Pen" } },
        { index: 1, label: { en: "\u00c9douard Philippe", es: "\u00c9douard Philippe" } },
        { index: 2, label: { en: "Jean-Luc M\u00e9lenchon", es: "Jean-Luc M\u00e9lenchon" } },
        { index: 3, label: { en: "Jordan Bardella", es: "Jordan Bardella" } },
        { index: 4, label: { en: "Gabriel Attal", es: "Gabriel Attal" } },
        { index: 5, label: { en: "Other / None of these", es: "Otro / Ninguno de estos" } },
      ],
    },
  };

  const meta = pollMeta[pollId] ?? {
    question: {
      en: `Poll ${pollId} \u2014 open on Sepolia`,
      es: `Encuesta ${pollId} \u2014 abierta en Sepolia`,
    },
    description: {
      en: "This poll's question metadata has not been configured for the current poll ID.",
      es: "Los metadatos de esta encuesta no se han configurado para el ID de encuesta actual.",
    },
    options: [],
  };

  return {
    schemaVersion: 1,
    chainId,
    maciAddress,
    pollId,
    metadataSource: "operator",
    question: meta.question,
    description: meta.description,
    options: meta.options,
  };
}

export function viteDescriptorEnv(): EnvLike {
  return {
    VITE_CHAIN_ID: import.meta.env.VITE_CHAIN_ID,
    VITE_MACI_ADDRESS: import.meta.env.VITE_MACI_ADDRESS,
    VITE_POLL_ID: import.meta.env.VITE_POLL_ID,
  };
}
