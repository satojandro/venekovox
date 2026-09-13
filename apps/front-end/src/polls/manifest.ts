/**
 * Operator poll presets. Question text is never stored on the Poll contract.
 * Do not invent a poll ID: Hermes supplies the live deployment.
 */

export const ORIGINAL_SEPOLIA_MACI = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
export const FLAGSHIP_PRESET = "superintelligence-v1";
/** MACI Mode.FULL — one person, one credit, one counted choice. */
export const MODE_FULL = 2;
export const FLAGSHIP_VOTE_OPTIONS = 3;
export const FRANCE_VOTE_OPTIONS = 6;

/**
 * ZKPassport @0.16.2 CountryName strings. The SDK list uses
 * "Czech Republic", not "Czechia". The United Kingdom is not included.
 */
export const FLAGSHIP_NATIONALITIES = [
  "United States",
  "Canada",
  "Australia",
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
] as const;

export type PollRound = "open" | "rehearsal";

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function isOriginalProtectedPoll(maciAddress: string, pollId: string): boolean {
  if (!sameAddress(maciAddress, ORIGINAL_SEPOLIA_MACI)) return false;
  try {
    return BigInt(pollId) < 2n;
  } catch {
    return true;
  }
}

export function readPollRound(value: string | undefined): PollRound {
  return value?.trim() === "rehearsal" ? "rehearsal" : "open";
}

export function flagshipAllowlistCsv(): string {
  return FLAGSHIP_NATIONALITIES.join(",");
}
