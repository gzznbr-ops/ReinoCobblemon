import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Cookie assinado (HMAC) que permite ao jogador ver SOMENTE a própria
 * confirmação em /registration/success, sem expor IDs na URL.
 */
export const REGISTRATION_COOKIE = "reino_reg";
export const REGISTRATION_COOKIE_MAX_AGE = 60 * 60; // 1 hora

function sign(value: string): string {
  return createHmac("sha256", env.authSecret).update(`registration:${value}`).digest("base64url");
}

export function createRegistrationToken(registrationId: string): string {
  const expires = Date.now() + REGISTRATION_COOKIE_MAX_AGE * 1000;
  const payload = `${registrationId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function readRegistrationToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${id}.${expires}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (Number(expires) < Date.now()) return null;
  return id;
}
