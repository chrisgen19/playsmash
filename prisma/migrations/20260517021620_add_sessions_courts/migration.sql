-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('RALLY', 'SIDE_OUT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlaySessionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SessionPlayerStatus" AS ENUM ('AVAILABLE', 'WAITING', 'PLAYING', 'RESTING', 'LEFT');

-- CreateTable
CREATE TABLE "PlaySession" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "numberOfCourts" INTEGER NOT NULL DEFAULT 1,
    "scoringType" "ScoringType" NOT NULL DEFAULT 'RALLY',
    "pointsToWin" INTEGER NOT NULL DEFAULT 11,
    "winByTwo" BOOLEAN NOT NULL DEFAULT true,
    "status" "PlaySessionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "courtNumber" INTEGER NOT NULL,
    "status" "CourtStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "status" "SessionPlayerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "checkInOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaySession_groupId_date_idx" ON "PlaySession"("groupId", "date");

-- CreateIndex
CREATE INDEX "PlaySession_status_idx" ON "PlaySession"("status");

-- CreateIndex
CREATE INDEX "Court_groupId_idx" ON "Court"("groupId");

-- CreateIndex
CREATE INDEX "Court_sessionId_idx" ON "Court"("sessionId");

-- CreateIndex
CREATE INDEX "SessionPlayer_sessionId_status_idx" ON "SessionPlayer"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPlayer_sessionId_playerProfileId_key" ON "SessionPlayer"("sessionId", "playerProfileId");

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaySession" ADD CONSTRAINT "PlaySession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
