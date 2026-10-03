"use client";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { SHOWDOWN_SOURCE } from "@/lib/rules/showdown";
import { formatDateTime } from "@/lib/format";

type Check = { currentVersion: string; simVersion: string; modsVersion: string; availableVersion: string | null; synchronized: boolean };
type Status = { version: string; pending: boolean; buildId: string | null; publishing: boolean;
  lastError: string | null; configured: boolean; unfinished: number; currentVersion: string };
const dashboard = "https://dash.cloudflare.com/0ba2b635cd66b2f5fd5d159705d3c108/workers/services/view/reino-cobblemon/production/builds";

export function RulesUpdater() {
  const [status, setStatus] = useState<Status | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function request(path: string, body?: object) {
    const response = await fetch(withBase(`/api/admin/showdown/${path}`), body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    } : { cache: "no-store" });
    if (response.status === 401) { window.location.href = withBase("/admin/login"); throw new Error("Entre novamente."); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Falha de conexão.");
    return data;
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next: Status = await request("update");
        if (!active) return;
        setStatus(next);
        if (next.currentVersion !== SHOWDOWN_SOURCE.version) {
          setNotice(`Validador ${next.currentVersion} publicado. Recarregue a página para ver as banlists atualizadas.`);
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Falha de conexão."); }
      if (active) timer = setTimeout(refresh, 10000);
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, []);

  async function verify() {
    setBusy(true); setError(null); setNotice(null);
    try { setCheck(await request("check")); setStatus(await request("update")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  async function apply(retry = false) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await request("update", retry ? { retry: true } : { version: check?.availableVersion });
      setNotice("Atualização solicitada. A Cloudflare instalará a versão aprovada, verificará os testes e publicará o site.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão."); }
    finally {
      try { setStatus(await request("update")); } catch { /* Preserve the action's error. */ }
      setBusy(false);
    }
  }

  return <section className="card space-y-4 p-5 sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="label">Dados em uso no site</p>
        <p className="font-display text-xl font-bold text-gold-100">Pokémon Showdown · validador {SHOWDOWN_SOURCE.version}</p>
        <p className="text-sm text-stone-400">Banlists e validador sincronizados em {formatDateTime(SHOWDOWN_SOURCE.generatedAt)}</p>
      </div>
      <button type="button" className="btn-primary shrink-0" disabled={busy} onClick={verify}>
        {busy ? "Aguarde…" : "♦ Verificar banlists no Showdown ♦"}
      </button>
    </div>
    <p className="text-xs text-stone-400">A verificação acompanha as versões publicadas de @pkmn/sim e @pkmn/mods, que incorporam as regras do Showdown. Mudanças no repositório oficial podem chegar aos pacotes depois.</p>
    {error && <p role="alert" className="rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    {notice && <div role="status" className="panel-soft p-3 text-sm text-emerald-200">{notice}
      {status?.currentVersion !== SHOWDOWN_SOURCE.version && <button className="btn-secondary ml-3" onClick={() => window.location.reload()}>Recarregar banlists</button>}
    </div>}
    {status && !status.configured && <p className="text-sm text-gold-200">Atualização automática aguardando configuração da conexão com a Cloudflare.</p>}
    {status?.pending ? <div className="panel-soft space-y-3 p-4 text-sm" aria-live="polite">
      <p className="font-semibold">Atualização para {status.version}: {status.publishing ? "publicando e confirmando o site…" : status.buildId ? "preparando e testando…" : "aguardando início do build"}</p>
      <p>Novos torneios ficam bloqueados até a conclusão desta atualização.</p>
      {status.lastError && <p className="text-red-200">{status.lastError}</p>}
      <a className="text-gold-300 underline" href={dashboard} target="_blank" rel="noopener noreferrer">Acompanhar na Cloudflare</a>
      {!status.buildId && !status.publishing && <button className="btn-secondary ml-3" disabled={busy || !status.configured} onClick={() => apply(true)}>Tentar novamente</button>}
    </div> : check && <div className="panel-soft space-y-3 p-4 text-sm">
      <p className="font-semibold">{check.availableVersion ? `Nova versão disponível: ${check.availableVersion}` : check.synchronized ? "Nenhuma versão mais nova do validador disponível." : "Aguardando versões compatíveis do validador e dos mods."}</p>
      {check.availableVersion && <>
        <p>A Cloudflare atualizará as banlists e o validador juntos, testará e publicará o site.</p>
        {Boolean(status?.unfinished) && <p className="text-gold-200">Encerre ou cancele os {status?.unfinished} torneio(s) não finalizado(s) antes de atualizar, incluindo rascunhos.</p>}
        <button className="btn-primary" disabled={busy || !status?.configured || Boolean(status.unfinished) || Boolean(status.buildId)} onClick={() => apply()}>Aplicar atualizações?</button>
      </>}
    </div>}
  </section>;
}
