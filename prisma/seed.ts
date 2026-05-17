/**
 * Demo seed — one fully-populated group so a fresh clone has something to
 * click through. Idempotent: re-running deletes the prior demo group (by its
 * fixed join code) and rebuilds it.
 *
 * Run with `pnpm db:seed` (wired through prisma.config.ts → `tsx prisma/seed.ts`).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/db/generated/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — cannot seed.");
}

// Safety gate: the seed deletes the demo group by a fixed join code. Running
// it against production could destroy real data, so a prod run must opt in
// explicitly. Dev/test runs are unaffected.
if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_DEMO_SEED !== "true"
) {
  throw new Error(
    "Refusing to run the demo seed with NODE_ENV=production. " +
      "Set ALLOW_DEMO_SEED=true to override (staging only — never production).",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEMO_JOIN_CODE = "DEMO24";
const DEMO_PASSWORD = "playsmash-demo";

async function main() {
  console.log("Seeding demo data…");

  // 1. Wipe a prior demo group. Delete sessions first — Match and
  //    SessionPlayer hold ON DELETE Restrict FKs to PlayerProfile, so the
  //    group-delete cascade would otherwise fail trying to drop profiles
  //    that those rows still reference. Removing sessions clears them.
  const existing = await prisma.group.findUnique({
    where: { joinCode: DEMO_JOIN_CODE },
    select: { id: true },
  });
  if (existing) {
    await prisma.playSession.deleteMany({ where: { groupId: existing.id } });
    await prisma.group.delete({ where: { id: existing.id } });
    console.log("  removed previous demo group");
  }

  // 2. Demo users — upsert so we don't pile up duplicates across runs.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userSpecs = [
    { email: "demo.owner@playsmash.test", first: "Olivia", last: "Owner" },
    { email: "demo.admin@playsmash.test", first: "Adam", last: "Admin" },
    { email: "demo.pat@playsmash.test", first: "Pat", last: "Player" },
    { email: "demo.riley@playsmash.test", first: "Riley", last: "Rally" },
  ];
  const users = [];
  for (const spec of userSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: { passwordHash },
      create: {
        email: spec.email,
        firstName: spec.first,
        lastName: spec.last,
        name: `${spec.first} ${spec.last}`,
        passwordHash,
      },
    });
    users.push(user);
  }
  const [owner, admin, pat, riley] = users;

  // 3. Group + owner membership + owner profile + invite.
  const group = await prisma.group.create({
    data: {
      name: "Demo Pickleball Club",
      description: "Seeded demo group — log in with any demo.* account.",
      joinCode: DEMO_JOIN_CODE,
      visibility: "PUBLIC",
      createdByUserId: owner.id,
    },
  });

  await prisma.invite.create({
    data: {
      groupId: group.id,
      code: DEMO_JOIN_CODE,
      createdByUserId: owner.id,
      status: "ACTIVE",
    },
  });

  // Memberships: owner + admin + two players.
  const memberSpecs = [
    { user: owner, role: "OWNER" as const },
    { user: admin, role: "ADMIN" as const },
    { user: pat, role: "PLAYER" as const },
    { user: riley, role: "PLAYER" as const },
  ];
  for (const { user, role } of memberSpecs) {
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role, status: "ACTIVE" },
    });
  }

  // 4. Player profiles — one per member, plus two temporary players.
  const profiles = [];
  for (const { user } of memberSpecs) {
    const profile = await prisma.playerProfile.create({
      data: {
        groupId: group.id,
        userId: user.id,
        displayName: user.name ?? user.email,
        status: "ACTIVE",
        createdByUserId: owner.id,
        skillLevel: 3 + Math.random() * 2,
      },
    });
    profiles.push(profile);
  }
  for (const name of ["Guest Sam", "Guest Jordan", "Guest Taylor", "Guest Casey"]) {
    const profile = await prisma.playerProfile.create({
      data: {
        groupId: group.id,
        displayName: name,
        status: "TEMPORARY",
        createdByUserId: admin.id,
      },
    });
    profiles.push(profile);
  }
  // 8 players total → 2 full courts.

  // 5. A completed session with two courts.
  const session = await prisma.playSession.create({
    data: {
      groupId: group.id,
      name: "Saturday Open Play",
      date: new Date(),
      location: "Community Center",
      numberOfCourts: 2,
      scoringType: "RALLY",
      pointsToWin: 11,
      winByTwo: true,
      status: "ACTIVE",
      createdByUserId: owner.id,
    },
  });

  const courts = [];
  for (let i = 1; i <= 2; i++) {
    const court = await prisma.court.create({
      data: {
        groupId: group.id,
        sessionId: session.id,
        name: `Court ${i}`,
        courtNumber: i,
        status: "AVAILABLE",
      },
    });
    courts.push(court);
  }

  for (let i = 0; i < profiles.length; i++) {
    await prisma.sessionPlayer.create({
      data: {
        sessionId: session.id,
        playerProfileId: profiles[i].id,
        status: "WAITING",
        checkInOrder: i + 1,
      },
    });
  }

  // 6. Two completed matches in round 1 — players 0..3 and 4..7.
  const matchSpecs = [
    { court: courts[0], idx: [0, 1, 2, 3], t1: 11, t2: 7 },
    { court: courts[1], idx: [4, 5, 6, 7], t1: 9, t2: 11 },
  ];
  for (const spec of matchSpecs) {
    await prisma.match.create({
      data: {
        sessionId: session.id,
        courtId: spec.court.id,
        roundNumber: 1,
        team1Player1Id: profiles[spec.idx[0]].id,
        team1Player2Id: profiles[spec.idx[1]].id,
        team2Player1Id: profiles[spec.idx[2]].id,
        team2Player2Id: profiles[spec.idx[3]].id,
        team1Score: spec.t1,
        team2Score: spec.t2,
        winningTeam: spec.t1 > spec.t2 ? "TEAM_1" : "TEAM_2",
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  console.log("Demo seed complete:");
  console.log(`  Group:    Demo Pickleball Club (join code ${DEMO_JOIN_CODE})`);
  console.log(`  Login:    demo.owner@playsmash.test / ${DEMO_PASSWORD}`);
  console.log(`  Also:     demo.admin@, demo.pat@, demo.riley@playsmash.test`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
