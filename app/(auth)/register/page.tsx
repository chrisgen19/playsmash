import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <RegisterForm />;
}
