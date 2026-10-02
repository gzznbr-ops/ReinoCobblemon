import { TYPE_COLORS, isPokemonType, typeLabel } from "@/lib/pokemon/types";

export function TypeBadge({ type, size = "sm" }: { type: string; size?: "xs" | "sm" | "md" }) {
  const color = isPokemonType(type) ? TYPE_COLORS[type] : "#71717a";
  const sizes = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-3 py-1 text-sm",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md font-bold uppercase tracking-wide text-white ${sizes[size]}`}
      style={{ backgroundColor: color, textShadow: "0 1px 1px rgb(0 0 0 / 0.35)" }}
    >
      {typeLabel(type)}
    </span>
  );
}

export function TypeList({ types, size = "sm" }: { types: string[]; size?: "xs" | "sm" | "md" }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {types.map((t) => (
        <TypeBadge key={t} type={t} size={size} />
      ))}
    </span>
  );
}
