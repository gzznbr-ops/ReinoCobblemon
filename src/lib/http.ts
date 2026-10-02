import "server-only";
import { NextResponse } from "next/server";
import { env } from "./env";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Proteção CSRF para requisições que alteram dados: o header Origin (ou
 * Referer) precisa pertencer ao mesmo host da requisição, e o navegador não
 * pode ter marcado a requisição como vinda de outro site.
 */
export function isSameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  // X-Forwarded-Host só é confiável atrás de um proxy que o define
  const forwarded = env.trustProxy === "true" ? req.headers.get("x-forwarded-host") : null;
  const host = forwarded ?? req.headers.get("host");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function getClientIp(req: Request): string {
  // Na Cloudflare, cf-connecting-ip é definido pela própria rede e não pode ser forjado
  if (env.trustProxy === "cloudflare") {
    return req.headers.get("cf-connecting-ip")?.trim() || "unknown";
  }
  if (env.trustProxy === "true") {
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  }
  return "unknown";
}

const MAX_BODY_BYTES = 16 * 1024;

/**
 * Lê JSON com limite de tamanho (conferido em bytes enquanto o corpo chega, mesmo
 * sem Content-Length). Exige Content-Type JSON, o que também impede formulários
 * HTML de outros sites. Retorna undefined se inválido.
 */
export async function readJson(req: Request): Promise<unknown> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return undefined;
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES || !req.body) return undefined;
  try {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}
