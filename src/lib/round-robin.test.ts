import assert from "node:assert/strict";
import test from "node:test";
import { buildRoundRobin, computeStandings, roundRobinMatchCount, roundRobinRoundCount } from "./round-robin";

for (const count of [2, 3, 4, 5, 8, 16]) {
  test(`pontos corridos gera todos os confrontos para ${count} jogadores`, () => {
    const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
    const matches = buildRoundRobin(players);
    assert.equal(matches.length, roundRobinMatchCount(count));
    assert.equal(Math.max(...matches.map((m) => m.round)), roundRobinRoundCount(count));

    const pairs = new Set<string>();
    for (const match of matches) {
      const pair = [match.player1Id, match.player2Id].sort().join(":");
      assert.equal(pairs.has(pair), false, `confronto duplicado: ${pair}`);
      pairs.add(pair);
      const sameRound = matches.filter((m) => m.round === match.round);
      assert.equal(
        sameRound.filter((m) => m.player1Id === match.player1Id || m.player2Id === match.player1Id).length,
        1,
      );
    }
  });
}

test("ida e volta inverte os mandos e dobra confrontos/rodadas", () => {
  const matches = buildRoundRobin(["a", "b", "c", "d"], 2);
  assert.equal(matches.length, 12);
  assert.equal(Math.max(...matches.map((m) => m.round)), 6);
  const first = matches[0]!;
  assert.ok(matches.some((m) => m.player1Id === first.player2Id && m.player2Id === first.player1Id));
});

test("classificação usa pontos, vitórias, saldo e seed", () => {
  const table = computeStandings(
    [
      { id: "a", nickname: "A", seed: 2 },
      { id: "b", nickname: "B", seed: 1 },
      { id: "c", nickname: "C", seed: 3 },
    ],
    [
      { player1Id: "a", player2Id: "b", winnerId: "a", status: "COMPLETED", resultType: "NORMAL", player1Score: 2, player2Score: 1 },
      { player1Id: "a", player2Id: "c", winnerId: null, status: "COMPLETED", resultType: "DRAW", player1Score: 1, player2Score: 1 },
      { player1Id: "b", player2Id: "c", winnerId: "b", status: "COMPLETED", resultType: "WALKOVER", player1Score: 1, player2Score: 0 },
    ],
    { win: 3, draw: 1, loss: 0 },
  );
  assert.deepEqual(table.map((r) => [r.id, r.points]), [["a", 4], ["b", 3], ["c", 1]]);
});
