import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/(auth)/sign-out/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="text" size="sm" className={className}>
        Sign out
      </Button>
    </form>
  );
}
