"use client";

import { useRouter } from "next/navigation";
import { tournamentUrl, useAdminAction } from "./useAdminAction";

/** Exclui o torneio (com inscrições e chaves) após digitar o nome exato. */
export function DeleteTournamentButton({
  id,
  name,
  registrations,
  hasBracket,
  variant = "full",
}: {
  id: string;
  name: string;
  registrations: number;
  hasBracket: boolean;
  variant?: "full" | "compact";
}) {
  const router = useRouter();
  const { confirm, error, dialog } = useAdminAction();

  const lost = [
    registrations > 0 && `${registrations} inscrição(ões) com os times`,
    hasBracket && "as chaves e todos os resultados",
    "a página pública do torneio",
  ].filter(Boolean) as string[];

  function open() {
    confirm({
      options: {
        title: "Excluir torneio permanentemente?",
        tone: "danger",
        confirmLabel: "Excluir para sempre",
        message: (
          <div className="space-y-2">
            <p>
              Serão apagados: <strong className="text-red-200">{lost.join(", ")}</strong>.
            </p>
            <p>Não dá para desfazer. O histórico de ações é mantido.</p>
            {registrations > 0 && (
              <p className="text-gold-200">Se só quiser tirar o torneio do ar mantendo os dados, use “Cancelar torneio”.</p>
            )}
          </div>
        ),
        input: { label: `Digite o nome do torneio: ${name}`, placeholder: name, mustEqual: name },
      },
      build: (confirmName) => ({ url: tournamentUrl(id), method: "DELETE", body: { confirmName } }),
      onSuccess: () => router.push("/admin/tournaments"),
    });
  }

  return (
    <>
      {variant === "compact" ? (
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-red-300 hover:text-red-200" onClick={open}>
          Excluir
        </button>
      ) : (
        <section className="rounded-sm border border-red-600/40 bg-red-950/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display font-bold text-red-300">Zona de perigo</p>
              <p className="text-xs text-stone-400">Excluir apaga o torneio, as inscrições e as chaves. Não pode ser desfeito.</p>
            </div>
            <button type="button" className="btn shrink-0 border border-red-600/60 text-red-300 hover:bg-red-700 hover:text-white" onClick={open}>
              Excluir torneio
            </button>
          </div>
        </section>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {dialog}
    </>
  );
}
