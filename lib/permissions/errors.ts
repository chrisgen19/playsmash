/** Thrown when a user is signed in but lacks the required permission. */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "You don't have permission to do that") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when a target record (group, session, player) does not exist. */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
