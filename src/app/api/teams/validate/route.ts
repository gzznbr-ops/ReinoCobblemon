import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import { getClientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { rulesOf } from "@/lib/tournaments";
import { validateBattleTeam } from "@/lib/rules/validate-battle-team";
import { teamSetsSchema } from "@/lib/pokemon/team-set";
const schema = z.object({ tournament: z.string().max(80).optional(), tournamentId: z.string().max(80).optional(), pokemon: teamSetsSchema });
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError("Origem inválida.", 403);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonOk({ valid: false, errors: [parsed.error.issues[0]?.message ?? "Complete os dados do time."] });
  const input = parsed.data;
  if (input.tournamentId) { const admin = await requireAdminApi(req); if (admin instanceof Response) return admin; }
  if (!(await rateLimit(`validate-team:${getClientIp(req)}`, 120, 60_000))) return jsonError("Aguarde um minuto para validar novamente.", 429);
  const tournament = input.tournamentId ? await prisma.tournament.findUnique({ where: { id: input.tournamentId } }) :
    input.tournament ? await prisma.tournament.findUnique({ where: { slug: input.tournament } }) : null;
  if (!tournament || (!input.tournamentId && tournament.status === "DRAFT")) return jsonError("Torneio não encontrado.", 404);
  const errors = validateBattleTeam(rulesOf(tournament), input.pokemon);
  return jsonOk({ valid: !errors.length, errors });
}
