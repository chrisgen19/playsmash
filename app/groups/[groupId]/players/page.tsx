import Link from "next/link";
import { notFound } from "next/navigation";

import { AddTempPlayerForm } from "@/components/groups/add-temp-player-form";
import { PlayerRowActions } from "@/components/groups/player-row-actions";
import { SuggestedLinks } from "@/components/groups/suggested-links";
import { suggestDuplicateLinks } from "@/lib/players/duplicate-suggestions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import {
  prisma,
  GroupMemberStatus,
  GroupRole,
  PlayerStatus,
} from "@/lib/db";
import { getGroupRole } from "@/lib/permissions/group";

export default async function GroupPlayersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  const actorRole = await getGroupRole(user.id, groupId);
  if (!actorRole) notFound();

  const canManage =
    actorRole === GroupRole.OWNER || actorRole === GroupRole.ADMIN;

  const players = await prisma.playerProfile.findMany({
    where: { groupId, status: { not: PlayerStatus.REMOVED } },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      skillLevel: true,
      notes: true,
      status: true,
      userId: true,
      user: {
        select: {
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Users who are members but have no linked PlayerProfile — surfaced as
  // link candidates for any temporary players.
  const membersWithoutProfile = await prisma.groupMember.findMany({
    where: {
      groupId,
      status: GroupMemberStatus.ACTIVE,
      user: {
        playerProfiles: {
          none: {
            groupId,
            status: { not: PlayerStatus.REMOVED },
          },
        },
      },
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
  const linkCandidates = membersWithoutProfile.map(({ user: u }) => ({
    userId: u.id,
    label:
      u.name ??
      ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email),
  }));

  // Likely-duplicate suggestions: a temporary profile whose name matches a
  // member who has no profile yet. Admins can one-click link these.
  //
  // Match only against members with a *real* name — never the email
  // fallback, or a temp player named like an email local-part would
  // false-positive into a one-click link.
  const namedCandidates = membersWithoutProfile
    .map(({ user: u }) => {
      const realName =
        u.name ?? [u.firstName, u.lastName].filter(Boolean).join(" ");
      return realName ? { userId: u.id, displayName: realName } : null;
    })
    .filter((c): c is { userId: string; displayName: string } => c !== null);

  const tempPlayers = players
    .filter((p) => p.userId === null && p.status !== PlayerStatus.REMOVED)
    .map((p) => ({ id: p.id, displayName: p.displayName }));
  const duplicateSuggestions = canManage
    ? suggestDuplicateLinks(tempPlayers, namedCandidates)
    : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-muted-foreground text-sm">
          {players.length} player{players.length === 1 ? "" : "s"} in this
          group, including temporary profiles.
        </p>
      </div>

      {canManage && duplicateSuggestions.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">
              Possible duplicates ({duplicateSuggestions.length})
            </CardTitle>
            <CardDescription>
              These temporary players look like members who just joined.
              Linking keeps their match history on the original profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SuggestedLinks
              groupId={groupId}
              suggestions={duplicateSuggestions}
            />
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Add temporary player</CardTitle>
            <CardDescription>
              For folks who don&apos;t have an account. You can link them to a
              user later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddTempPlayerForm groupId={groupId} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
          <CardDescription>
            Temporary profiles show a chip and can be linked to a user once
            they sign up.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border/60 divide-y">
          {players.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No players yet — add one above.
            </p>
          ) : (
            players.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/groups/${groupId}/players/${p.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {p.displayName}
                    </Link>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {p.user
                      ? `Linked: ${
                          p.user.name ??
                          ([p.user.firstName, p.user.lastName]
                            .filter(Boolean)
                            .join(" ") || p.user.email)
                        } · ${p.user.email}`
                      : "Temporary — no linked account"}
                    {p.skillLevel !== null && ` · skill ${p.skillLevel}`}
                  </p>
                </div>
                {canManage ? (
                  <PlayerRowActions
                    groupId={groupId}
                    player={p}
                    linkCandidates={linkCandidates}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Read-only
                  </span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case PlayerStatus.ACTIVE:
      return <Badge variant="secondary">Active</Badge>;
    case PlayerStatus.INACTIVE:
      return <Badge variant="outline">Inactive</Badge>;
    case PlayerStatus.TEMPORARY:
      return <Badge variant="outline">Temporary</Badge>;
    case PlayerStatus.REMOVED:
      return <Badge variant="destructive">Removed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
