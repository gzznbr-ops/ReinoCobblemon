-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "formatId" TEXT NOT NULL DEFAULT 'gen9ou',
    "teamSize" INTEGER NOT NULL DEFAULT 6,
    "matchFormat" TEXT NOT NULL DEFAULT 'MD1',
    "allowRestricted" BOOLEAN NOT NULL DEFAULT false,
    "allowLegendary" BOOLEAN NOT NULL DEFAULT false,
    "allowMythical" BOOLEAN NOT NULL DEFAULT false,
    "allowUltraBeast" BOOLEAN NOT NULL DEFAULT false,
    "allowParadox" BOOLEAN NOT NULL DEFAULT true,
    "bannedPokemonIds" INTEGER[],
    "allowedPokemonIds" INTEGER[],
    "monotype" BOOLEAN NOT NULL DEFAULT false,
    "monotypeMinimum" INTEGER NOT NULL DEFAULT 4,
    "maxWildcards" INTEGER NOT NULL DEFAULT 2,
    "customRules" TEXT NOT NULL DEFAULT '',
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "maxParticipants" INTEGER NOT NULL DEFAULT 16,
    "registrationsOpen" BOOLEAN NOT NULL DEFAULT false,
    "prizeFirst" INTEGER NOT NULL DEFAULT 0,
    "prizeSecond" INTEGER NOT NULL DEFAULT 0,
    "prizeThird" INTEGER NOT NULL DEFAULT 0,
    "rewardDetails" TEXT NOT NULL DEFAULT '',
    "thirdPlaceMatch" BOOLEAN NOT NULL DEFAULT true,
    "bracketGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "registrationCode" TEXT,
    "nickname" TEXT NOT NULL,
    "nicknameNormalized" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "mainType" TEXT,
    "possibleTypes" TEXT[],
    "typeAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "typeReviewedAt" TIMESTAMP(3),
    "typeReviewedBy" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "teamVerified" BOOLEAN NOT NULL DEFAULT false,
    "teamVerifiedAt" TIMESTAMP(3),
    "teamVerifiedBy" TEXT,
    "formatVerified" BOOLEAN NOT NULL DEFAULT false,
    "formatVerifiedAt" TIMESTAMP(3),
    "formatVerifiedBy" TEXT,
    "editCodeHash" TEXT,
    "editCodeCreatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationPokemon" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "pokemonName" TEXT NOT NULL,
    "types" TEXT[],
    "isWildcard" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistrationPokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "isThirdPlace" BOOLEAN NOT NULL DEFAULT false,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "winnerId" TEXT,
    "score" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "adminName" TEXT NOT NULL,
    "tournamentId" TEXT,
    "registrationId" TEXT,
    "participantNickname" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE INDEX "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_number_key" ON "Registration"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_registrationCode_key" ON "Registration"("registrationCode");

-- CreateIndex
CREATE INDEX "Registration_tournamentId_status_idx" ON "Registration"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "Registration_createdAt_idx" ON "Registration"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_tournamentId_nicknameNormalized_key" ON "Registration"("tournamentId", "nicknameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPokemon_registrationId_slot_key" ON "RegistrationPokemon"("registrationId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPokemon_registrationId_speciesId_key" ON "RegistrationPokemon"("registrationId", "speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_tournamentId_round_position_key" ON "Match"("tournamentId", "round", "position");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_registrationId_idx" ON "AuditLog"("registrationId");

-- CreateIndex
CREATE INDEX "AuditLog_tournamentId_idx" ON "AuditLog"("tournamentId");

-- CreateIndex
CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPokemon" ADD CONSTRAINT "RegistrationPokemon_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
