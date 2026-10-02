"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RegistrationStatus } from "@prisma/client";
import { formatMoney } from "@/lib/format";
import { NICKNAME_REGEX } from "@/lib/nickname";
import { StatusBadge } from "./Badges";
import { registrationUrl, useAdminAction } from "./useAdminAction";

export type ManagedRegistration = {
  id: string;
  tournamentId: string;
  nickname: string;
  status: RegistrationStatus;
  paid: boolean;
  paidBy: string | null;
  paidAt: string;
  teamVerified: boolean;
  teamVerifiedBy: string | null;
  teamVerifiedAt: string;
  formatVerified: boolean;
  formatVerifiedBy: string | null;
  formatVerifiedAt: string;
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string;
};

const REJECT_SUGGESTIONS = ["Pokémon proibido", "Time diferente do registrado", "Não realizou pagamento", "Não compareceu"];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="label">{title}</h2>
      {children}
    </section>
  );
}

function Done({ text, by, at }: { text: string; by: string | null; at: string }) {
  return (
    <div>
      <p className="font-display text-lg font-bold text-emerald-300">✅ {text}</p>
      {by && (
        <p className="text-xs text-stone-500">
          por {by} em {at}
        </p>
      )}
    </div>
  );
}

export function RegistrationManager({
  reg,
  entryFee,
}: {
  reg: ManagedRegistration;
  entryFee: number;
}) {
  const router = useRouter();
  const { confirm, error, dialog } = useAdminAction();
  const [nickname, setNickname] = useState(reg.nickname);
  const url = registrationUrl(reg.id);
  const rejected = reg.status === "REJECTED";
  const formatLabel = "elegibilidade do time";

  const setFlag = (action: "setPaid" | "setFormatVerified" | "setTeamVerified", value: boolean, title: string, message: string) =>
    confirm({
      options: { title, message, tone: value ? "success" : "danger", confirmLabel: value ? "Confirmar" : "Desfazer" },
      build: () => ({ url, method: "PATCH", body: { action, value } }),
    });

  const missing = [!reg.paid && "pagamento", !reg.teamVerified && "time verificado", !reg.formatVerified && "formato verificado"].filter(
    Boolean,
  ) as string[];

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      {error && (
        <p role="alert" className="rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <Block title="Status final">
        <StatusBadge status={reg.status} large />
        {rejected ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-red-200">
              Motivo: <span className="font-semibold">{reg.rejectionReason}</span>
            </p>
            <p className="text-xs text-stone-500">
              por {reg.rejectedBy} em {reg.rejectedAt}
            </p>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() =>
                confirm({
                  options: {
                    title: "Reativar inscrição?",
                    message: "A inscrição volta a ocupar uma vaga e fica PENDENTE (se houver vaga disponível).",
                    confirmLabel: "Reativar",
                  },
                  build: () => ({ url, method: "PATCH", body: { action: "restore" } }),
                })
              }
            >
              Reativar inscrição
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-stone-400">
            {missing.length === 0 ? "Pagamento, time e formato verificados." : `Falta: ${missing.join(", ")}.`}
          </p>
        )}
      </Block>

      <Block title="Pagamento">
        <p className="mb-3 text-sm text-stone-400">
          Taxa de inscrição:{" "}
          <span className="font-display text-lg font-bold text-gold-100">{entryFee ? formatMoney(entryFee) : "Grátis"}</span>
        </p>
        {reg.paid ? (
          <div className="space-y-3">
            <Done text={entryFee ? "PAGAMENTO CONFIRMADO" : "PRESENÇA CONFIRMADA"} by={reg.paidBy} at={reg.paidAt} />
            <button
              type="button"
              className="btn-ghost w-full text-xs text-stone-400"
              onClick={() => setFlag("setPaid", false, "Desfazer pagamento?", `${reg.nickname} voltará a constar como NÃO pago.`)}
            >
              Desfazer (marcado por engano)
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-success w-full py-3"
            disabled={rejected}
            onClick={() =>
              setFlag(
                "setPaid",
                true,
                entryFee ? "Marcar como pago?" : "Confirmar presença?",
                entryFee ? `Confirme que ${reg.nickname} pagou ${formatMoney(entryFee)} no servidor.` : `Confirme a participação de ${reg.nickname}.`,
              )
            }
          >
            {entryFee ? "MARCAR COMO PAGO" : "CONFIRMAR PRESENÇA"}
          </button>
        )}
      </Block>

      <Block title="Time verificado no jogo">
        {reg.teamVerified ? (
          <div className="space-y-3">
            <Done text="TIME VERIFICADO" by={reg.teamVerifiedBy} at={reg.teamVerifiedAt} />
            <button
              type="button"
              className="btn-ghost w-full text-xs text-stone-400"
              onClick={() => setFlag("setTeamVerified", false, "Remover verificação do time?", "O time precisará ser conferido novamente.")}
            >
              Remover verificação
            </button>
          </div>
        ) : (
          <button type="button" className="btn-primary w-full py-3" disabled={rejected} onClick={() => router.push(`/admin/registrations/${reg.id}/verify`)}>
            VERIFICAR TIME
          </button>
        )}
      </Block>

      <Block title="Formato">
        {reg.formatVerified ? (
          <div className="space-y-3">
            <Done text="FORMATO VERIFICADO" by={reg.formatVerifiedBy} at={reg.formatVerifiedAt} />
            <button
              type="button"
              className="btn-ghost w-full text-xs text-stone-400"
              onClick={() => setFlag("setFormatVerified", false, "Remover verificação do formato?", `A confirmação de ${formatLabel} será removida.`)}
            >
              Remover verificação
            </button>
          </div>
        ) : (
          <label className={`panel-soft flex items-center gap-3 p-3 ${rejected ? "opacity-50" : "cursor-pointer hover:bg-gold-400/5"}`}>
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-500"
              checked={false}
              disabled={rejected}
              onChange={() =>
                setFlag("setFormatVerified", true, "Revalidar elegibilidade?", `O site vai validar novamente os dados de ${reg.nickname} pelas regras atuais do torneio.`)
              }
            />
            <span className="font-mono text-sm text-gold-100">Validar time automaticamente</span>
          </label>
        )}
      </Block>

      <Block title="Editar nick">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = nickname.trim();
            if (!NICKNAME_REGEX.test(next) || next === reg.nickname) return;
            confirm({
              options: { title: "Alterar nick?", message: `${reg.nickname} → ${next}`, confirmLabel: "Salvar" },
              build: () => ({ url, method: "PATCH", body: { action: "updateNickname", nickname: next } }),
            });
          }}
        >
          <input className="input" value={nickname} maxLength={16} onChange={(e) => setNickname(e.target.value.replace(/\s/g, ""))} />
          <button type="submit" className="btn-secondary shrink-0" disabled={!NICKNAME_REGEX.test(nickname.trim()) || nickname.trim() === reg.nickname}>
            Salvar
          </button>
        </form>
      </Block>

      <Block title="Zona de perigo">
        <div className="space-y-2">
          {!rejected && (
            <button
              type="button"
              className="btn-danger w-full"
              onClick={() =>
                confirm({
                  options: {
                    title: "Rejeitar inscrição?",
                    message: `A inscrição de ${reg.nickname} será rejeitada e deixará de ocupar vaga.`,
                    confirmLabel: "Rejeitar",
                    tone: "danger",
                    input: { label: "Motivo", placeholder: "Descreva o motivo", suggestions: REJECT_SUGGESTIONS },
                  },
                  build: (reason) => ({ url, method: "PATCH", body: { action: "reject", reason } }),
                })
              }
            >
              REJEITAR INSCRIÇÃO
            </button>
          )}
          <button
            type="button"
            className="btn w-full border border-red-600/50 text-red-400 hover:bg-red-700 hover:text-white"
            onClick={() =>
              confirm({
                options: {
                  title: "Excluir inscrição permanentemente?",
                  message: `Todos os dados de ${reg.nickname} serão apagados e o nick poderá se inscrever de novo neste torneio. A ação fica registrada no histórico.`,
                  confirmLabel: "Excluir",
                  tone: "danger",
                },
                build: () => ({ url, method: "DELETE" }),
                onSuccess: () => router.push(`/admin/registrations?torneio=${reg.tournamentId}`),
              })
            }
          >
            Excluir inscrição
          </button>
        </div>
      </Block>

      {dialog}
    </aside>
  );
}
