import type { NamedPoll } from "../ens/pollName";

const labels = {
  en: {
    OPEN: "Open",
    UPCOMING: "Upcoming",
    CLOSED: "Closed",
    INVALID_WINDOW: "Window not configured",
    UNKNOWN: "Schedule unknown",
  },
  es: {
    OPEN: "Abierta",
    UPCOMING: "Próxima",
    CLOSED: "Cerrada",
    INVALID_WINDOW: "Ventana no configurada",
    UNKNOWN: "Horario desconocido",
  },
};

export function pollStatusLabel(status: NamedPoll["status"] | "UNKNOWN", language: "en" | "es"): string {
  return labels[language][status];
}

export function isVoteOpen(status: NamedPoll["status"] | undefined): boolean {
  return status === "OPEN";
}
