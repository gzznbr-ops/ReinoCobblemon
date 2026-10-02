"use client";

import { roundName } from "@/lib/bracket";

export type BracketPlayer = { id: string; nickname: string };

export type BracketViewMatch = {
  id: string;
  round: number;
  position: number;
  isThirdPlace: boolean;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  winnerId: string | null;
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "BYE" | "CANCELLED";
  resultType: "NORMAL" | "DRAW" | "WALKOVER" | "DISQUALIFICATION" | null;
  player1Score: number | null;
  player2Score: number | null;
  score: string | null;
  scheduledAt: string | null;
};

function PlayerRow({
  player,
  match,
  highlight,
}: {
  player: BracketPlayer | null;
  match: BracketViewMatch;
  highlight?: string | null;
}) {
  const won = player && match.winnerId === player.id;
  const lost = player && match.winnerId && match.winnerId !== player.id;
  const bye = !player && match.round === 1;
  const isHighlighted = player && highlight && player.nickname.toLowerCase() === highlight.toLowerCase();
  return (
    <div
      className={`flex min-h-9 items-center justify-between gap-2 px-2.5 py-1.5 text-sm ${
        won ? "bg-gold-400/15" : ""
      } ${isHighlighted ? "ring-1 ring-inset ring-crimson-400" : ""}`}
    >
      <span
        className={`truncate ${won ? "font-bold text-gold-100" : lost ? "text-stone-500 line-through decoration-stone-600" : player ? "text-stone-200" : "italic text-stone-600"}`}
      >
        {player ? player.nickname : bye ? "bye" : "a definir"}
      </span>
      {won && (
        <span className="shrink-0 text-gold-400" aria-label="vencedor">
          ♛
        </span>
      )}
    </div>
  );
}

export function BracketView({
  matches,
  onSelect,
  highlight,
}: {
  matches: BracketViewMatch[];
  /** Admin: clique em uma partida para lançar resultado */
  onSelect?: (match: BracketViewMatch) => void;
  highlight?: string | null;
}) {
  if (matches.length === 0) return null;
  const rounds = Math.max(...matches.map((m) => m.round));
  const columns = Array.from({ length: rounds }, (_, i) =>
    matches.filter((m) => m.round === i + 1 && !m.isThirdPlace).sort((a, b) => a.position - b.position),
  );
  const third = matches.find((m) => m.isThirdPlace);

  const card = (m: BracketViewMatch) => {
    const clickable = Boolean(onSelect) && m.player1 && m.player2;
    const Tag = clickable ? "button" : "div";
    return (
      <Tag
        key={m.id}
        type={clickable ? "button" : undefined}
        onClick={clickable ? () => onSelect!(m) : undefined}
        className={`block w-full overflow-hidden rounded-sm border bg-black/50 text-left transition ${
          m.winnerId ? "border-gold-600/80" : "border-gold-600/40"
        } ${clickable ? "cursor-pointer hover:border-gold-400 hover:shadow-[0_0_14px_rgb(212_175_55/0.35)]" : ""}`}
      >
        <PlayerRow player={m.player1} match={m} highlight={highlight} />
        <div className="h-px bg-gold-600/30" />
        <PlayerRow player={m.player2} match={m} highlight={highlight} />
        {(m.score || m.scheduledAt) && (
          <div className="flex justify-between gap-2 border-t border-gold-600/20 bg-black/40 px-2.5 py-1 text-[11px] text-stone-400">
            <span>{m.scheduledAt ?? ""}</span>
            {m.score && <span className="font-semibold text-gold-300">{m.score}</span>}
          </div>
        )}
      </Tag>
    );
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-5">
        {columns.map((column, index) => {
          const round = index + 1;
          return (
            <div key={round} className="flex w-52 flex-col">
              <p className="mb-3 text-center font-display text-xs font-bold uppercase tracking-wider text-gold-400">
                {roundName(round, rounds)}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {column.map(card)}
                {round === rounds && third && (
                  <div className="mt-6">
                    <p className="mb-2 text-center font-display text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      {roundName(round, rounds, true)}
                    </p>
                    {card(third)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
