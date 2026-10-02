/**
 * Hash de senha com PBKDF2-SHA256 via WebCrypto (nativo no Node e nos
 * Cloudflare Workers). O bcrypt em JavaScript estoura o limite de CPU do plano
 * gratuito dos Workers; o PBKDF2 nativo é muito mais rápido por iteração.
 *
 * Formato: pbkdf2-sha256$<iterações>$<salt base64>$<hash base64>
 * 100.000 é o máximo de iterações aceito pelos Workers.
 * Hashes bcrypt antigos ($2a/$2b) continuam sendo aceitos na verificação.
 */
import bcrypt from "bcryptjs";

const ITERATIONS = 100_000;
const KEY_BITS = 256;

const toB64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf as ArrayBuffer).toString("base64");
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) return bcrypt.compare(password, stored);
  const [scheme, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== "pbkdf2-sha256" || !salt || !hash || !Number.isInteger(iterations) || iterations > ITERATIONS) {
    return false;
  }
  return constantTimeEqual(await derive(password, fromB64(salt), iterations), fromB64(hash));
}
