// Executa um comando com as variáveis de .env.secrets.
//
// Por que não usar .env? O build da Cloudflare (OpenNext) copia os arquivos .env*
// que o Next lê para DENTRO do Worker publicado. Guardar DATABASE_URL, AUTH_SECRET
// etc. em .env.secrets (arquivo que o Next ignora) mantém os segredos fora do bundle;
// em produção eles vêm do Hyperdrive e de `wrangler secret`.
//
// Uso: node scripts/with-secrets.mjs [--guard] <comando...>
//   --guard  aborta se algum .env* lido pelo Next contiver segredos (usado no deploy)
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const guard = args[0] === "--guard";
if (guard) args.shift();
if (args.length === 0) {
  console.error("Uso: node scripts/with-secrets.mjs [--guard] <comando...>");
  process.exit(1);
}

if (guard) {
  const nextEnvFiles = [".env", ".env.local", ".env.production", ".env.production.local"];
  const secret = /^\s*(DATABASE_URL|AUTH_SECRET|ADMIN_PASSWORD|ADMIN_USERNAME|CLOUDFLARE_[A-Z_]+)\s*=/m;
  const leaking = nextEnvFiles.filter((f) => existsSync(f) && secret.test(readFileSync(f, "utf8")));
  if (leaking.length) {
    console.error(`✖ Segredos em ${leaking.join(", ")} seriam embutidos no Worker. Mova-os para .env.secrets.`);
    process.exit(1);
  }
}

if (existsSync(".env.secrets")) process.loadEnvFile(".env.secrets");

const child = spawn(args.join(" "), { stdio: "inherit", shell: true, env: process.env });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
