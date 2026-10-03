// Cloudflare Builds: approved rule versions persist in the site's database.
// No production database credentials are passed to the builder.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const phase = process.argv[2];
if (!["build", "deploy"].includes(phase)) throw new Error("Use build ou deploy.");
for (const file of [".env", ".env.local", ".env.production", ".env.production.local", ".env.secrets", ".dev.vars"]) {
  if (existsSync(file)) throw new Error(`Build remoto deve ser executado sem ${file}.`);
}
const secret = process.env.RULES_BUILD_SECRET;
if (!secret || secret.length < 32) throw new Error("Configure RULES_BUILD_SECRET nos secrets do Workers Builds.");
const endpoint = "https://reino-cobblemon.nexus-league.workers.dev/api/internal/rules-build";
const connection = "postgresql://build:build@127.0.0.1:5432/build";
const buildEnv = { ...process.env, DATABASE_URL: connection,
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: connection };
delete buildEnv.RULES_BUILD_SECRET;
delete buildEnv.RULES_DEPLOY_HOOK;
if (phase === "build") {
  for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CF_API_TOKEN", "CF_API_KEY"]) delete buildEnv[key];
}

async function coordinate(action, data) {
  const res = await fetch(endpoint, { method: "POST", redirect: "error",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Coordenação ${action}: HTTP ${res.status}. Consulte o painel; não libere bloqueios sem verificar o build.`);
  return res.json();
}
function run(command) {
  const result = spawnSync(command, { shell: true, stdio: "inherit", env: buildEnv });
  if (result.error || result.status !== 0) throw new Error(`Falhou: ${command}`);
}

if (phase === "build") {
  const buildId = randomUUID();
  let approved;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { approved = await coordinate("begin", { buildId }); break; }
      catch (error) { if (attempt === 2) throw error; }
    }
  } catch (error) {
    // begin may have committed even if its HTTP response was lost.
    await coordinate("abort", { buildId }).catch(() => undefined);
    throw error;
  }
  const state = { buildId, revision: approved.revision, version: approved.version };
  try {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(state.version) ||
        typeof state.revision !== "string" || state.revision.length > 80) throw new Error("Aprovação inválida.");
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    if (pkg.dependencies["@pkmn/sim"] !== state.version || pkg.dependencies["@pkmn/mods"] !== state.version) {
      run(`npm install --ignore-scripts --save-exact --registry=https://registry.npmjs.org @pkmn/sim@${state.version} @pkmn/mods@${state.version}`);
    }
    run("npm run showdown:sync");
    const catalog = JSON.parse(readFileSync("src/data/showdown.json", "utf8"));
    if (catalog.source.version !== state.version) throw new Error("Catálogo e versão aprovada divergem.");
    catalog.source.rulesRevision = state.revision;
    catalog.source.deploymentId = buildId;
    writeFileSync("src/data/showdown.json", JSON.stringify(catalog));
    run("npm test");
    run("npx opennextjs-cloudflare build");
    writeFileSync(".rules-build.json", JSON.stringify(state));
  } catch (error) {
    await coordinate("abort", state).catch(() => console.error("Não foi possível liberar o build; consulte a Cloudflare."));
    throw error;
  }
} else {
  const state = JSON.parse(readFileSync(".rules-build.json", "utf8"));
  await coordinate("publish", state);
  // Once deployment starts, never release on a timeout: it may have succeeded.
  run("npx opennextjs-cloudflare deploy");
  let confirmed = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try { await coordinate("confirm", { buildId: state.buildId }); confirmed = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 5000)); }
  }
  if (!confirmed) throw new Error("Deploy enviado; confirmação pendente. Abra o painel de regras para confirmar a versão em produção.");
  console.log(`Publicação confirmada: validador ${state.version}.`);
}
