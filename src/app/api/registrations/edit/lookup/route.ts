import { jsonError, jsonOk, readJson } from "@/lib/http";
import { editLookupSchema, firstZodError } from "@/lib/validation";
import { lookupForEdit } from "@/lib/player-edit";
import { editErrorResponse, guardEditRequest } from "@/lib/player-edit-http";

export const dynamic = "force-dynamic";

/** Nick + código de edição → time atual (somente para o dono do código). */
export async function POST(req: Request) {
  const parsed = editLookupSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(firstZodError(parsed.error), 400);

  const blocked = await guardEditRequest(req, parsed.data.nickname);
  if (blocked) return blocked;

  try {
    return jsonOk(await lookupForEdit(parsed.data.tournament, parsed.data.nickname, parsed.data.code));
  } catch (error) {
    return editErrorResponse(error, "registrations/edit/lookup");
  }
}
