import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { SHOWDOWN_SOURCE } from "@/lib/rules/showdown";

export const dynamic = "force-dynamic";

const REPO = "smogon/pokemon-showdown";
const API = `https://api.github.com/repos/${REPO}`;
/** Arquivos que definem tiers, formatos e regras usadas nas banlists. */
const RULE_PATHS = ["data/formats-data.ts", "config/formats.ts", "data/rulesets.ts"];

type Commit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string }; committer?: { date: string } };
};

class GithubError extends Error {}

async function github<T>(pathname: string): Promise<T> {
  const headers: Record<string, string> = { "User-Agent": "reino-cobblemon-torneios", Accept: "application/vnd.github+json" };
  // Opcional: `wrangler secret put GITHUB_TOKEN` (sem permissões) evita o limite de 60 consultas/hora por IP
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`${API}/${pathname}`, { headers, signal: AbortSignal.timeout(8000) });
  if (res.status === 403 || res.status === 429) throw new GithubError("Limite de consultas ao GitHub atingido. Tente em alguns minutos.");
  if (!res.ok) throw new GithubError(`GitHub respondeu ${res.status}.`);
  return (await res.json()) as T;
}

const summarize = (c: Commit) => ({
  sha: c.sha.slice(0, 7),
  url: c.html_url.startsWith(`https://github.com/${REPO}/`) ? c.html_url : `https://github.com/${REPO}/commit/${c.sha}`,
  message: c.commit.message.split("\n")[0]!.slice(0, 160),
  date: c.commit.committer?.date ?? c.commit.author.date,
});

/**
 * Compara o commit do Showdown usado nas banlists do site com o master oficial e
 * lista os commits posteriores que mexeram em tiers, formatos ou regras.
 */
export async function GET(req: Request) {
  const admin = await requireAdminApi(req);
  if (admin instanceof Response) return admin;

  const synced = SHOWDOWN_SOURCE.commit;
  try {
    const head = await github<Commit>("commits/master");
    if (!synced) {
      return jsonOk({
        current: SHOWDOWN_SOURCE,
        latest: summarize(head),
        behindBy: null,
        ruleChanges: [],
        upToDate: false,
        legacyNpm: true,
        checkedAt: new Date().toISOString(),
      });
    }

    // Commits do master depois do sincronizado (a comparação por commit não depende de datas)
    const compare = await github<{ ahead_by: number; commits: Commit[] }>(`compare/${synced}...${head.sha}`);
    const newer = new Set(compare.commits.map((c) => c.sha));

    // Commits que tocaram arquivos de regras; a janela de datas é folgada e o filtro real é `newer`
    const since = new Date(new Date(SHOWDOWN_SOURCE.commitDate ?? SHOWDOWN_SOURCE.generatedAt).getTime() - 30 * 86400_000).toISOString();
    const byPath = await Promise.all(
      RULE_PATHS.map((p) => github<Commit[]>(`commits?sha=${head.sha}&path=${encodeURIComponent(p)}&since=${since}&per_page=100`)),
    );
    // A comparação do GitHub lista no máximo 250 commits; acima disso, cai para o filtro por data
    const truncated = compare.ahead_by > compare.commits.length;
    const syncedTime = SHOWDOWN_SOURCE.commitDate ?? SHOWDOWN_SOURCE.generatedAt;
    const isNewer = (c: Commit) =>
      c.sha !== synced && (newer.has(c.sha) || (truncated && (c.commit.committer?.date ?? c.commit.author.date) > syncedTime));
    const ruleChanges = byPath
      .flat()
      .filter((c, i, all) => isNewer(c) && all.findIndex((x) => x.sha === c.sha) === i)
      .map(summarize)
      .sort((a, b) => b.date.localeCompare(a.date));

    return jsonOk({
      current: SHOWDOWN_SOURCE,
      latest: summarize(head),
      behindBy: compare.ahead_by,
      ruleChanges: ruleChanges.slice(0, 20),
      ruleChangesTotal: ruleChanges.length,
      upToDate: ruleChanges.length === 0,
      legacyNpm: false,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof GithubError) return jsonError(error.message, 502);
    console.error("[admin/showdown/check] erro inesperado", error);
    return jsonError("Não foi possível falar com o GitHub agora. Tente de novo.", 502);
  }
}
