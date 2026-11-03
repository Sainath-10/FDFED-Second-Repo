export type BracketSlot = { teamId?: string; seed?: number; source?: string; bye?: boolean };
export type BracketNode = {
  key: string; round: string; roundIndex: number; position: number;
  bracketSize: number; roundCount: number; sides: [BracketSlot, BracketSlot];
  destination: { key: string; slot: 1 | 2 } | null;
};

export function bracketRoundLabel(round: number, roundCount: number): string {
  const remaining = 2 ** (roundCount - round + 1);
  return ({ 2: 'Final', 4: 'Semifinal', 8: 'Quarterfinal' })[remaining] || `Round of ${remaining}`;
}

/** Seed 1 and 2 meet only in the final; strongest seeds receive the empty slots. */
export function seedPositions(size: number): number[] {
  if (size === 1) return [1];
  let order = [1, 2];
  for (let width = 4; width <= size; width *= 2) order = order.flatMap((seed) => [seed, width + 1 - seed]);
  return order;
}

/** Pure fixture topology: no scores, questions, dates, or result rules. */
export function buildBracket(teamIds: string[]): BracketNode[] {
  if (new Set(teamIds).size !== teamIds.length) throw new Error('Every registered team must have a unique seed.');
  if (teamIds.length < 2) return [];
  const size = 2 ** Math.ceil(Math.log2(teamIds.length));
  const count = Math.log2(size);
  const nodes: BracketNode[] = [];
  let slots: BracketSlot[] = seedPositions(size).map((seed) => teamIds[seed - 1] ? { teamId: teamIds[seed - 1], seed } : { bye: true });
  for (let round = 1; slots.length > 1; round++) {
    const next: BracketSlot[] = [];
    const label = bracketRoundLabel(round, count);
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i], b = slots[i + 1];
      const position = i / 2 + 1;
      const key = `r${round}-m${position}`;
      nodes.push({ key, round: label, roundIndex: round, position, bracketSize: size, roundCount: count, sides: [a, b], destination: round === count ? null : { key: `r${round + 1}-m${Math.ceil(position / 2)}`, slot: position % 2 ? 1 : 2 } });
      next.push({ source: key });
    }
    slots = next;
  }
  return nodes;
}
