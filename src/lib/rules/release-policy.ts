export const stableVersion = (value: string) => value.trim() === value && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);

export function compareVersions(a: string, b: string): number {
  if (!stableVersion(a) || !stableVersion(b)) throw new Error("Versão inválida.");
  const aa = a.split(".").map(Number), bb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i]! > bb[i]! ? 1 : -1;
  return 0;
}

export function eligibleRelease(current: string, sim: string, mods: string): string | null {
  if (!stableVersion(sim) || sim !== mods) return null;
  return compareVersions(sim, current) > 0 ? sim : null;
}

export function deploymentMatches(
  state: { buildId: string | null; revision: string; version: string },
  source: { deploymentId?: string; rulesRevision?: string; version: string },
) {
  return Boolean(state.buildId && state.buildId === source.deploymentId &&
    state.revision === source.rulesRevision && state.version === source.version);
}
