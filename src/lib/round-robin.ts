export type RoundRobinMatch = {
  round: number;
  position: number;
  player1Id: string;
  player2Id: string;
};

export type StandingsMatch = {
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "BYE" | "CANCELLED";
  resultType: "NORMAL" | "DRAW" | "WALKOVER" | "DISQUALIFICATION" | null;
  player1Score: number | null;
  player2Score: number | null;
};

export type StandingsRow = {
  id: string;
  nickname: string;
  seed: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
};

export function roundRobinMatchCount(playerCount: number, turns = 1): number {
  return Math.max(0, (playerCount * (playerCount - 1)) / 2) * turns;
}

export function roundRobinRoundCount(playerCount: number, turns = 1): number {
  if (playerCount < 2) return 0;
  return (playerCount % 2 === 0 ? playerCount - 1 : playerCount) * turns;
}

/** Método circular: cada dupla se enfrenta uma vez por turno e ninguém joga duas vezes na rodada. */
export function buildRoundRobin(playerIds: string[], turns = 1): RoundRobinMatch[] {
  if (playerIds.length < 2) throw new Error("São necessários pelo menos 2 jogadores.");
  if (turns !== 1 && turns !== 2) throw new Error("Pontos corridos aceita um ou dois turnos.");

  const rotating: (string | null)[] = [...playerIds];
  if (rotating.length % 2 !== 0) rotating.push(null);
  const roundsPerTurn = rotating.length - 1;
  const firstTurn: RoundRobinMatch[] = [];

  for (let round = 0; round < roundsPerTurn; round++) {
    let position = 0;
    for (let i = 0; i < rotating.length / 2; i++) {
      const left = rotating[i];
      const right = rotating[rotating.length - 1 - i];
      if (!left || !right) continue;
      const swap = round % 2 === 1;
      firstTurn.push({
        round: round + 1,
        position: position++,
        player1Id: swap ? right : left,
        player2Id: swap ? left : right,
      });
    }
    const fixed = rotating[0]!;
    const rest = rotating.slice(1);
    rest.unshift(rest.pop()!);
    rotating.splice(0, rotating.length, fixed, ...rest);
  }

  if (turns === 1) return firstTurn;
  return [
    ...firstTurn,
    ...firstTurn.map((m) => ({
      round: m.round + roundsPerTurn,
      position: m.position,
      player1Id: m.player2Id,
      player2Id: m.player1Id,
    })),
  ];
}

export function computeStandings(
  participants: { id: string; nickname: string; seed: number }[],
  matches: StandingsMatch[],
  points: { win: number; draw: number; loss: number },
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(
    participants.map((p) => [
      p.id,
      {
        ...p,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
      },
    ]),
  );

  for (const match of matches) {
    if (match.status !== "COMPLETED" || !match.player1Id || !match.player2Id) continue;
    const p1 = rows.get(match.player1Id);
    const p2 = rows.get(match.player2Id);
    if (!p1 || !p2) continue;
    p1.played++;
    p2.played++;
    const s1 = match.player1Score ?? 0;
    const s2 = match.player2Score ?? 0;
    p1.scoreFor += s1;
    p1.scoreAgainst += s2;
    p2.scoreFor += s2;
    p2.scoreAgainst += s1;

    if (match.resultType === "DRAW") {
      p1.draws++;
      p2.draws++;
      p1.points += points.draw;
      p2.points += points.draw;
    } else if (match.winnerId === p1.id) {
      p1.wins++;
      p2.losses++;
      p1.points += points.win;
      p2.points += points.loss;
    } else if (match.winnerId === p2.id) {
      p2.wins++;
      p1.losses++;
      p2.points += points.win;
      p1.points += points.loss;
    }
  }

  for (const row of rows.values()) row.scoreDifference = row.scoreFor - row.scoreAgainst;
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.scoreDifference - a.scoreDifference ||
      b.scoreFor - a.scoreFor ||
      a.seed - b.seed ||
      a.nickname.localeCompare(b.nickname),
  );
}
