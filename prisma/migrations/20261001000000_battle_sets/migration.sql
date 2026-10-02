ALTER TABLE "RegistrationPokemon" ADD COLUMN "battleSet" JSONB;
-- Preserve historical approvals. Existing null sets require completion before
-- the new validator can approve them or generate new tournament matches.
