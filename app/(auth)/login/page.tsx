import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl || "/dashboard");

  const showGoogle =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return <LoginForm callbackUrl={callbackUrl} showGoogle={showGoogle} />;
}
