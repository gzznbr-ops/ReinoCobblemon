import { spawn } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres@127.0.0.1:55432/reino_preview?schema=public",
  AUTH_SECRET: "winx-cobblemon-preview-local-only-2026-change-before-production",
  DISPLAY_TIMEZONE: "America/Sao_Paulo",
  TRUST_PROXY: "false",
  NEXT_PUBLIC_BASE_PATH: "",
};

const child = spawn("next dev", { shell: true, stdio: "inherit", env });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
