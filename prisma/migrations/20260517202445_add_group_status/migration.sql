-- Phase 8: group archive. Archived groups drop off the dashboard and reject
-- mutations; we keep the row (soft delete) so match history is never lost.
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Group"
  ADD COLUMN "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archivedAt" TIMESTAMP(3);
