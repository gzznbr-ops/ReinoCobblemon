/**
 * Cria um administrador ou redefine a senha de um existente.
 *
 *   npm run admin:create -- <usuario> <senha> ["Nome de exibição"]
 *
 * Redefinir a senha encerra todas as sessões abertas desse admin.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password-hash";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

async function main() {
  const [rawUsername, password, displayName] = process.argv.slice(2);
  if (!rawUsername || !password) {
    console.error('Uso: npm run admin:create -- <usuario> <senha> ["Nome de exibição"]');
    process.exit(1);
  }
  const username = rawUsername.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) throw new Error("Usuário inválido (3–32: letras, números, _ . -).");
  if (password.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");

  const passwordHash = await hashPassword(password);
  const existing = await prisma.admin.findUnique({ where: { username } });

  if (existing) {
    await prisma.$transaction([
      prisma.admin.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(displayName ? { displayName } : {}),
        },
      }),
      prisma.adminSession.deleteMany({ where: { adminId: existing.id } }),
    ]);
    console.log(`✔ Senha de "${username}" redefinida (sessões encerradas).`);
  } else {
    await prisma.admin.create({ data: { username, displayName: displayName ?? rawUsername.trim(), passwordHash } });
    console.log(`✔ Admin "${username}" criado.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
