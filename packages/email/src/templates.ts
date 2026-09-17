import { BRAND, INACTIVITY } from '@ume/shared'

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

const MEMBER_FOOTER = 'You are receiving this because you own or manage an Ume workspace.'

function layout(
  title: string,
  bodyHtml: string,
  cta?: { label: string; url: string },
  footer: string = MEMBER_FOOTER,
): string {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid #262626;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND.colors.pink};padding:20px 28px;font-weight:800;font-size:20px;color:#0a0a0a;letter-spacing:-0.02em">ume</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#f2f2f2">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#d6d6d6">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:${BRAND.colors.pink};color:#0a0a0a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${esc(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #262626;font-size:12px;color:#8a8a8a">${esc(footer)} ${esc(BRAND.tagline)}</td></tr>
</table></td></tr></table></body></html>`
}

export function inviteEmail(input: {
  to: string
  serverName: string
  roleName: string
  inviterName: string
  url: string
  expiresAt: Date
}) {
  const title = `${input.inviterName} invited you to ${input.serverName} on Ume`
  const text = `${input.inviterName} invited you to manage music for "${input.serverName}" as ${input.roleName}.\n\nAccept: ${input.url}\n\nThis invite expires ${input.expiresAt.toUTCString()}.`
  const html = layout(
    title,
    `<p>${esc(input.inviterName)} invited you to add music for <strong>${esc(input.serverName)}</strong> as <strong>${esc(input.roleName)}</strong>.</p><p>Sign in with Discord to accept. This invite expires ${esc(input.expiresAt.toUTCString())}.</p>`,
    { label: 'Accept invite', url: input.url },
  )
  return { to: input.to, subject: title, html, text }
}

export function inactivity30dEmail(input: {
  to: string
  serverName: string
  purgeAt: Date
  dashboardUrl: string
}) {
  const title = `Ume on ${input.serverName} has been quiet for ${INACTIVITY.firstNoticeAtDays} days`
  const body = `Nobody has joined Ume's channel in "${input.serverName}" for ${INACTIVITY.firstNoticeAtDays} days. If that continues, the workspace (playlists, music, members) will be permanently deleted on ${input.purgeAt.toUTCString()}.\n\nTo keep it, just hop into Ume's voice channel or use any command.\n\n${input.dashboardUrl}`
  const html = layout(
    title,
    `<p>Nobody has joined Ume's channel in <strong>${esc(input.serverName)}</strong> for ${INACTIVITY.firstNoticeAtDays} days.</p><p>If that continues, the workspace — playlists, music and members — will be <strong>permanently deleted on ${esc(input.purgeAt.toUTCString())}</strong>.</p><p>To keep it, hop into Ume's voice channel or run any command. That resets the clock.</p>`,
    { label: 'Open dashboard', url: input.dashboardUrl },
  )
  return { to: input.to, subject: title, html, text: body }
}

export function inactivity48hEmail(input: {
  to: string
  serverName: string
  purgeAt: Date
  dashboardUrl: string
}) {
  const title = `Final notice: Ume on ${input.serverName} will be deleted in ${INACTIVITY.finalNoticeHoursBefore} hours`
  const body = `This is the last warning. The Ume workspace for "${input.serverName}" will be permanently deleted on ${input.purgeAt.toUTCString()} unless someone joins Ume's channel or runs a command before then.\n\n${input.dashboardUrl}`
  const html = layout(
    title,
    `<p>This is the last warning. The Ume workspace for <strong>${esc(input.serverName)}</strong> will be <strong>permanently deleted on ${esc(input.purgeAt.toUTCString())}</strong> unless someone joins Ume's channel or runs a command before then.</p>`,
    { label: 'Keep my workspace', url: input.dashboardUrl },
  )
  return { to: input.to, subject: title, html, text: body }
}

export function purgedEmail(input: {
  to: string
  serverName: string
  reason: 'inactivity' | 'owner'
}) {
  const title = `Ume workspace for ${input.serverName} was deleted`
  const why =
    input.reason === 'inactivity'
      ? `after ${INACTIVITY.purgeAfterDays} days without activity`
      : 'at the owner’s request'
  const body = `The Ume workspace for "${input.serverName}" was permanently deleted ${why}. Playlists, music and members are gone. You can set Ume up again any time by DMing the bot ~reload.`
  const html = layout(
    title,
    `<p>The Ume workspace for <strong>${esc(input.serverName)}</strong> was permanently deleted ${esc(why)}. Playlists, music and members are gone.</p><p>You can set Ume up again any time by DMing the bot <code>~reload</code>.</p>`,
  )
  return { to: input.to, subject: title, html, text: body }
}

export function tokenRotatedEmail(input: { to: string; serverName: string; settingsUrl: string }) {
  const title = `Ume token rotated for ${input.serverName}`
  const body = `Someone ran ~reload for "${input.serverName}". The web workspace is disconnected until the new token is entered in Settings.\n\n${input.settingsUrl}`
  const html = layout(
    title,
    `<p>Someone ran <code>~reload</code> for <strong>${esc(input.serverName)}</strong>. The web workspace is disconnected (read-only) until the new token is entered in Settings.</p><p>If this wasn't you, check who has Administrator in your Discord server.</p>`,
    { label: 'Open settings', url: input.settingsUrl },
  )
  return { to: input.to, subject: title, html, text: body }
}

export function quotaWarningEmail(input: {
  to: string
  serverName: string
  usedPct: number
  billingUrl: string
}) {
  const title = `Ume storage for ${input.serverName} is ${input.usedPct}% full`
  const body = `Your Ume storage for "${input.serverName}" is ${input.usedPct}% full. Uploads will fail once it is full. Upgrade or remove tracks:\n\n${input.billingUrl}`
  const html = layout(
    title,
    `<p>Your Ume storage for <strong>${esc(input.serverName)}</strong> is <strong>${input.usedPct}%</strong> full. Uploads will fail once it is full.</p>`,
    { label: 'Manage storage', url: input.billingUrl },
  )
  return { to: input.to, subject: title, html, text: body }
}

/** Operator notice: a takedown notice landed in `dmca_notices`. Sent to the DMCA agent, not the claimant. */
export function dmcaNoticeEmail(input: {
  to: string
  noticeId: string
  reference: string
  claimantName: string
  /** URLs or track references the claimant reported. */
  reported: string[]
  consoleUrl: string
}) {
  const title = `DMCA notice ${input.reference} received`
  const reportedText = input.reported.map((r) => `- ${r}`).join('\n')
  const body = `A takedown notice was submitted through /dmca.\n\nNotice id: ${input.noticeId}\nClaimant: ${input.claimantName}\nReported:\n${reportedText}\n\nReview and act on it in the console:\n${input.consoleUrl}`
  const html = layout(
    title,
    `<p>A takedown notice was submitted through <code>/dmca</code>.</p><p><strong>Notice id:</strong> <code>${esc(input.noticeId)}</code><br><strong>Claimant:</strong> ${esc(input.claimantName)}</p><p><strong>Reported:</strong></p><ul>${input.reported.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`,
    { label: 'Open in console', url: input.consoleUrl },
    'You are receiving this because you are the designated DMCA agent for this Ume deployment.',
  )
  return { to: input.to, subject: title, html, text: body }
}
