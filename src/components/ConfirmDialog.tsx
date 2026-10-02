"use client";

import { useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "success";
  /** Mostra um campo de texto obrigatório (ex.: motivo da rejeição) */
  input?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    suggestions?: string[];
    /** Confirmação digitada: o botão só libera quando o texto for exatamente este */
    mustEqual?: string;
  };
};

export function ConfirmDialog({
  options,
  busy,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions | null;
  busy?: boolean;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const cancelRef = useRef(onCancel);
  cancelRef.current = busy ? () => undefined : onCancel;

  const openKey = options ? options.title : null;
  const hasInput = Boolean(options?.input);

  useEffect(() => {
    if (openKey === null) return;
    setValue("");
    const t = setTimeout(() => (hasInput ? inputRef.current : confirmRef.current)?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancelRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [openKey, hasInput]);

  if (!options) return null;

  const minLength = options.input?.minLength ?? 3;
  const invalid =
    Boolean(options.input) &&
    (options.input?.mustEqual !== undefined ? value.trim() !== options.input.mustEqual.trim() : value.trim().length < minLength);
  const toneClass =
    options.tone === "danger" ? "btn bg-red-600 text-white hover:bg-red-500" : options.tone === "success" ? "btn-success" : "btn-primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => !busy && onCancel()}
    >
      <div className="card w-full max-w-md animate-pop p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="heading text-lg text-gold-100">
          {options.title}
        </h2>
        <div className="mt-2 text-sm text-stone-300">{options.message}</div>

        {options.input && (
          <div className="mt-4">
            <label className="label" htmlFor="confirm-input">
              {options.input.label}
            </label>
            {options.input.suggestions && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {options.input.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setValue(s)}
                    className="rounded-sm border border-gold-600/40 bg-black/30 px-2 py-1 text-xs text-stone-300 hover:bg-gold-400/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <textarea
              id="confirm-input"
              ref={inputRef}
              className="input min-h-20 resize-y"
              maxLength={300}
              placeholder={options.input.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={toneClass}
            disabled={busy || invalid}
            onClick={() => onConfirm(options.input ? value.trim() : undefined)}
          >
            {busy ? "Salvando…" : (options.confirmLabel ?? "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
