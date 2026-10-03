import "server-only";
import { SHOWDOWN_SOURCE } from "./showdown";
import { eligibleRelease, stableVersion } from "./release-policy";

async function latest(name: "sim" | "mods") {
  const res = await fetch(`https://registry.npmjs.org/@pkmn%2f${name}/latest`, {
    cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "manual",
  });
  if (!res.ok) throw new Error(`Registro de versões respondeu HTTP ${res.status}.`);
  const data = await res.json() as { name?: string; version?: string };
  if (data.name !== `@pkmn/${name}` || !data.version || !stableVersion(data.version)) throw new Error("Versão inválida no registro.");
  return data.version;
}

export async function checkRelease() {
  const [sim, mods] = await Promise.all([latest("sim"), latest("mods")]);
  return { currentVersion: SHOWDOWN_SOURCE.version, simVersion: sim, modsVersion: mods,
    availableVersion: eligibleRelease(SHOWDOWN_SOURCE.version, sim, mods),
    synchronized: sim === mods, checkedAt: new Date().toISOString() };
}
