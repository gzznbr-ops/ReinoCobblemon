"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useState } from "react";
import type { PokemonEntry } from "@/lib/rules/tournament-rules";

const cache = new Map<string, Promise<PokemonEntry[]>>();

function load(source: string): Promise<PokemonEntry[]> {
  let pending = cache.get(source);
  if (!pending) {
    pending = fetch(source)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar Pokémon");
        return res.json() as Promise<PokemonEntry[]>;
      })
      .catch((error) => {
        cache.delete(source);
        throw error;
      });
    // A lista do admin muda junto com as regras: não fica em cache na sessão
    if (source.includes("/api/pokemon?")) cache.set(source, pending);
  }
  return pending;
}

/**
 * Lista de Pokémon com a legalidade calculada pelo servidor para um torneio.
 * `source` é a URL da API (pública por slug ou do admin por id).
 */
export function usePokemonList(source: string) {
  const [list, setList] = useState<PokemonEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setList(null);
    load(source)
      .then((data) => active && setList(data))
      .catch(() => active && setError("Não foi possível carregar a lista de Pokémon. Recarregue a página."));
    return () => {
      active = false;
    };
  }, [source]);

  return { list, error };
}

export const publicPokemonUrl = (slug: string) => withBase(`/api/pokemon?torneio=${encodeURIComponent(slug)}`);
