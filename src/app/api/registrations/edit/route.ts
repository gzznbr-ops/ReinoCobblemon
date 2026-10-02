import { jsonError, jsonOk, readJson } from "@/lib/http";
import { editTeamSchema, firstZodError } from "@/lib/validation";
import { editTeamWithCode } from "@/lib/player-edit";
import { editErrorResponse, guardEditRequest } from "@/lib/player-edit-http";

export const dynamic = "force-dynamic";

/** Jogador altera o próprio time usando nick + código de edição. */
export async function POST(req: Request) {
  const parsed = editTeamSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);

  const blocked = await guardEditRequest(req, parsed.data.nickname);
  if (blocked) return blocked;

  try {
    const { tournament, nickname, code, pokemon } = parsed.data;
    return jsonOk({ ok: true, ...(await editTeamWithCode(tournament, nickname, code, pokemon)) });
  } catch (error) {
    return editErrorResponse(error, "registrations/edit");
  }
}
