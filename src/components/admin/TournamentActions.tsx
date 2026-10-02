"use client";

import type { TournamentStatus } from "@prisma/client";
import { tournamentUrl, useAdminAction } from "./useAdminAction";

/** Botões rápidos do torneio: publicar, abrir/encerrar inscrições, cancelar. */
export function TournamentActions({
  id,
  name,
  status,
  registrationsOpen,
  full,
}: {
  id: string;
  name: string;
  status: TournamentStatus;
  registrationsOpen: boolean;
  full: boolean;
}) {
  const { confirm, error, dialog } = useAdminAction();
  const url = tournamentUrl(id);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <button
            type="button"
            className="btn-success"
            onClick={() =>
              confirm({
                options: {
                  title: "Publicar torneio?",
                  message: `${name} aparecerá no site${registrationsOpen ? " com as inscrições abertas" : ""}.`,
                  confirmLabel: "Publicar",
                  tone: "success",
                },
                build: () => ({ url, method: "PATCH", body: { status: "SCHEDULED" } }),
              })
            }
          >
            Publicar no site
          </button>
        )}
        {status === "SCHEDULED" && (
          <button
            type="button"
            className={registrationsOpen ? "btn-danger" : "btn-success"}
            onClick={() =>
              confirm({
                options: {
                  title: registrationsOpen ? "Encerrar inscrições?" : "Abrir inscrições?",
                  message: registrationsOpen
                    ? "O formulário público deixará de aceitar novas inscrições e trocas de time."
                    : full
                      ? "Todas as vagas estão ocupadas: o formulário só aceitará inscrições quando houver vaga."
                      : "O formulário público voltará a aceitar inscrições.",
                  confirmLabel: registrationsOpen ? "Encerrar" : "Abrir",
                  tone: registrationsOpen ? "danger" : "success",
                },
                build: () => ({ url, method: "PATCH", body: { registrationsOpen: !registrationsOpen } }),
              })
            }
          >
            {registrationsOpen ? "Encerrar inscrições" : "Abrir inscrições"}
          </button>
        )}
        {status !== "CANCELLED" && status !== "FINISHED" && status !== "DRAFT" && (
          <button
            type="button"
            className="btn-ghost text-xs text-red-300"
            onClick={() =>
              confirm({
                options: {
                  title: "Cancelar torneio?",
                  message: "O torneio continua visível no site como Cancelado e deixa de aceitar inscrições.",
                  confirmLabel: "Cancelar torneio",
                  tone: "danger",
                },
                build: () => ({ url, method: "PATCH", body: { status: "CANCELLED", registrationsOpen: false } }),
              })
            }
          >
            Cancelar torneio
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {dialog}
    </div>
  );
}
