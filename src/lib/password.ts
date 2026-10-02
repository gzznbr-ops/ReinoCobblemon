import "server-only";
import { hashPassword, verifyPassword } from "./password-hash";

export { hashPassword, verifyPassword };

const DUMMY_HASH = "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/**
 * Faz uma verificação descartável quando o usuário não existe, para que o
 * tempo de resposta não revele se um username é válido.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH);
}
