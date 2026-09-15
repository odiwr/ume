import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, INACTIVITY } from '@ume/shared'
import { LegalPage, LegalSection } from '@/components/site/legal'
import { LEGAL_EFFECTIVE_DATE } from '@/lib/site/links'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Ume collects from Discord and your uploads, why, who sees it, how long it is kept, and how to delete it.',
  alternates: { canonical: '/privacy' },
}

const SECTIONS = [
  { id: 'summary', title: 'Summary' },
  { id: 'collect', title: 'What we collect' },
  { id: 'use', title: 'How we use it' },
  { id: 'share', title: 'Who we share it with' },
  { id: 'retention', title: 'How long we keep it' },
  { id: 'rights', title: 'Your rights and choices' },
  { id: 'security', title: 'Security' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes' },
  { id: 'contact', title: 'Contact' },
]

function RetentionRow({ what, howLong, why }: { what: string; howLong: string; why: string }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-3 pr-4 font-medium text-fg">{what}</td>
      <td className="py-3 pr-4 whitespace-nowrap">{howLong}</td>
      <td className="py-3">{why}</td>
    </tr>
  )
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      intro={`${BRAND.name} needs surprisingly little to run a radio station for your server. This page lists exactly what we collect, why, and when it is deleted. We do not sell data and we do not run ads.`}
      sections={SECTIONS}
    >
      <LegalSection id="summary" index={1} title="Summary">
        <ul>
          <li>We identify you through Discord OAuth (or Google). We never ask for or store your Discord password.</li>
          <li>We store the music you upload, transcoded, and the metadata of links you add.</li>
          <li>We record who added each track and who did what in a workspace, because members need to see it.</li>
          <li>We keep operational logs for a short time and legal records for as long as the law expects.</li>
          <li>Free workspaces idle for {INACTIVITY.purgeAfterDays} days are deleted, with two warnings first.</li>
          <li>You can delete a workspace or your account at any time.</li>
        </ul>
      </LegalSection>

      <LegalSection id="collect" index={2} title="What we collect">
        <p>
          <strong>Account data.</strong> When you sign in with Discord we receive your Discord user ID, username, avatar
          and email address, and the list of servers you belong to with your permissions in each (the{' '}
          <code>identify</code>, <code>email</code> and <code>guilds</code> scopes). The server list is used only to show
          you the servers you can claim and to check that a share link&apos;s &quot;must be a member&quot; rule is met;
          we do not store the full list. When you sign in with Google we receive your name, email and profile picture.
        </p>
        <p>
          <strong>Workspace data.</strong> The server&apos;s Discord ID, name and icon; the voice channel Ume lives in;
          your playlists, tracks and their metadata; role definitions; memberships; Discord role mappings; invites; and the
          plan the workspace is on.
        </p>
        <p>
          <strong>Audio.</strong> Files you upload are transcoded to Opus and stored in object storage under a key tied to
          your workspace. The original file is deleted after transcoding. We compute a SHA-256 hash of the transcoded
          audio to de-duplicate and to enforce takedowns.
        </p>
        <p>
          <strong>Activity and audit data.</strong> Events such as someone joining the home channel, commands, playback,
          uploads and edits, along with which Discord user or web account did them. We use this to decide whether a
          workspace is active and to show an audit log to workspace admins.
        </p>
        <p>
          <strong>Bot data.</strong> Ume sees voice-state changes (who is in its channel) so it can pause when the room is
          empty. It does not record audio from voice channels. It reads server messages only if the server enables the
          Message Content intent, and then only to detect <code>~</code> commands; messages are not stored.
        </p>
        <p>
          <strong>Billing.</strong> Stripe handles payments. We store your Stripe customer and subscription IDs and the
          plan status. We never see or store card numbers.
        </p>
        <p>
          <strong>Technical data.</strong> IP address, browser and timing information in server logs, and the IP address
          attached to DMCA submissions and privileged actions for abuse prevention.
        </p>
        <p>
          <strong>Notifications.</strong> A record of each email or Discord message we sent you (what, when, to where)
          so we do not send it twice.
        </p>
      </LegalSection>

      <LegalSection id="use" index={3} title="How we use it">
        <ul>
          <li>To run the service: sign you in, play music, enforce roles and quotas, send notices.</li>
          <li>To show members who added what and to give admins an audit trail.</li>
          <li>To bill paid workspaces and to detect and stop abuse, including copyright infringement.</li>
          <li>To email you about your workspace: invites, token rotations, inactivity warnings, quota warnings, billing.</li>
          <li>To debug problems and understand aggregate usage. We do not profile individuals or run advertising.</li>
        </ul>
        <p>
          Our legal bases, where the GDPR or UK GDPR applies, are performance of a contract (running the service),
          legitimate interests (security, abuse prevention, product improvement) and legal obligation (billing and
          copyright records).
        </p>
      </LegalSection>

      <LegalSection id="share" index={4} title="Who we share it with">
        <p>We share data only with the processors needed to run {BRAND.name}:</p>
        <ul>
          <li>a hosting provider for the web app and a separate one for the bot and worker;</li>
          <li>a managed Postgres provider for the database;</li>
          <li>an S3-compatible object storage provider for audio;</li>
          <li>Stripe for payments;</li>
          <li>a transactional email provider for notices;</li>
          <li>Discord, which receives the messages and voice data the bot sends on your behalf.</li>
        </ul>
        <p>
          Within a workspace, members can see each other&apos;s display names, avatars, roles and which tracks they
          added. We disclose data to authorities only when legally required, and we will tell you unless we are
          prohibited from doing so.
        </p>
      </LegalSection>

      <LegalSection id="retention" index={5} title="How long we keep it">
        <p>
          Free workspaces that show no activity for <strong>{INACTIVITY.purgeAfterDays} days</strong> are permanently
          deleted. We send a notice at <strong>{INACTIVITY.firstNoticeAtDays} days</strong> and a final notice{' '}
          <strong>{INACTIVITY.finalNoticeHoursBefore} hours</strong> before deletion, by email and through Discord.{' '}
          <strong>Paid workspaces are exempt</strong> from automatic deletion. A purged workspace leaves a minimal tombstone
          (workspace ID, server ID, deletion time) for 30 days so support can answer &quot;what happened&quot;.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-fg-subtle">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Kept for</th>
                <th className="px-4 py-3">Why</th>
              </tr>
            </thead>
            <tbody className="[&_td]:px-4">
              <RetentionRow
                what="Account data"
                howLong="Until you delete your account"
                why="You need an account to be a member of anything. Deleting it removes your memberships; tracks you added stay in their playlists, attributed to a removed member."
              />
              <RetentionRow
                what="Audio and library data"
                howLong="Until deleted or purged"
                why="Deleted by you, by a track removal, by /purge, or by the inactivity purge. Object storage copies are removed within 7 days of deletion."
              />
              <RetentionRow
                what="DMCA notices and counter-notices"
                howLong="3 years"
                why="Required to operate the repeat-infringer policy and to defend against claims."
              />
              <RetentionRow
                what="Billing records"
                howLong="7 years"
                why="Tax and accounting law."
              />
              <RetentionRow
                what="Server and application logs"
                howLong="30 to 90 days"
                why="Debugging and security. Aggregated metrics without personal data may be kept longer."
              />
              <RetentionRow
                what="Audit and activity events"
                howLong="Life of the workspace, up to 12 months"
                why="Admins need to see who did what; older events are trimmed."
              />
            </tbody>
          </table>
        </div>
        <p>Backups of the database are kept for up to 30 days and are then overwritten.</p>
      </LegalSection>

      <LegalSection id="rights" index={6} title="Your rights and choices">
        <ul>
          <li>
            <strong>Delete a workspace:</strong> run /purge as the Owner, or use the Danger Zone in Settings.
          </li>
          <li>
            <strong>Delete your account:</strong> from your account page, or by contacting us. We remove your account data
            within 30 days, except records we must keep (see above).
          </li>
          <li>
            <strong>Access or correct data:</strong> most of it is visible in the app. For a full export, contact us.
          </li>
          <li>
            <strong>Revoke Discord access:</strong> remove {BRAND.name} under Authorized Apps in your Discord settings. You
            will be signed out and cannot sign in again until you re-authorise.
          </li>
          <li>
            <strong>Email:</strong> we send only transactional messages tied to your workspaces; there is no marketing
            list to unsubscribe from.
          </li>
        </ul>
        <p>
          If you are in the EEA, UK or Switzerland you also have the right to object to or restrict processing, to data
          portability, and to complain to your supervisory authority.
        </p>
      </LegalSection>

      <LegalSection id="security" index={7} title="Security">
        <p>
          All traffic is encrypted in transit. Claim tokens and invite tokens are stored only as SHA-256 hashes and are
          single-use. Audio uploads go straight from your browser to object storage over short-lived signed URLs; the
          web server never handles the bytes. Privileged actions are re-authorised server-side on every request and
          written to the audit log. Discord voice is end-to-end encrypted with DAVE where Discord provides it.
        </p>
        <p>If we discover a breach affecting your data we will notify affected Owners without undue delay.</p>
      </LegalSection>

      <LegalSection id="children" index={8} title="Children">
        <p>
          {BRAND.name} is not directed at children under 13 (or the higher age your country sets for Discord). We do not
          knowingly collect data from them; if you think we have, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" index={9} title="Changes">
        <p>
          We will announce material changes to this policy by email and in the app at least 14 days before they take
          effect. The effective date at the top always reflects the current version.
        </p>
      </LegalSection>

      <LegalSection id="contact" index={10} title="Contact">
        <p>
          Privacy questions and data requests: use the contact address on the <Link href="/dmca">DMCA page</Link> with
          &quot;Privacy&quot; in the subject, or reach us through the support server linked in the footer.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
