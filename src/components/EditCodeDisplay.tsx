"use client";

import { useEffect, useState } from "react";

export const EDIT_CODE_STORAGE_KEY = "reino_edit_code";

/** Código de edição em destaque, com botão de copiar. */
export function EditCodeBox({ code, note }: { code: string; note?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // O código continua visível para anotar
    }
  }

  return (
    <div className="rounded-sm border-2 border-gold-400/60 bg-gold-400/[0.07] p-4 text-center sm:p-5">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold-300">Código de edição</p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex items-center gap-3 rounded-sm bg-black/50 px-4 py-2.5 transition hover:bg-black/70"
        aria-label={`Copiar código ${code}`}
      >
        <code className="font-mono text-2xl font-bold tracking-widest text-gold-100 sm:text-3xl">{code}</code>
        <span
          className={`rounded-sm px-2 py-1 text-[11px] font-bold uppercase ${copied ? "bg-emerald-600 text-white" : "bg-gold-400/15 text-gold-200"}`}
          aria-live="polite"
        >
          {copied ? "Copiado!" : "Copiar"}
        </span>
      </button>
      {note && <div className="mt-3 text-xs text-stone-300">{note}</div>}
    </div>
  );
}

/**
 * Mostra o código gerado na inscrição. Ele vem da resposta da API e fica apenas
 * no sessionStorage desta aba — o servidor guarda só o hash, então não há como
 * exibi-lo de novo depois.
 */
export function EditCodeReveal({ registrationCode }: { registrationCode: string | null }) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EDIT_CODE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { registrationCode?: string; editCode?: string };
      if (saved.editCode && saved.registrationCode === registrationCode) setCode(saved.editCode);
    } catch {
      // Armazenamento indisponível
    }
  }, [registrationCode]);

  if (!code) {
    return (
      <p className="panel-soft p-4 text-center text-sm text-stone-400">
        O código de edição só é exibido logo após a inscrição. Se você não anotou, peça um novo código à organização.
      </p>
    );
  }

  return (
    <EditCodeBox
      code={code}
      note={
        <>
          <strong className="text-gold-200">Guarde este código!</strong> Ele aparece só agora e permite alterar seu time em{" "}
          <span className="font-semibold text-white">Alterar meu time</span> enquanto as inscrições estiverem abertas. Não
          compartilhe com ninguém.
        </>
      }
    />
  );
}
