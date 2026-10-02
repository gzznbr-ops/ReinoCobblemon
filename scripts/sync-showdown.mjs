// Gera src/data/showdown.json a partir do repositório oficial do Pokémon Showdown
// (https://github.com/smogon/pokemon-showdown).
//
// A fonte é o GitHub (branch master por padrão), não o npm: o pacote do npm só é
// publicado de tempos em tempos e fica semanas atrás das mudanças de tier. O código
// do commit escolhido é baixado, compilado com o build oficial (`node build`) e o
// próprio validador do Showdown (TeamValidator) é executado Pokémon por Pokémon em
// cada formato da Gen 9 — a mesma banlist do /checkteam: tiers (Uber, OU, UUBL…),
// banimentos específicos, Pokémon "Past" fora do S/V, regra Little Cup etc. Também
// são gravadas as tags oficiais (lendário restrito, sub-lendário, mítico, UB, Paradox).
//
// Tudo fica em .showdown-cache/ (fora das dependências do site): o site nunca
// carrega o Showdown em tempo de execução, só este JSON versionado.
//
// Uso: npm run showdown:sync                 (último commit do master)
//      npm run showdown:sync -- <commit|tag>  (ref específica, ex.: b1156ff)
//      npm run showdown:sync -- --npm 0.11.11 (pacote do npm, legado)
// Requer Node 22+ (exigência do build do Showdown).
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".showdown-cache");
const REPO = "smogon/pokemon-showdown";
const args = process.argv.slice(2);
const useNpm = args[0] === "--npm";
const requestedRef = (useNpm ? args[1] : args[0]) ?? (useNpm ? "latest" : "master");
if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(requestedRef)) throw new Error(`Ref inválida: ${requestedRef}`);
mkdirSync(CACHE, { recursive: true });

async function github(pathname) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${pathname}`, {
    headers: { "User-Agent": "winx-cobblemon-sync", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status} para ${pathname}`);
  return res.json();
}

let Dex, TeamValidator, source;

