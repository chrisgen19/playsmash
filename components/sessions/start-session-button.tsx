import { Button } from "@/components/ui/button";
import { startSessionAction } from "@/app/groups/[groupId]/sessions/actions";

export function StartSessionButton({
  groupId,
  sessionId,
  disabled,
}: {
  groupId: string;
  sessionId: string;
  disabled?: boolean;
}) {
  return (
    <form action={startSessionAction}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" disabled={disabled}>
        Start session
      </Button>
    </form>
  );
}
