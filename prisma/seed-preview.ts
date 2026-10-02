import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password-hash";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55432/reino_preview?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const names = ["AshReino", "MistyWater", "BrockPedra", "CynthiaBR", "RedKanto", "IrisDragon"];

async function createDemoTournament(slug: string, competitionFormat: "SINGLE_ELIMINATION" | "ROUND_ROBIN") {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + (competitionFormat === "ROUND_ROBIN" ? 3 * 24 : 4) * 60 * 60 * 1000);
  const existing = await prisma.tournament.findUnique({ where: { slug } });
  if (existing) {
    await prisma.match.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.registration.deleteMany({ where: { tournamentId: existing.id } });
    await prisma.tournament.delete({ where: { id: existing.id } });
  }
  const tournament = await prisma.tournament.create({
    data: {
      slug,
      name: competitionFormat === "ROUND_ROBIN" ? "Copa Preview — Pontos Corridos" : "Copa Preview — Chaveamento",
      description: "Torneio local criado apenas para validar o novo fluxo antes da publicação.",
      status: "SCHEDULED",
      startsAt,
      endsAt,
      competitionFormat,
      roundRobinTurns: 1,
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      allowDraw: true,
      formatId: "cobblemonfreeforall",
      teamSize: 6,
      matchFormat: "MD3",
      allowRestricted: true,
      allowLegendary: true,
      allowMythical: true,
      allowUltraBeast: true,
      allowParadox: true,
      bannedPokemonIds: [],
      allowedPokemonIds: [],
      maxParticipants: 16,
      registrationsOpen: false,
      thirdPlaceMatch: competitionFormat === "SINGLE_ELIMINATION",
    },
  });

  for (const nickname of names) {
    const registration = await prisma.registration.create({
      data: {
        tournamentId: tournament.id,
        nickname,
        nicknameNormalized: nickname.toLowerCase(),
        status: "APPROVED",
        paid: true,
        teamVerified: true,
        formatVerified: true,
        possibleTypes: [],
      },
    });
    await prisma.registration.update({ where: { id: registration.id }, data: { registrationCode: `PREVIEW-${registration.number}` } });
  }
}

async function main() {
  await prisma.admin.upsert({
    where: { username: "preview" },
    update: { passwordHash: await hashPassword("Preview2026!"), displayName: "Preview" },
    create: { username: "preview", displayName: "Preview", passwordHash: await hashPassword("Preview2026!") },
  });
  await createDemoTournament("preview-chaveamento", "SINGLE_ELIMINATION");
  await createDemoTournament("preview-pontos-corridos", "ROUND_ROBIN");
  console.log("✔ Prévia criada: usuário preview, dois torneios e seis aprovados em cada um.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
