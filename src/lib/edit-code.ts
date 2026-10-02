import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Código de edição do time: 8 caracteres aleatórios (≈ 8,5 × 10¹¹ combinações),
 * sem caracteres ambíguos (0/O, 1/I/L). Só o HMAC é salvo no banco; o jogador vê
 * o código uma única vez. Tentativas são limitadas por IP e por nick.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 8;

export function generateEditCode(): string {
  const chars: string[] = [];
  const buf = new Uint8Array(1);
  while (chars.length < LENGTH) {
    crypto.getRandomValues(buf);
    // Rejeição para distribuição uniforme
    if (buf[0]! < 256 - (256 % ALPHABET.length)) chars.push(ALPHABET[buf[0]! % ALPHABET.length]!);
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export function normalizeEditCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashEditCode(code: string): string {
  return createHmac("sha256", env.authSecret).update(`edit-code:${normalizeEditCode(code)}`).digest("hex");
}

export function matchesEditCode(code: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, "hex");
  const received = Buffer.from(hashEditCode(code), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
