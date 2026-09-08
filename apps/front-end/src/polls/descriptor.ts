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
 */
export function readConfiguredDescriptor(env: EnvLike): PollDescriptor | null {
  const chainId = readEnv(env, "VITE_CHAIN_ID");
  const maciAddress = readEnv(env, "VITE_MACI_ADDRESS");
  const pollId = readEnv(env, "VITE_POLL_ID");
  if (!/^(0|[1-9][0-9]{0,77})$/.test(chainId) || !/^0x[0-9a-fA-F]{40}$/.test(maciAddress)) {
    return null;
  }
  if (!/^(0|[1-9][0-9]{0,77})$/.test(pollId)) return null;

  return {
    schemaVersion: 1,
    chainId,
    maciAddress,
    pollId,
    metadataSource: "operator",
    question: {
      en: `Configured Sepolia poll (Poll ${pollId})`,
      es: `Encuesta configurada en Sepolia (Poll ${pollId})`,
    },
    description: {
      en: "The question text is operator metadata. It is not stored on the Poll contract. Read the voting window from the chain before treating this as an open poll.",
      es: "El texto de la pregunta es metadato del operador. No está guardado en el contrato Poll. Lee la ventana de votación en la cadena antes de tratarla como abierta.",
    },
    options: [
      { index: 0, label: { en: "Yes", es: "Sí" } },
      { index: 1, label: { en: "No", es: "No" } },
      { index: 2, label: { en: "Abstain", es: "Abstenerse" } },
    ],
  };
}

export function viteDescriptorEnv(): EnvLike {
  return {
    VITE_CHAIN_ID: import.meta.env.VITE_CHAIN_ID,
    VITE_MACI_ADDRESS: import.meta.env.VITE_MACI_ADDRESS,
    VITE_POLL_ID: import.meta.env.VITE_POLL_ID,
  };
}
