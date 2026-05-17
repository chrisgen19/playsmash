import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight hover:underline"
          >
            Playsmash
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
