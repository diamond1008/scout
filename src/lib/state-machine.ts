import type { ProspectStatus } from "./db/schema";

/**
 * Map of every valid status transition.
 * Key = current status, Value = set of statuses it may move to.
 */
export const VALID_TRANSITIONS: Record<ProspectStatus, readonly ProspectStatus[]> = {
  DISCOVERED: ["SCORED"],
  SCORED: ["DRAFTED"],
  DRAFTED: ["APPROVED", "REJECTED", "DRAFTED"], // DRAFTED→DRAFTED = edit
  APPROVED: ["SENDING"],
  REJECTED: [],
  SENDING: ["SENT", "SENT_SANDBOX", "FAILED_RETRYABLE", "BLOCKED_DM_CLOSED", "FAILED_PERMANENT"],
  SENT: ["REPLIED"],
  SENT_SANDBOX: ["REPLIED"],
  REPLIED: [],
  BLOCKED_DM_CLOSED: [],
  FAILED_RETRYABLE: ["SENDING", "FAILED_PERMANENT"],
  FAILED_PERMANENT: [],
};

/**
 * Transition a prospect's status, throwing if the move is invalid.
 * @returns the target status (for convenience in chaining)
 */
export function transitionStatus(
  currentStatus: ProspectStatus,
  targetStatus: ProspectStatus
): ProspectStatus {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${targetStatus}. ` +
        `Allowed transitions from ${currentStatus}: ${allowed?.length ? allowed.join(", ") : "none"}`
    );
  }
  return targetStatus;
}

/** Returns true if no further transitions are possible */
export function isTerminalState(status: ProspectStatus): boolean {
  return (VALID_TRANSITIONS[status] || []).length === 0;
}

/** Returns true if the prospect is in the APPROVED state (can be sent) */
export function canSendDM(status: ProspectStatus): boolean {
  return status === "APPROVED";
}

/** Returns true if a DM was sent (regardless of outcome) */
export function hasBeenContacted(status: ProspectStatus): boolean {
  return ["SENDING", "SENT", "SENT_SANDBOX", "REPLIED", "BLOCKED_DM_CLOSED"].includes(status);
}
