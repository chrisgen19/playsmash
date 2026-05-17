import Link from "next/link";

import { AppHeader } from "@/components/shared/app-header";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export default async function NewGroupPage() {
  const user = await requireUser("/groups/new");

  return (
    <>
      <AppHeader userEmail={user.email} />
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">← Back to dashboard</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create a group</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateGroupForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
