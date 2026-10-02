/**
 * Caminho base do site (ex.: "/torneios" para reinocobblemon.com/torneios).
 * Definido em NEXT_PUBLIC_BASE_PATH no build; vazio = site na raiz do domínio.
 * Links do Next (<Link>, redirect, router.push) já recebem o prefixo sozinhos;
 * use withBase() em fetch(), window.location e <a href> comuns.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
