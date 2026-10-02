import "server-only";

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou muito curto (mínimo 32 caracteres). Veja .env.example.");
  }
  return secret;
}

export const env = {
  get authSecret() {
    return authSecret();
  },
  get trustProxy() {
    return process.env.TRUST_PROXY ?? "false";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
