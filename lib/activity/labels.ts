import type { ActivityActionValue } from "./log";

/**
 * Human-readable label for each ActivityAction. Keyed by the string value so
 * a log row written before a label existed still renders (falls back to the
 * raw action string).
 */
const ACTION_LABELS: Record<string, string> = {
  "group.created": "created the group",
  "group.join_code_regenerated": "regenerated the join code",
  "group.updated": "updated group details",
  "group.archived": "archived the group",
  "group.ownership_transferred": "transferred ownership",
  "member.joined": "joined the group",
  "member.role_changed": "changed a member's role",
  "member.removed": "removed a member",
  "join_request.created": "requested to join",
  "join_request.approved": "approved a join request",
  "join_request.rejected": "rejected a join request",
  "player.created_temp": "added a temporary player",
  "player.updated": "updated a player",
  "player.status_changed": "changed a player's status",
  "player.linked_to_user": "linked a player to a user",
  "player.removed": "removed a player",
  "invite.disabled": "disabled an invite",
  "session.created": "created a session",
  "session.started": "started a session",
  "session.players_updated": "updated session attendance",
  "session.round_generated": "generated a round",
  "match.started": "started a match",
  "match.completed": "completed a match",
  "match.cancelled": "cancelled a match",
  "match.score_edited": "edited a match score",
};

export function activityLabel(action: ActivityActionValue | string): string {
  return ACTION_LABELS[action] ?? action;
}
