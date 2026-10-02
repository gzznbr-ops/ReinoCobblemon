const TIMEZONE = process.env.DISPLAY_TIMEZONE || "America/Sao_Paulo";

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("pt-BR")}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, dateStyle: "short" }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** "sábado, 20/09/2026 às 19:00" */
export function formatEventDate(date: Date | string): string {
  const d = new Date(date);
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day} às ${time}`;
}

/** Partes de data/hora de um instante no fuso de exibição. */
function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Instante UTC → valor de <input type="datetime-local"> no fuso de exibição. */
export function toDateTimeLocalInput(date: Date | string): string {
  const p = zonedParts(new Date(date));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Valor de <input type="datetime-local"> (interpretado no fuso de exibição) → instante UTC. */
export function fromDateTimeLocalInput(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Ajusta pelo deslocamento do fuso (duas passadas cobrem mudanças de horário de verão)
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    guess += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function registrationCode(number: number): string {
  return `REINO-${String(number).padStart(4, "0")}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
