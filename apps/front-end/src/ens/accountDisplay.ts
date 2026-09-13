/** Truncated address for UI. A missing ENS name always falls back to this. */
export function shortAddress(account: string) {
  if (account.length < 10) return account;
  return `${account.slice(0, 6)}…${account.slice(-4)}`;
}

/** Prefer a verified profile name; never treat a missing name as a vote blocker. */
export function accountLabel(account: string, name: string | null | undefined) {
  return name || shortAddress(account);
}
