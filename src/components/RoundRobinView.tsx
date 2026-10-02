"use client";

import type { BracketViewMatch } from "./BracketView";
import type { StandingsViewRow } from "./StandingsTable";

function MatchCard({ match, onSelect }: { match: BracketViewMatch; onSelect?: (match: BracketViewMatch) => void }) {
  const clickable = Boolean(onSelect);
  const Tag = clickable ? "button" : "div";
  const row = (player: BracketViewMatch["player1"]) => {
    const won = player && match.winnerId === player.id;
    const draw = player && match.resultType === "DRAW" && match.status === "COMPLETED";
    const lost = player && match.status === "COMPLETED" && !won && !draw;
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-2 ${won ? "bg-gold-400/15" : ""}`}>
        <span className={`truncate ${won ? "font-bold text-gold-100" : lost ? "text-stone-500" : "text-stone-200"}`}>{player?.nickname ?? "a definir"}</span>
        {won && <span className="text-gold-400">♛</span>}
        {draw && <span className="text-xs text-stone-400">empate</span>}
      </div>
    );
  };
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={clickable ? () => onSelect!(match) : undefined}
      className={`block w-full overflow-hidden rounded-sm border bg-black/45 text-left ${match.status === "COMPLETED" ? "border-gold-600/80" : "border-gold-600/35"} ${clickable ? "hover:border-gold-400" : ""}`}
    >
      {row(match.player1)}
      <div className="h-px bg-gold-600/25" />
      {row(match.player2)}
      {(match.score || match.scheduledAt || match.resultType === "WALKOVER" || match.resultType === "DISQUALIFICATION") && (
        <div className="flex justify-between gap-2 border-t border-gold-600/20 px-3 py-1 text-[11px] text-stone-400">
          <span>{match.scheduledAt ?? (match.resultType === "WALKOVER" ? "W.O." : match.resultType === "DISQUALIFICATION" ? "Desclassificação" : "")}</span>
          {match.score && <strong className="text-gold-300">{match.score}</strong>}
        </div>
      )}
    </Tag>
  );
}

export function RoundRobinView({ matches, participants, onSelect }: { matches: BracketViewMatch[]; participants: StandingsViewRow[]; onSelect?: (match: BracketViewMatch) => void }) {
  if (matches.length === 0) return null;
  const roundNumbers = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {roundNumbers.map((round) => {
        const roundMatches = matches.filter((m) => m.round === round).sort((a, b) => a.position - b.position);
        const playing = new Set(roundMatches.flatMap((m) => [m.player1?.id, m.player2?.id]).filter(Boolean));
        const bye = participants.find((p) => !playing.has(p.id));
        return (
          <section key={round} className="panel-soft space-y-2 p-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold-300">{round}ª rodada</h3>
            {roundMatches.map((match) => <MatchCard key={match.id} match={match} onSelect={onSelect} />)}
            {bye && <p className="px-2 pt-1 text-xs italic text-stone-500">Folga: {bye.nickname}</p>}
          </section>
        );
      })}
    </div>
  );
}
