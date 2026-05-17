import { Circle, CircleCheck, CircleOff, Clock3, Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  CourtStatus,
  MatchStatus,
  PlaySessionStatus,
  SessionPlayerStatus,
} from "@/lib/db/generated/enums";
import { cn } from "@/lib/utils";

const stateClass = {
  active:
    "border-emerald-600/25 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  ready:
    "border-sky-600/25 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  queued:
    "border-amber-600/25 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  complete:
    "border-violet-600/25 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  muted: "border-border bg-muted text-muted-foreground",
  danger:
    "border-destructive/25 bg-destructive/10 text-destructive dark:bg-destructive/20",
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  switch (status) {
    case MatchStatus.ACTIVE:
      return <StateBadge icon={<Circle />} label="In play" tone="active" />;
    case MatchStatus.QUEUED:
      return <StateBadge icon={<Clock3 />} label="Queued" tone="queued" />;
    case MatchStatus.COMPLETED:
      return <StateBadge icon={<Trophy />} label="Final" tone="complete" />;
    case MatchStatus.CANCELLED:
      return (
        <StateBadge icon={<CircleOff />} label="Cancelled" tone="danger" />
      );
    default:
      return <StateBadge label={titleCase(status)} tone="muted" />;
  }
}

export function SessionStatusBadge({ status }: { status: PlaySessionStatus }) {
  switch (status) {
    case PlaySessionStatus.ACTIVE:
      return <StateBadge icon={<Circle />} label="Active" tone="active" />;
    case PlaySessionStatus.PLANNED:
      return <StateBadge icon={<Clock3 />} label="Planned" tone="queued" />;
    case PlaySessionStatus.COMPLETED:
      return (
        <StateBadge icon={<CircleCheck />} label="Completed" tone="complete" />
      );
    case PlaySessionStatus.CANCELLED:
      return (
        <StateBadge icon={<CircleOff />} label="Cancelled" tone="danger" />
      );
    default:
      return <StateBadge label={titleCase(status)} tone="muted" />;
  }
}

export function CourtStatusBadge({ status }: { status: CourtStatus }) {
  switch (status) {
    case CourtStatus.IN_USE:
      return <StateBadge icon={<Circle />} label="In use" tone="active" />;
    case CourtStatus.AVAILABLE:
      return (
        <StateBadge icon={<CircleCheck />} label="Available" tone="ready" />
      );
    case CourtStatus.DISABLED:
      return <StateBadge icon={<CircleOff />} label="Disabled" tone="danger" />;
    default:
      return <StateBadge label={titleCase(status)} tone="muted" />;
  }
}

export function PlayerStateChip({
  status,
  children,
}: {
  status: SessionPlayerStatus;
  children: ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 max-w-full justify-start", playerTone(status))}
    >
      <span className="truncate">{children}</span>
    </Badge>
  );
}

function StateBadge({
  icon,
  label,
  tone,
}: {
  icon?: ReactNode;
  label: string;
  tone: keyof typeof stateClass;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1", stateClass[tone])}>
      {icon}
      {label}
    </Badge>
  );
}

function playerTone(status: SessionPlayerStatus) {
  switch (status) {
    case SessionPlayerStatus.PLAYING:
      return stateClass.active;
    case SessionPlayerStatus.AVAILABLE:
    case SessionPlayerStatus.WAITING:
      return stateClass.ready;
    case SessionPlayerStatus.RESTING:
      return stateClass.queued;
    case SessionPlayerStatus.LEFT:
      return stateClass.muted;
    default:
      return stateClass.muted;
  }
}
