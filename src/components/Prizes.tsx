import { formatMoney } from "@/lib/format";

type Podium = { first: string | null; second: string | null; third: string[] };

const PLACES = [
  { key: "second", place: "2º", ring: "border-[#c0c0c0] text-[#c0c0c0] shadow-[0_0_12px_#c0c0c0]", order: "order-2 sm:order-1", h: "sm:min-h-44" },
  { key: "first", place: "1º", ring: "border-[#ffd700] text-[#ffd700] shadow-[0_0_14px_#ffd700]", order: "order-1 sm:order-2", h: "sm:min-h-56" },
  { key: "third", place: "3º", ring: "border-[#cd7f32] text-[#cd7f32] shadow-[0_0_12px_#cd7f32]", order: "order-3", h: "sm:min-h-36" },
] as const;

/** Pódio no estilo do "Top Doadores" do site do servidor. */
export function Prizes({
  prizes,
  rewardDetails,
  podium,
}: {
  prizes: { first: number; second: number; third: number };
  rewardDetails: string;
  podium?: Podium;
}) {
  const hasMoney = prizes.first + prizes.second + prizes.third > 0;
  const winners = { first: podium?.first ?? null, second: podium?.second ?? null, third: podium?.third.join(" · ") || null };
  if (!hasMoney && !rewardDetails && !podium?.first) return null;

  return (
    <div className="space-y-5">
      {(hasMoney || podium?.first) && (
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          {PLACES.map((p) => (
            <div key={p.key} className={`card flex flex-col items-center justify-center gap-2 p-5 ${p.order} ${p.h}`}>
              <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-black/50 font-display text-lg font-black ${p.ring}`}>
                {p.place}
              </span>
              {prizes[p.key] > 0 && <span className="font-display text-2xl font-bold text-gold-100">{formatMoney(prizes[p.key])}</span>}
              {winners[p.key] && (
                <span className="text-center text-sm font-semibold text-gold-300">
                  <span aria-hidden>♛ </span>
                  {winners[p.key]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {rewardDetails && (
        <div className="panel-soft p-4">
          <p className="label">Recompensas</p>
          <p className="whitespace-pre-line text-sm text-stone-200">{rewardDetails}</p>
        </div>
      )}
    </div>
  );
}