if (useNpm) {
  // ---- Legado: pacote do npm ------------------------------------------------
  const npmDir = path.join(CACHE, "npm");
  mkdirSync(npmDir, { recursive: true });
  if (!existsSync(path.join(npmDir, "package.json"))) {
    writeFileSync(path.join(npmDir, "package.json"), JSON.stringify({ name: "showdown-cache", private: true }));
  }
  console.log(`↓ Baixando pokemon-showdown@${requestedRef} do npm…`);
  execSync(`npm install pokemon-showdown@${requestedRef} --omit=optional --ignore-scripts --no-audit --no-fund --loglevel=error`, {
    cwd: npmDir,
    stdio: "inherit",
  });
  const require = createRequire(path.join(npmDir, "package.json"));
  ({ Dex, TeamValidator } = require("pokemon-showdown"));
  const version = JSON.parse(readFileSync(require.resolve("pokemon-showdown/package.json"), "utf8")).version;
  source = { repository: `https://github.com/${REPO}`, via: "npm", ref: `npm@${version}`, commit: null, commitDate: null, version };
} else {
  // ---- GitHub: baixa, compila e usa o commit ---------------------------------
  const info = await github(`commits/${encodeURIComponent(requestedRef)}`);
  const sha = info.sha;
  const commitDate = info.commit.committer?.date ?? info.commit.author.date;
  console.log(`↓ ${REPO}@${requestedRef} → ${sha.slice(0, 7)} (${commitDate}) "${info.commit.message.split("\n")[0]}"`);

  const dir = path.join(CACHE, `src-${sha}`);
  const built = path.join(dir, "dist", "sim", "index.js");
  if (!existsSync(built)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const res = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${sha}`);
    if (!res.ok) throw new Error(`Download do código falhou (${res.status})`);
    writeFileSync(path.join(dir, "src.tar.gz"), Buffer.from(await res.arrayBuffer()));
    // caminhos relativos: o tar do Git Bash interpreta "C:" como host remoto
    execFileSync("tar", ["-xzf", "src.tar.gz", "--strip-components=1"], { cwd: dir, stdio: "inherit" });
    rmSync(path.join(dir, "src.tar.gz"));
    console.log("⚙ Instalando dependências e compilando (node build)…");
    execSync("npm install --ignore-scripts --no-audit --no-fund --loglevel=error", { cwd: dir, stdio: "inherit" });
    execSync("node build", { cwd: dir, stdio: "inherit" });
  }
  // Mantém só o commit atual no cache
  for (const entry of readdirSync(CACHE)) {
    if (entry.startsWith("src-") && entry !== `src-${sha}`) rmSync(path.join(CACHE, entry), { recursive: true, force: true });
  }

  const require = createRequire(path.join(dir, "package.json"));
  ({ Dex, TeamValidator } = require(built));
  const version = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version;
  source = { repository: `https://github.com/${REPO}`, via: "github", ref: requestedRef, commit: sha, commitDate, version };
}
const dex = Dex.forGen(9);

// ---------------------------------------------------------------------------
// 2. Liga cada Pokémon do site (ids da PokeAPI) à espécie do Showdown
// ---------------------------------------------------------------------------
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const SLUG_FIXES = [
  [/-breed$/, ""], // tauros-paldea-combat-breed → Tauros-Paldea-Combat
  [/-mask$/, ""], // ogerpon-wellspring-mask → Ogerpon-Wellspring
  [/-female$/, "-f"], // meowstic-female → Meowstic-F
  [/^darmanitan-galar-standard$/, "darmanitan-galar"],
  [/^necrozma-dusk$/, "necrozma-dusk-mane"],
  [/^necrozma-dawn$/, "necrozma-dawn-wings"],
];

const pokemonList = JSON.parse(readFileSync(path.join(ROOT, "src", "data", "pokemon.json"), "utf8"));
const TAGS = {
  "Restricted Legendary": "restricted",
  "Sub-Legendary": "legendary",
  Mythical: "mythical",
  "Ultra Beast": "ultraBeast",
  Paradox: "paradox",
};

const mapped = [];
const unmatched = [];
for (const p of pokemonList) {
  let slug = p.slug;
  for (const [re, replacement] of SLUG_FIXES) slug = slug.replace(re, replacement);
  const base = dex.species.get(p.speciesSlug);
  let species = dex.species.get(toID(slug));
  if (!species.exists || (base.exists && species.baseSpecies !== base.baseSpecies)) species = null;
  // Forma padrão com sufixo na PokeAPI (deoxys-normal, giratina-altered…) → espécie base
  if (!species && base.exists && p.id < 10000) species = base;
  if (!species) {
    unmatched.push(p.slug);
    continue;
  }
  mapped.push({ id: p.id, species });
}

// ---------------------------------------------------------------------------
// 3. Formatos da Gen 9 oferecidos no painel
// ---------------------------------------------------------------------------
const SECTIONS = ["S/V Singles", "S/V Doubles", "National Dex", "National Dex Other Tiers", "Unofficial Metagames", "Ladder Spotlight"];
// Formatos com regras de equipe inteira ou mecânicas alteradas que o site não consegue validar por espécie
const EXCLUDED =
  /customgame|cap$|freeforall|monocolor|monoletter|statmons|convergence|revelationmons|noholdsbarred|fortemons|2v2|4v4|35pokes|bh$|godlygift|stabmons|aaa|draft|bssreg/;

const isCandidate = (f) =>
  f.exists &&
  f.effectType === "Format" &&
  f.mod?.startsWith("gen9") &&
  ["singles", "doubles"].includes(f.gameType) &&
  !f.team &&
  !EXCLUDED.test(f.id);

// O Showdown move formatos entre seções com frequência (ex.: NFE foi para "Ladder Spotlight").
// Formatos já sincronizados continuam disponíveis enquanto existirem, para não quebrar torneios criados.
const dataFile = path.join(ROOT, "src", "data", "showdown.json");
const previousIds = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, "utf8")).formats.map((f) => f.id) : [];
const formats = Dex.formats.all().filter((f) => isCandidate(f) && (SECTIONS.includes(f.section) || previousIds.includes(f.id)));
const vanished = previousIds.filter((id) => !formats.some((f) => f.id === id));
if (vanished.length) {
  console.warn(`⚠ Formatos que existiam antes e não estão mais disponíveis (confira torneios que os usam): ${vanished.join(", ")}`);
}

