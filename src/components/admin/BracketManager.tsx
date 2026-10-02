"use client";

import { withBase } from "@/lib/base-path";
import { useState } from "react";
import { BracketView, type BracketViewMatch } from "@/components/BracketView";
import { RoundRobinView } from "@/components/RoundRobinView";
import { StandingsTable, type StandingsViewRow } from "@/components/StandingsTable";
import { roundName } from "@/lib/bracket";
import { useAdminAction } from "./useAdminAction";

type Props = {
  tournamentId: string;
  competitionFormat: "SINGLE_ELIMINATION" | "ROUND_ROBIN";
  roundRobinTurns: number;
  allowDraw: boolean;
  thirdPlaceMatch: boolean;
  matches: BracketViewMatch[];
  /** valor datetime-local de cada partida agendada */
  scheduledInputs: Record<string, string>;
  approved: { id: string; nickname: string }[];
  podium: { first: string | null; second: string | null; third: string[] };
  standings: StandingsViewRow[];
  progress: { completed: number; total: number };
  canGenerate: boolean;
  generateBlockedReason: string | null;
};

export function BracketManager(props: Props) {
  const { confirm, run, busy, error, setError, dialog } = useAdminAction();
  const [seeding, setSeeding] = useState<"random" | "registration">("random");
  const [selected, setSelected] = useState<BracketViewMatch | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [resultType, setResultType] = useState<"NORMAL" | "DRAW" | "WALKOVER" | "DISQUALIFICATION">("NORMAL");
  const [score, setScore] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");
  const [highlight, setHighlight] = useState("");

  const url = withBase(`/api/admin/tournaments/${encodeURIComponent(props.tournamentId)}/bracket`);
  const rounds = props.matches.length ? Math.max(...props.matches.map((m) => m.round)) : 0;
  const hasResults = props.matches.some((m) => m.winnerId && m.player1 && m.player2);
  const firstRoundPlayers = props.matches
    .filter((m) => m.round === 1)
    .flatMap((m) => [m.player1, m.player2])
    .filter((p): p is { id: string; nickname: string } => p !== null)
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  function open(match: BracketViewMatch) {
    setError(null);
    setSelected(match);
    setWinnerId(match.winnerId);
    setResultType(match.resultType ?? "NORMAL");
    setScore(match.score ?? "");
    setScheduledAt(props.scheduledInputs[match.id] ?? "");
  }

  async function saveResult() {
    if (!selected) return;
    const hasResult = Boolean(winnerId) || resultType === "DRAW";
    const resultChanged = hasResult && (winnerId !== selected.winnerId || resultType !== (selected.resultType ?? "NORMAL") || score.trim() !== (selected.score ?? ""));
    const ok = resultChanged
      ? await run({ url, method: "POST", body: { action: "report", matchId: selected.id, winnerId, resultType, score: score.trim() || undefined } })
      : true;
    const scheduleChanged = (props.scheduledInputs[selected.id] ?? "") !== scheduledAt;
    const ok2 = ok && scheduleChanged
      ? await run({ url, method: "POST", body: { action: "schedule", matchId: selected.id, scheduledAt: scheduledAt || null } })
      : ok;
    if (ok2) setSelected(null);
  }

  if (props.matches.length === 0) {
    return (
      <div className="space-y-5">
        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="heading text-lg text-gold-200">{props.competitionFormat === "ROUND_ROBIN" ? "Sortear confrontos" : "Gerar chaves"}</h2>
          <p className="text-sm text-stone-300">
            Entram somente inscrições <strong className="text-emerald-300">APROVADAS</strong> (pago + time verificado + formato
            verificado). {props.competitionFormat === "ROUND_ROBIN"
              ? `Todos se enfrentam ${props.roundRobinTurns === 2 ? "duas vezes (ida e volta)" : "uma vez"}; a classificação é automática.`
              : `Eliminação simples; se o número de jogadores não for potência de 2, os primeiros da lista recebem bye.${props.thirdPlaceMatch ? " Inclui disputa de 3º lugar." : ""}`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["random", "Sorteio", "Posições embaralhadas aleatoriamente."],
                ["registration", "Ordem de inscrição", "Quem se inscreveu primeiro é o seed 1."],
              ] as const
            ).map(([value, title, text]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-sm border p-3 ${seeding === value ? "border-gold-400 bg-gold-400/10" : "border-gold-600/40"}`}
              >
                <input type="radio" name="seeding" className="mt-1 accent-yellow-500" checked={seeding === value} onChange={() => setSeeding(value)} />
                <span>
                  <span className="block font-semibold text-gold-100">{title}</span>
                  <span className="block text-xs text-stone-400">{text}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="label mb-1">Aprovados ({props.approved.length})</p>
          {props.approved.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhum inscrito aprovado ainda.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {props.approved.map((p) => (
                <li key={p.id} className="rounded-sm border border-gold-600/40 bg-black/30 px-2 py-1 text-sm text-gold-100">
                  {p.nickname}
                </li>
              ))}
            </ul>
          )}
          {props.generateBlockedReason && <p className="text-sm text-gold-200">{props.generateBlockedReason}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="button"
            className="btn-primary w-full py-3"
            disabled={!props.canGenerate}
            onClick={() =>
              confirm({
                options: {
                  title: props.competitionFormat === "ROUND_ROBIN" ? "Sortear confrontos?" : "Gerar chaves?",
                  message: `${props.approved.length} jogadores, ${seeding === "random" ? "ordem sorteada" : "ordem de inscrição"}. As inscrições serão encerradas e o torneio fica Em andamento.`,
                  confirmLabel: props.competitionFormat === "ROUND_ROBIN" ? "Sortear confrontos" : "Gerar chaves",
                  tone: "success",
                },
                build: () => ({ url, method: "POST", body: { action: "generate", seeding } }),
              })
            }
          >
            ♦ {props.competitionFormat === "ROUND_ROBIN" ? "Sortear confrontos" : "Gerar chaves"} ♦
          </button>
        </section>
        {dialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {props.competitionFormat === "SINGLE_ELIMINATION" && props.podium.first && (
        <section className="card flex flex-wrap items-center justify-center gap-6 p-5 text-center">
          <span>
            <span className="block font-display text-xs uppercase text-[#ffd700]">Campeão</span>
            <span className="text-gold-gradient font-display text-2xl font-black">♛ {props.podium.first}</span>
          </span>
          {props.podium.second && (
            <span>
              <span className="block font-display text-xs uppercase text-[#c0c0c0]">2º lugar</span>
              <span className="font-display text-lg font-bold text-gold-100">{props.podium.second}</span>
            </span>
          )}
          {props.podium.third.length > 0 && (
            <span>
              <span className="block font-display text-xs uppercase text-[#cd7f32]">3º lugar</span>
              <span className="font-display text-lg font-bold text-gold-100">{props.podium.third.join(" · ")}</span>
            </span>
          )}
        </section>
      )}

      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-300">Clique em uma partida para lançar o vencedor, o placar ou o horário.</p>
          <input
            type="search"
            className="input py-2 sm:w-56"
            placeholder="Destacar jogador…"
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
          />
        </div>
        {props.competitionFormat === "ROUND_ROBIN" ? (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-stone-400">
                <span>Classificação</span>
                <span>{props.progress.completed} de {props.progress.total} partidas concluídas</span>
              </div>
              <StandingsTable rows={props.standings} allowDraw={props.allowDraw} />
            </div>
            <RoundRobinView matches={props.matches} participants={props.standings} onSelect={open} />
          </div>
        ) : (
          <BracketView matches={props.matches} onSelect={open} highlight={highlight.trim() || null} />
        )}
        {error && !selected && <p className="text-sm text-red-300">{error}</p>}
      </section>

      <div className={`grid gap-4 ${props.competitionFormat === "SINGLE_ELIMINATION" ? "lg:grid-cols-2" : ""}`}>
        {props.competitionFormat === "SINGLE_ELIMINATION" && <section className="card space-y-3 p-4 sm:p-5">
          <h2 className="heading text-sm text-gold-300">Trocar posições</h2>
          <p className="text-xs text-stone-400">Ajuste quem enfrenta quem na 1ª rodada. Disponível até o primeiro resultado.</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              [swapA, setSwapA],
              [swapB, setSwapB],
            ].map(([value, setter], i) => (
              <select
                key={i}
                className="input py-2"
                value={value as string}
                disabled={hasResults}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              >
                <option value="">Jogador {i + 1}</option>
                {firstRoundPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={hasResults || !swapA || !swapB || swapA === swapB}
            onClick={() =>
              run({ url, method: "POST", body: { action: "swap", registrationA: swapA, registrationB: swapB } }, () => {
                setSwapA("");
                setSwapB("");
              })
            }
          >
            Trocar
          </button>
        </section>}

        <section className="card space-y-3 p-4 sm:p-5">
          <h2 className="heading text-sm text-red-300">Zona de perigo</h2>
          <p className="text-xs text-stone-400">
            Resetar apaga {props.competitionFormat === "ROUND_ROBIN" ? "todos os confrontos" : "todas as partidas da chave"} e resultados. O torneio volta para Agendado (inscrições continuam fechadas).
          </p>
          <button
            type="button"
            className="btn-danger w-full"
            onClick={() =>
              confirm({
                options: {
                  title: props.competitionFormat === "ROUND_ROBIN" ? "Resetar confrontos?" : "Resetar chaves?",
                  message: "Todas as partidas e resultados serão apagados. A ação fica no histórico.",
                  confirmLabel: "Resetar",
                  tone: "danger",
                },
                build: () => ({ url, method: "POST", body: { action: "reset" } }),
              })
            }
          >
            {props.competitionFormat === "ROUND_ROBIN" ? "Resetar confrontos" : "Resetar chaves"}
          </button>
        </section>
      </div>

      {selected && selected.player1 && selected.player2 && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-title"
          onClick={() => !busy && setSelected(null)}
        >
          <div className="card w-full max-w-md animate-pop space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="match-title" className="heading text-lg text-gold-100">
              {props.competitionFormat === "ROUND_ROBIN"
                ? `${selected.round}ª rodada`
                : roundName(selected.round, rounds, selected.isThirdPlace)}
            </h2>
            <div>
              <p className="label">Vencedor</p>
              <div className="grid grid-cols-2 gap-2">
                {[selected.player1, selected.player2].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setWinnerId(p.id); if (resultType === "DRAW") setResultType("NORMAL"); }}
                    aria-pressed={winnerId === p.id}
                    className={`truncate rounded-sm border-2 px-3 py-4 font-display font-bold transition ${
                      winnerId === p.id
                        ? "border-gold-400 bg-gold-400/15 text-gold-100 shadow-[0_0_14px_rgb(212_175_55/0.4)]"
                        : "border-gold-600/40 bg-black/40 text-stone-300 hover:border-gold-400/70"
                    }`}
                  >
                    {winnerId === p.id && "♛ "}
                    {p.nickname}
                  </button>
                ))}
              </div>
              {props.allowDraw && props.competitionFormat === "ROUND_ROBIN" && (
                <button
                  type="button"
                  className={`mt-2 w-full rounded-sm border-2 px-3 py-2 font-display font-bold ${resultType === "DRAW" ? "border-gold-400 bg-gold-400/15 text-gold-100" : "border-gold-600/40 text-stone-300"}`}
                  onClick={() => { setWinnerId(null); setResultType("DRAW"); }}
                >
                  Empate
                </button>
              )}
            </div>
            <div>
              <label className="label" htmlFor="resultType">Tipo de resultado</label>
              <select
                id="resultType"
                className="input"
                value={resultType}
                onChange={(e) => {
                  const next = e.target.value as typeof resultType;
                  setResultType(next);
                  if (next === "DRAW") setWinnerId(null);
                }}
              >
                <option value="NORMAL">Resultado normal</option>
                {props.allowDraw && props.competitionFormat === "ROUND_ROBIN" && <option value="DRAW">Empate</option>}
                <option value="WALKOVER">W.O.</option>
                <option value="DISQUALIFICATION">Desclassificação</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="score">
                  Placar
                </label>
                <input id="score" className="input" maxLength={20} placeholder="Ex.: 2-1" value={score} onChange={(e) => setScore(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="scheduledAt">
                  Horário
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  className="input [color-scheme:dark]"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>
            {selected.winnerId && winnerId !== selected.winnerId && (
              <p className="text-xs text-gold-200">Trocar o vencedor apaga os resultados seguintes que dependiam desta partida.</p>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {selected.status === "COMPLETED" ? (
                <button
                  type="button"
                  className="btn-ghost text-xs text-red-300"
                  disabled={busy}
                  onClick={async () => {
                    if (await run({ url, method: "POST", body: { action: "clear", matchId: selected.id } })) setSelected(null);
                  }}
                >
                  Apagar resultado
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setSelected(null)} disabled={busy}>
                  Fechar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || ((!winnerId && resultType !== "DRAW") && (props.scheduledInputs[selected.id] ?? "") === scheduledAt)}
                  onClick={saveResult}
                >
                  {busy ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
