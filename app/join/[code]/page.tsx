import { redirect } from "next/navigation";

import { JoinGroupForm } from "@/components/groups/join-group-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Public landing for `/join/<CODE>` links. If signed in, the form
 * pre-fills and joining is one click. If not, we send to /login with a
 * callbackUrl back to this page so they finish the join after auth.
 */
export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${normalized}`)}`);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            You&apos;ve been invited to a group. Confirm the code below to join.
          </p>
          <JoinGroupForm defaultCode={normalized} />
        </CardContent>
      </Card>
    </main>
  );
}
