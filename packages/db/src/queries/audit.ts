import { newId } from '@ume/shared'
import type { Db } from '../client'
import { auditLogs } from '../schema'

export interface AuditInput {
  workspaceId?: string | null
  actorUserId?: string | null
  actorDiscordId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
  ip?: string | null
}

export async function logAudit(db: Db, input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    id: newId('audit'),
    workspaceId: input.workspaceId ?? null,
    actorUserId: input.actorUserId ?? null,
    actorDiscordId: input.actorDiscordId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
  })
}
