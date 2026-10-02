"use client";

import { withBase } from "@/lib/base-path";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditCodeBox } from "@/components/EditCodeDisplay";
import { registrationUrl } from "./useAdminAction";

export function EditCodeManager({
  registrationId,
  nickname,
  createdAt,
}: {
  registrationId: string;
  nickname: string;
  createdAt: string | null;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(registrationUrl(registrationId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerateEditCode" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = withBase("/admin/login");
        return;
      }
      if (!res.ok || !data.editCode) {
        setError(data.error ?? "Não foi possível gerar o código.");
        return;
      }
      setNewCode(data.editCode);
      router.refresh();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="label">Código de edição do jogador</h2>
      {newCode ? (
        <EditCodeBox
          code={newCode}
          note={
            <>
              Entregue este código para <strong className="text-gold-100">{nickname}</strong> (confirme que é a pessoa dentro do
              servidor). Ele aparece só agora; o código anterior deixou de funcionar.
            </>
          }
        />
      ) : (
        <p className="mb-3 text-sm text-stone-400">
          {createdAt ? `Código atual gerado em ${createdAt}.` : "Esta inscrição ainda não tem código de edição."}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setConfirmOpen(true)} disabled={busy}>
        Gerar novo código
      </button>

      <ConfirmDialog
        options={
          confirmOpen
            ? {
                title: "Gerar novo código de edição?",
                message: `O código atual de ${nickname} deixará de funcionar. Faça isso apenas depois de confirmar a identidade do jogador dentro do servidor.`,
                confirmLabel: "Gerar código",
              }
            : null
        }
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={regenerate}
      />
    </section>
  );
}
