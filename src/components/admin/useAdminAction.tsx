"use client";

import { withBase } from "@/lib/base-path";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, type ConfirmOptions } from "@/components/ConfirmDialog";

type Request = { url: string; method: "PATCH" | "PUT" | "DELETE" | "POST"; body?: unknown };

type Pending = {
  options: ConfirmOptions;
  build: (inputValue?: string) => Request;
  onSuccess?: (data: Record<string, unknown>) => void;
};

/**
 * Centraliza: diálogo de confirmação → chamada à API → mensagem de erro →
 * atualização dos dados da página (router.refresh).
 */
export function useAdminAction() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (request: Request, onSuccess?: (data: Record<string, unknown>) => void) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(request.url, {
          method: request.method,
          headers: request.body ? { "Content-Type": "application/json" } : undefined,
          body: request.body ? JSON.stringify(request.body) : undefined,
        });
        if (res.status === 401) {
          window.location.href = withBase("/admin/login");
          return false;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Não foi possível concluir a ação.");
          return false;
        }
        onSuccess?.(data);
        router.refresh();
        return true;
      } catch {
        setError("Falha de conexão.");
        return false;
      } finally {
        setBusy(false);
        setPending(null);
      }
    },
    [router],
  );

  const confirm = useCallback((p: Pending) => {
    setError(null);
    setPending(p);
  }, []);

  const dialog = (
    <ConfirmDialog
      options={pending?.options ?? null}
      busy={busy}
      onCancel={() => setPending(null)}
      onConfirm={(value) => pending && run(pending.build(value), pending.onSuccess)}
    />
  );

  return { confirm, run, busy, error, setError, dialog };
}

export const registrationUrl = (id: string) => withBase(`/api/admin/registrations/${encodeURIComponent(id)}`);
export const tournamentUrl = (id: string) => withBase(`/api/admin/tournaments/${encodeURIComponent(id)}`);