/** Mensagens do validador que não dizem respeito à espécie (o set de teste é mínimo). */
const IGNORED_PROBLEM =
  /has no moves|EVs|ability|Terastal|needs to hold|revert to|must be holding|item|nature|gender|level|shiny|IVs|Hidden Power|events|Pokemon GO|obtainable from|^\s|^-/i;

/** Quando há vários problemas, o motivo mais específico é exibido. */
const REASON_PRIORITY = ["Banido: ", "Não é 1º", "Não pode evoluir", "Precisa estar", "Indisponível", "Banido no formato"];

function banReason(message) {
  let m = message.match(/is tagged (.+?), which is banned/);
  if (m) return `Banido: ${m[1]}`;
  if (/does not exist in Gen|does not exist in this game|is not obtainable|unobtainable|is not in the .+ Pok[eé]dex/i.test(message)) {
    return "Indisponível no formato";
  }
  if (/evolution family|not the first|Little Cup/i.test(message)) return "Não é 1º estágio de evolução";
  if (/cannot evolve|can't evolve/i.test(message)) return "Não pode evoluir (NFE)";
  if (/is not fully evolved|must be fully evolved/i.test(message)) return "Precisa estar totalmente evoluído";
  if (/is banned/i.test(message)) return "Banido no formato";
  return message.replace(/\s+/g, " ").slice(0, 80);
}

function testSet(species, ruleTable) {
  return {
    name: species.baseSpecies,
    species: species.name,
    item: species.requiredItem ?? species.requiredItems?.[0] ?? "",
    ability: species.abilities["0"],
    moves: [],
    nature: "Serious",
    gender: species.gender || "",
    evs: { hp: 1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: ruleTable.adjustLevel || Math.min(ruleTable.maxLevel, 100),
    teraType: species.forceTeraType ?? species.types[0],
  };
}

const out = [];
for (const format of formats) {
  const validator = TeamValidator.get(format.id);
  const ruleTable = validator.ruleTable;
  const groups = new Map();
  for (const { id, species } of mapped) {
    const problems = (validator.validateSet(testSet(species, ruleTable), {}) ?? []).filter(
      (msg) => !msg.startsWith("(") && !IGNORED_PROBLEM.test(msg),
    );
    if (problems.length === 0) continue;
    const reasons = problems.map(banReason);
    const reason =
      REASON_PRIORITY.map((prefix) => reasons.find((r) => r.startsWith(prefix))).find(Boolean) ?? reasons[0];
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(id);
  }
  const bannedCount = [...groups.values()].reduce((n, ids) => n + ids.length, 0);
  out.push({
    id: format.id,
    name: format.name,
    shortName: format.name.replace(/^\[Gen 9\]\s*/, ""),
    section: format.section,
    gameType: format.gameType,
    teamSize: Math.min(ruleTable.maxTeamSize, 6),
    pickedTeamSize: ruleTable.pickedTeamSize ?? null,
    level: ruleTable.adjustLevel || Math.min(ruleTable.maxLevel, 100),
    ruleset: format.ruleset ?? [],
    banlist: format.banlist ?? [],
    description: typeof format.desc === "string" ? format.desc : null,
    bans: [...groups.entries()].map(([reason, ids]) => ({ reason, ids })),
  });
  console.log(`  ${format.id.padEnd(34)} ${String(mapped.length - bannedCount).padStart(4)} permitidos · ${bannedCount} banidos`);
}

const pokemon = Object.fromEntries(
  mapped.map(({ id, species }) => [
    id,
    {
      sd: species.id,
      tier: species.tier,
      natDexTier: species.natDexTier,
      tags: species.tags.map((t) => TAGS[t]).filter(Boolean),
      past: species.isNonstandard === "Past",
    },
  ]),
);

const result = {
  source: { ...source, generatedAt: new Date().toISOString() },
  pokemon,
  formats: out,
};

const file = path.join(ROOT, "src", "data", "showdown.json");
writeFileSync(file, JSON.stringify(result) + "\n");
const label = source.commit ? `commit ${source.commit.slice(0, 7)} (${source.commitDate})` : source.ref;
console.log(`✔ Pokémon Showdown ${label}: ${out.length} formatos, ${mapped.length} Pokémon → ${path.relative(ROOT, file)}`);
if (unmatched.length) console.warn(`⚠ Sem correspondência no Showdown (ficam sem tags e são tratados como banidos nos tiers): ${unmatched.join(", ")}`);
