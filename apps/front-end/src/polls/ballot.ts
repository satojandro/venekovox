import type { PollDescriptor, PollOption } from "./descriptor";

/**
 * Use the option's stored numeric index, never its display position.
 * Silently mapping "first row → 0" is how Yes/No overwrote a six-option poll.
 */
export function ballotIndex(options: readonly PollOption[], selected: number | null): number | null {
  if (selected === null) return null;
  const option = options.find((item) => item.index === selected);
  return option ? option.index : null;
}

export function canSubmitBallot(args: {
  options: readonly PollOption[];
  selected: number | null;
  locked: boolean;
  busy: boolean;
}): boolean {
  return ballotIndex(args.options, args.selected) !== null && !args.locked && !args.busy;
}

export function assertBallotIndex(descriptor: PollDescriptor, selected: number): number {
  const index = ballotIndex(descriptor.options, selected);
  if (index === null) {
    throw new Error("That choice is not on this ballot.");
  }
  return index;
}
