CREATE TABLE "RulesRelease" (
  "id" INTEGER NOT NULL,
  "version" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "pending" BOOLEAN NOT NULL DEFAULT false,
  "buildId" TEXT,
  "publishing" BOOLEAN NOT NULL DEFAULT false,
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RulesRelease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RulesRelease_singleton" CHECK ("id" = 1)
);
