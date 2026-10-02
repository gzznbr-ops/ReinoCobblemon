// Workers Builds: não carrega .env.secrets nem precisa acessar o banco de produção.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const phase = process.argv[2];
if (!["build", "deploy"].includes(phase)) throw new Error("Use build ou deploy.");
for (const file of [".env", ".env.local", ".env.production", ".env.production.local", ".env.secrets", ".dev.vars"]) {
  if (existsSync(file)) throw new Error(`Build remoto deve ser executado sem ${file}.`);
}
// O OpenNext inicializa um proxy local até no deploy. Esta URL inerte satisfaz
// a configuração; o Worker publicado usa o binding HYPERDRIVE existente.
const connection = "postgresql://build:build@127.0.0.1:5432/build";
const buildEnv = {
  ...process.env,
  DATABASE_URL: connection,
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: connection,
};
const commands = phase === "build"
  ? ["npm test", "npx opennextjs-cloudflare build"]
  : ["npx opennextjs-cloudflare deploy"];
for (const command of commands) {
  const result = spawnSync(command, { shell: true, stdio: "inherit", env: buildEnv });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
