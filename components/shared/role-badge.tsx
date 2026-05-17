import { Badge } from "@/components/ui/badge";
import type { GroupRoleValue } from "@/lib/permissions/group";

const VARIANTS: Record<
  GroupRoleValue,
  "default" | "secondary" | "outline" | "destructive"
> = {
  OWNER: "default",
  ADMIN: "default",
  PLAYER: "secondary",
  VIEWER: "outline",
};

export function RoleBadge({ role }: { role: GroupRoleValue }) {
  return <Badge variant={VARIANTS[role]}>{role}</Badge>;
}
