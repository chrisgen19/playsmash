-- CreateEnum
CREATE TYPE "WinningTeam" AS ENUM ('TEAM_1', 'TEAM_2');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "courtId" TEXT,
    "roundNumber" INTEGER NOT NULL,
    "team1Player1Id" TEXT NOT NULL,
    "team1Player2Id" TEXT,
    "team2Player1Id" TEXT NOT NULL,
    "team2Player2Id" TEXT,
    "team1Score" INTEGER,
    "team2Score" INTEGER,
    "winningTeam" "WinningTeam",
    "status" "MatchStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_sessionId_roundNumber_idx" ON "Match"("sessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "Match_sessionId_status_idx" ON "Match"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Match_courtId_idx" ON "Match"("courtId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team1Player1Id_fkey" FOREIGN KEY ("team1Player1Id") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team1Player2Id_fkey" FOREIGN KEY ("team1Player2Id") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team2Player1Id_fkey" FOREIGN KEY ("team2Player1Id") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_team2Player2Id_fkey" FOREIGN KEY ("team2Player2Id") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
