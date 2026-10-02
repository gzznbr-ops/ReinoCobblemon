/**
 * Chaves de eliminação simples — módulo PURO (sem banco).
 *
 * - Tamanho = próxima potência de 2; quem sobra recebe "bye" (avança direto).
 * - Seeding padrão (1 × último, 2 × penúltimo…), então byes ficam com os
 *   primeiros da lista e dois byes nunca se enfrentam.
 * - `propagate` recalcula quem joga cada partida a partir dos vencedores; se um
 *   resultado anterior muda, os resultados que dependiam dele são apagados.
 */

export type BracketMatch = {
  round: number;
  position: number;
  isThirdPlace: boolean;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
};

export function totalRounds(playerCount: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, playerCount))));
}

/** Ordem dos seeds nas posições da primeira rodada: [1, 8, 4, 5, 2, 7, 3, 6] para 8. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((seed) => [seed, n + 1 - seed]);
  }
  return order;
}

/** Monta todas as partidas. `playerIds` já na ordem de seed (1º da lista = seed 1). */
export function buildBracket(playerIds: string[], thirdPlaceMatch: boolean): BracketMatch[] {
  if (playerIds.length < 2) throw new Error("São necessários pelo menos 2 jogadores.");
  const rounds = totalRounds(playerIds.length);
  const size = 2 ** rounds;
  const order = seedOrder(size);
  const matches: BracketMatch[] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 0; position < count; position++) {
      const match: BracketMatch = { round, position, isThirdPlace: false, player1Id: null, player2Id: null, winnerId: null };
      if (round === 1) {
        match.player1Id = playerIds[order[position * 2]! - 1] ?? null;
        match.player2Id = playerIds[order[position * 2 + 1]! - 1] ?? null;
      }
      matches.push(match);
    }
  }
  if (thirdPlaceMatch && rounds >= 2) {
    matches.push({ round: rounds, position: 1, isThirdPlace: true, player1Id: null, player2Id: null, winnerId: null });
  }
  return propagate(matches);
}

const key = (round: number, position: number) => `${round}:${position}`;

function loserOf(m: BracketMatch | undefined): string | null {
  if (!m?.winnerId || !m.player1Id || !m.player2Id) return null;
  return m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
}

/** Recalcula jogadores/vencedores de todas as rodadas (não altera o array recebido). */
export function propagate(input: BracketMatch[]): BracketMatch[] {
  const matches = input.map((m) => ({ ...m }));
  const rounds = Math.max(...matches.map((m) => m.round));
  const byKey = new Map(matches.filter((m) => !m.isThirdPlace).map((m) => [key(m.round, m.position), m]));

  const sorted = [...matches].sort((a, b) => a.round - b.round || Number(a.isThirdPlace) - Number(b.isThirdPlace) || a.position - b.position);
  for (const m of sorted) {
    if (m.round > 1 && !m.isThirdPlace) {
      m.player1Id = byKey.get(key(m.round - 1, m.position * 2))?.winnerId ?? null;
      m.player2Id = byKey.get(key(m.round - 1, m.position * 2 + 1))?.winnerId ?? null;
    }
    if (m.isThirdPlace) {
      m.player1Id = loserOf(byKey.get(key(rounds - 1, 0)));
      m.player2Id = loserOf(byKey.get(key(rounds - 1, 1)));
    }

    const players = [m.player1Id, m.player2Id].filter((p): p is string => p !== null);
    if (m.round === 1 && players.length === 1) {
      // Bye: avança automaticamente
      m.winnerId = players[0]!;
    } else if (players.length < 2 || (m.winnerId && !players.includes(m.winnerId))) {
      m.winnerId = null;
    }
  }
  return matches;
}

export function isBye(m: BracketMatch): boolean {
  return m.round === 1 && (m.player1Id === null) !== (m.player2Id === null);
}

export function roundName(round: number, rounds: number, isThirdPlace = false): string {
  if (isThirdPlace) return "Disputa de 3º lugar";
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quartas de final";
  if (fromEnd === 3) return "Oitavas de final";
  return `${round}ª rodada`;
}

/** Colocação final (quando decidida). */
export function standings(matches: BracketMatch[]): { first: string | null; second: string | null; third: string[] } {
  if (matches.length === 0) return { first: null, second: null, third: [] };
  const rounds = Math.max(...matches.map((m) => m.round));
  const final = matches.find((m) => m.round === rounds && !m.isThirdPlace);
  const thirdMatch = matches.find((m) => m.isThirdPlace);
  let third: string[] = [];
  if (thirdMatch) third = thirdMatch.winnerId ? [thirdMatch.winnerId] : [];
  else if (rounds >= 2) {
    third = matches
      .filter((m) => m.round === rounds - 1 && !m.isThirdPlace)
      .map(loserOf)
      .filter((p): p is string => p !== null);
  }
  return { first: final?.winnerId ?? null, second: loserOf(final), third };
}

export function isBracketComplete(matches: BracketMatch[]): boolean {
  return matches.length > 0 && matches.every((m) => m.winnerId !== null);
}

/** Embaralhamento Fisher–Yates com aleatoriedade criptográfica. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0]! % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
