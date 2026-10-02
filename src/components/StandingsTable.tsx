export type StandingsViewRow = {
  id: string;
  position: number;
  nickname: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
};

export function StandingsTable({ rows, allowDraw }: { rows: StandingsViewRow[]; allowDraw: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-stone-500">A classificação aparece depois do sorteio.</p>;
  return (
    <div className="overflow-x-auto rounded-sm border border-gold-600/40">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-black/50 font-display text-[11px] uppercase tracking-wider text-gold-300">
          <tr>
            <th className="px-3 py-2 text-center">#</th>
            <th className="px-3 py-2 text-left">Jogador</th>
            <th className="px-2 py-2 text-center" title="Jogos">J</th>
            <th className="px-2 py-2 text-center" title="Vitórias">V</th>
            {allowDraw && <th className="px-2 py-2 text-center" title="Empates">E</th>}
            <th className="px-2 py-2 text-center" title="Derrotas">D</th>
            <th className="px-2 py-2 text-center" title="Saldo de games">SG</th>
            <th className="px-3 py-2 text-center">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold-600/20">
          {rows.map((row) => (
            <tr key={row.id} className={row.position <= 3 ? "bg-gold-400/[0.05]" : "bg-black/20"}>
              <td className="px-3 py-2.5 text-center font-display font-bold text-gold-300">{row.position}</td>
              <td className="px-3 py-2.5 font-semibold text-gold-100">{row.nickname}</td>
              <td className="px-2 py-2.5 text-center text-stone-300">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-emerald-300">{row.wins}</td>
              {allowDraw && <td className="px-2 py-2.5 text-center text-stone-300">{row.draws}</td>}
              <td className="px-2 py-2.5 text-center text-crimson-300">{row.losses}</td>
              <td className="px-2 py-2.5 text-center text-stone-300">{row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference}</td>
              <td className="px-3 py-2.5 text-center font-display text-lg font-black text-gold-200">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
