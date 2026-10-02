import { jsonError, jsonOk } from "@/lib/http";
import { battleOptions } from "@/lib/rules/validate-battle-team";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const options = battleOptions(url.searchParams.get("format") ?? "", Number(url.searchParams.get("pokemon")));
  return options ? jsonOk(options) : jsonError("Formato ou Pokémon inválido.", 400);
}
