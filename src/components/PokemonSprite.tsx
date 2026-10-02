"use client";

import { useState } from "react";
import { spriteUrl } from "@/lib/pokemon/types";

export function PokemonSprite({
  pokemonId,
  name,
  size = 64,
  className = "",
}: {
  pokemonId: number;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-white/5 font-display font-bold text-stone-400 ${className}`}
        style={{ width: size, height: size, fontSize: size / 3 }}
        aria-label={name}
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spriteUrl(pokemonId)}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`select-none object-contain [image-rendering:pixelated] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
