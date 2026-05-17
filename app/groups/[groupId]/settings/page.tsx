import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma, GroupRole } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
} from "@/lib/permissions/errors";
import { requireGroupRole } from "@/lib/permissions/group";

import { regenerateJoinCodeAction } from "./actions";

const OWNERS_AND_ADMINS = [GroupRole.OWNER, GroupRole.ADMIN] as const;

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  try {
    await requireGroupRole(groupId, OWNERS_AND_ADMINS);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) redirect(`/groups/${groupId}`);
    throw err;
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      joinCode: true,
      visibility: true,
      description: true,
    },
  });
  if (!group) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Join code</CardTitle>
          <CardDescription>
            Share this code with players to let them join. Regenerating
            disables the current code immediately — anyone holding the old
            one will need the new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-2xl tracking-widest">
            {group.joinCode}
          </div>
          <form action={regenerateJoinCodeAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <Button type="submit" variant="outline">
              Regenerate
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Group info</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>
            <span className="text-foreground">Name:</span> {group.name}
          </p>
          <p>
            <span className="text-foreground">Visibility:</span>{" "}
            {group.visibility}
          </p>
          {group.description && (
            <p>
              <span className="text-foreground">Description:</span>{" "}
              {group.description}
            </p>
          )}
          <p className="pt-2 italic">
            Editing name/visibility, ownership transfer, and group deletion
            arrive in Phase 8.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
