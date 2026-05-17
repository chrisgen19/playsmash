import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma, GroupRole, PlayerStatus } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  try {
    await requireGroupRole(groupId, OWNERS_AND_ADMINS);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect(`/groups/${groupId}/sessions`);
    throw err;
  }

  // Non-removed players are eligible; temporary players are included.
  const players = await prisma.playerProfile.findMany({
    where: {
      groupId,
      status: { in: [PlayerStatus.ACTIVE, PlayerStatus.TEMPORARY] },
    },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/groups/${groupId}/sessions`}>← Back to sessions</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New session</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSessionForm groupId={groupId} players={players} />
        </CardContent>
      </Card>
    </main>
  );
}
