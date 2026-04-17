/**
 * Audit logging — immutable trail of sensitive actions.
 *
 * Every action that modifies user state, billing, or content writes
 * a row to the `audit_log` table. This provides:
 *   • Operational visibility (what happened, when, by whom)
 *   • Incident investigation (trace a billing dispute or data issue)
 *   • Compliance readiness (GDPR, financial record-keeping)
 *
 * The table is append-only — rows are never updated or deleted.
 * Metadata is stored as a JSON blob for flexibility; the `action`
 * field is the primary index for querying.
 *
 * This module is intentionally fire-and-forget: audit logging should
 * never cause a request to fail. All errors are caught and logged
 * to console, not propagated to the caller.
 */

import { getDb } from "./db";

// ─── Action types ──────────────────────────────────────────────────────────

export type AuditAction =
    | "project.create"
    | "project.archive"
    | "project.restore"
    | "project.rename"
    | "project.pin"
    | "project.unpin"
    | "generation.create"
    | "generation.complete"
    | "generation.fail"
    | "credits.deduct"
    | "credits.refund"
    | "credits.grant"
    | "plan.upgrade"
    | "plan.downgrade"
    | "user.login"
    | "user.logout";

export type AuditTargetType =
    | "project"
    | "generation"
    | "user"
    | "subscription";

// ─── Log function ──────────────────────────────────────────────────────────

interface AuditLogParams {
    userId: string | null;
    action: AuditAction;
    targetType?: AuditTargetType;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
}

/**
 * Writes an audit log entry. Fire-and-forget — never throws.
 *
 * Usage:
 *   await logAudit({
 *       userId: user.id,
 *       action: "project.archive",
 *       targetType: "project",
 *       targetId: project.uid,
 *       metadata: { projectName: project.name },
 *       ip: requestIp,
 *   });
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        const db = await getDb();
        await db
            .prepare(
                `INSERT INTO audit_log
                 (user_id, action, target_type, target_id, metadata, ip, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                params.userId,
                params.action,
                params.targetType ?? null,
                params.targetId ?? null,
                params.metadata ? JSON.stringify(params.metadata) : null,
                params.ip ?? null,
                Date.now(),
            )
            .run();
    } catch (err) {
        // Audit logging must never break the request flow.
        console.error("[audit] Failed to write audit log:", err);
    }
}
