-- Formatos e ciclo de vida da competição
CREATE TYPE "CompetitionFormat" AS ENUM ('SINGLE_ELIMINATION', 'ROUND_ROBIN');
CREATE TYPE "TournamentParticipantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'DISQUALIFIED');
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'BYE', 'CANCELLED');
CREATE TYPE "MatchResultType" AS ENUM ('NORMAL', 'DRAW', 'WALKOVER', 'DISQUALIFICATION');

ALTER TABLE "Tournament"
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "competitionFormat" "CompetitionFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
  ADD COLUMN "roundRobinTurns" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pointsForWin" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "pointsForDraw" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pointsForLoss" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "allowDraw" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduleGeneratedAt" TIMESTAMP(3);

UPDATE "Tournament"
SET "scheduleGeneratedAt" = "bracketGeneratedAt"
WHERE "bracketGeneratedAt" IS NOT NULL;

ALTER TABLE "Match"
  ADD COLUMN "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "resultType" "MatchResultType",
  ADD COLUMN "player1Score" INTEGER,
  ADD COLUMN "player2Score" INTEGER,
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Match"
SET
  "status" = CASE
    WHEN "winnerId" IS NOT NULL AND ("player1Id" IS NULL OR "player2Id" IS NULL) THEN 'BYE'::"MatchStatus"
    WHEN "winnerId" IS NOT NULL THEN 'COMPLETED'::"MatchStatus"
    WHEN "scheduledAt" IS NOT NULL THEN 'SCHEDULED'::"MatchStatus"
    ELSE 'PENDING'::"MatchStatus"
  END,
  "resultType" = CASE WHEN "winnerId" IS NOT NULL AND "player1Id" IS NOT NULL AND "player2Id" IS NOT NULL THEN 'NORMAL'::"MatchResultType" ELSE NULL END,
  "completedAt" = CASE WHEN "winnerId" IS NOT NULL AND "player1Id" IS NOT NULL AND "player2Id" IS NOT NULL THEN "updatedAt" ELSE NULL END;

CREATE TABLE "TournamentParticipant" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "seed" INTEGER NOT NULL,
  "status" "TournamentParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_registrationId_key"
  ON "TournamentParticipant"("tournamentId", "registrationId");
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_seed_key"
  ON "TournamentParticipant"("tournamentId", "seed");
CREATE INDEX "TournamentParticipant_registrationId_idx"
  ON "TournamentParticipant"("registrationId");

ALTER TABLE "TournamentParticipant"
  ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentParticipant"
  ADD CONSTRAINT "TournamentParticipant_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
