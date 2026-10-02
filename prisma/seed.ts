import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password-hash";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

/** Cria o admin inicial do .env. Torneios são criados pelo painel (/admin/tournaments). */
async function main() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.log("ℹ ADMIN_USERNAME/ADMIN_PASSWORD não definidos — nenhum admin criado.");
    return;
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD precisa ter pelo menos 10 caracteres.");
  if (/troque/i.test(password)) throw new Error("Troque ADMIN_PASSWORD no .env antes de rodar o seed.");

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`ℹ Admin "${username}" já existe — senha NÃO alterada. Use npm run admin:create para trocar.`);
    return;
  }
  await prisma.admin.create({
    data: { username, displayName: process.env.ADMIN_USERNAME!.trim(), passwordHash: await hashPassword(password) },
  });
  console.log(`✔ Admin "${username}" criado`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
