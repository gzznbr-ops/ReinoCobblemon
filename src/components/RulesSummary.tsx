import type { Tournament } from "@prisma/client";
import { CATEGORIES, getPokemonRecord } from "@/lib/rules/tournament-rules";
import { COBBLEMON_FREE_FOR_ALL_FORMAT_ID, FREE_FORMAT_ID, getFormat, showdownSourceLabel } from "@/lib/rules/showdown";

function names(ids: number[]): string {
  return ids
    .map((id) => getPokemonRecord(id)?.name)
    .filter(Boolean)
    .join(", ");
}

/** Lista de regras do torneio, montada a partir da configuração feita no painel. */
export function RulesSummary({ tournament: t }: { tournament: Tournament }) {
  const format = getFormat(t.formatId);
  const free = t.formatId === FREE_FORMAT_ID;
  const unrestricted = t.formatId === COBBLEMON_FREE_FOR_ALL_FORMAT_ID;
  const allowed = CATEGORIES.filter((c) => t[c.field]);
  const banned = CATEGORIES.filter((c) => !t[c.field]);
  const custom = t.customRules
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const rules: React.ReactNode[] = [
    free ? (
      "Formato livre: sem banlist de tier do Showdown."
    ) : unrestricted ? (
      <>
        Tier <strong className="text-gold-200">{format?.name ?? t.formatId}</strong>: sem banlist nem Species Clause.

      </>
    ) : (
      <>
        Tier <strong className="text-gold-200">{format?.name ?? t.formatId}</strong>: vale a banlist oficial do Pokémon Showdown
        e a validação automática dos ataques, habilidades e itens.
      </>
    ),
    `Time com exatamente ${t.teamSize} Pokémon${format?.speciesClause === false ? ", podendo repetir espécie" : ", sem repetir espécie (Species Clause)"}.`,
    t.competitionFormat === "ROUND_ROBIN"
      ? `Pontos corridos em ${t.roundRobinTurns} ${t.roundRobinTurns === 1 ? "turno" : "turnos"}: vitória ${t.pointsForWin} ${t.pointsForWin === 1 ? "ponto" : "pontos"}, empate ${t.pointsForDraw} ${t.pointsForDraw === 1 ? "ponto" : "pontos"} e derrota ${t.pointsForLoss}. Partidas ${t.matchFormat}.${t.allowDraw ? " Empates são permitidos." : " Empates não são permitidos."}`
      : `Partidas ${t.matchFormat} em chave de eliminação simples${t.thirdPlaceMatch ? ", com disputa de 3º lugar" : ""}.`,
  ];
  if (t.monotype) {
    rules.push(
      `Monotype: pelo menos ${t.monotypeMinimum} dos ${t.teamSize} Pokémon compartilham um tipo; até ${t.maxWildcards} Coringa(s) de qualquer tipo.`,
    );
  }
  if (banned.length) rules.push(`Proibidos: ${banned.map((c) => c.plural).join(", ")}.`);
  if (allowed.length) {
    rules.push(`Permitidos${free || unrestricted ? "" : " (se liberados pelo tier)"}: ${allowed.map((c) => c.plural).join(", ")}.`);
  }
  if (t.bannedPokemonIds.length) rules.push(`Banidos neste torneio: ${names(t.bannedPokemonIds)}.`);
  if (t.allowedPokemonIds.length) rules.push(`Liberados como exceção: ${names(t.allowedPokemonIds)}.`);
  rules.push("Times são secretos: só a organização vê.");

  return (
    <div className="space-y-5">
      <ul className="space-y-2.5">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-3 text-sm text-stone-300">
            <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-gold-400" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {custom.length > 0 && (
        <div>
          <p className="label">Regras específicas</p>
          <ul className="space-y-2">
            {custom.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-stone-200">
                <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-crimson-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!free && !unrestricted && (
        <p className="text-[11px] text-stone-500">
          Banlist gerada do repositório oficial smogon/pokemon-showdown ({showdownSourceLabel()}).
        </p>
      )}
    </div>
  );
}
