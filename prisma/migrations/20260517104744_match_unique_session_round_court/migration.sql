-- Defense-in-depth: one match per (session, round, court).
-- The application-level SELECT FOR UPDATE in generateNextRound already
-- serializes round creation, but a DB constraint prevents any duplicate
-- under retry races or future code paths. Postgres treats NULL as distinct
-- by default, so matches with no court assigned remain allowed.
CREATE UNIQUE INDEX "Match_sessionId_roundNumber_courtId_key"
  ON "Match"("sessionId", "roundNumber", "courtId");
