// Server/runtime entry point. Never import this module from a client component.
import { Dex, TeamValidator, type ModData, type ID } from "@pkmn/sim";
import * as dlc1 from "@pkmn/mods/gen9dlc1";
import * as predlc from "@pkmn/mods/gen9predlc";
import legacy from "@/data/legacy-formats.json";
import { paldeaRules } from "./legacy-paldea-rule";
import { nfeRules } from "./legacy-nfe-rules";

Dex.mod("gen9dlc1" as ID, { ...dlc1, Scripts: { inherit: "gen9", gen: 9 } } as unknown as ModData);
Dex.mod("gen9predlc" as ID, predlc as unknown as ModData);
Dex.formats.extend([...paldeaRules, ...nfeRules, ...legacy] as Parameters<typeof Dex.formats.extend>[0]);
Dex.mod("gen9predlc").formats.extend([...paldeaRules, ...legacy] as Parameters<typeof Dex.formats.extend>[0]);

export { Dex, TeamValidator };
export function simulatorFor(formatId: string) {
  const format = Dex.formats.get(formatId);
  if (!format.exists) throw new Error("Formato não disponível no validador.");
  return new TeamValidator(format, Dex.mod(format.mod));
}
