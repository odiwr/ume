'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { logAudit, workspaces } from '@ume/db'
import { CAP } from '@ume/shared'
import { db } from '@/lib/db'
import { getGuildChannels } from '@/lib/discord-api'
import { AppError, guard, runAction, type ActionResult } from '@/lib/app/guard'
import { workspacePath } from '@/lib/app/nav'

const snowflake = z.string().regex(/^\d{5,25}$/).nullable()

/** Home voice channel + notice text channel. The bot moves on its next heartbeat. */
export async function updateBotChannels(
  workspaceId: string,
  input: { homeVoiceChannelId: string | null; noticeTextChannelId: string | null },
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_SETTINGS)
    const homeVoiceChannelId = snowflake.parse(input.homeVoiceChannelId || null)
    const noticeTextChannelId = snowflake.parse(input.noticeTextChannelId || null)
    const channels = await getGuildChannels(g.workspace.guildId).catch(() => null)
    if (channels) {
      if (homeVoiceChannelId && !channels.voice.some((c) => c.id === homeVoiceChannelId)) {
        throw new AppError('That voice channel does not exist any more. Refresh and pick again.')
      }
      if (noticeTextChannelId && !channels.text.some((c) => c.id === noticeTextChannelId)) {
        throw new AppError('That text channel does not exist any more. Refresh and pick again.')
      }
    }
    await db
      .update(workspaces)
      .set({ homeVoiceChannelId, noticeTextChannelId, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
    await logAudit(db, {
      workspaceId,
      actorUserId: g.user.id,
      action: 'settings.channels',
      metadata: { homeVoiceChannelId, noticeTextChannelId },
    })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}

export async function setYoutubeEnabled(workspaceId: string, enabled: boolean): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const g = await guard(workspaceId, CAP.MANAGE_SETTINGS)
    await db.update(workspaces).set({ linkExtractEnabled: !!enabled, updatedAt: new Date() }).where(eq(workspaces.id, workspaceId))
    await logAudit(db, { workspaceId, actorUserId: g.user.id, action: 'settings.youtube', metadata: { enabled: !!enabled } })
    revalidatePath(workspacePath(g.workspace.umeId), 'layout')
    return undefined
  })
}
