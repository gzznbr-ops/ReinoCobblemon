"use client";

import { withBase } from "@/lib/base-path";
import { useState } from "react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha no login.");
        return;
      }
      // Navegação completa para o layout protegido ler o novo cookie
      window.location.href = withBase("/admin");
    } catch {
      setError("Falha de conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="username" className="label">
          Usuário
        </label>
        <input
          id="username"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          required
          maxLength={64}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Senha
        </label>
        <input
          id="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-200">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy || !username || !password}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
