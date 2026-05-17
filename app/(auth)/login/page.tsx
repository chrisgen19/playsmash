import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const safeUrl = safeCallbackUrl(callbackUrl);

  const user = await getCurrentUser();
  if (user) redirect(safeUrl);

  const showGoogle =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return <LoginForm callbackUrl={safeUrl} showGoogle={showGoogle} />;
}
