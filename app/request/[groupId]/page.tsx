import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestToJoinForm } from "@/components/groups/request-to-join-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import {
  prisma,
  GroupMemberStatus,
  GroupStatus,
  GroupVisibility,
  JoinRequestStatus,
} from "@/lib/db";

/**
 * Public landing for `/request/<groupId>` — a signed-in non-member can ask
 * to join a PUBLIC group. Mirrors the `/join/[code]` flow for invite codes.
 */
export default async function RequestToJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { groupId } = await params;
  const { sent } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/request/${groupId}`)}`);
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, visibility: true, status: true },
  });

  // Already a member? Go straight in.
  if (group) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
      select: { status: true },
    });
    if (member?.status === GroupMemberStatus.ACTIVE) {
      redirect(`/groups/${groupId}`);
    }
  }

  const pending = group
    ? await prisma.joinRequest.findUnique({
        where: { groupId_userId: { groupId, userId: user.id } },
        select: { status: true },
      })
    : null;

  const notJoinable =
    !group ||
    group.status !== GroupStatus.ACTIVE ||
    group.visibility !== GroupVisibility.PUBLIC;
  const alreadyPending =
    pending?.status === JoinRequestStatus.PENDING || sent === "1";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {group ? `Join ${group.name}` : "Group not found"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!group ? (
            <p className="text-muted-foreground text-sm">
              This group doesn&apos;t exist or the link is wrong.
            </p>
          ) : alreadyPending ? (
            <p className="text-muted-foreground text-sm">
              Your request has been sent. An admin will review it soon.
            </p>
          ) : notJoinable ? (
            <p className="text-muted-foreground text-sm">
              This group isn&apos;t open to join requests. Ask an admin for an
              invite code instead.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                This is a public group. Send a request and an admin will let
                you in.
              </p>
              <RequestToJoinForm groupId={group.id} />
            </>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">← Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
