import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, INACTIVITY, PLANS, UPLOAD, formatBytes } from '@ume/shared'
import { LegalPage, LegalSection } from '@/components/site/legal'
import { LEGAL_EFFECTIVE_DATE } from '@/lib/site/links'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms for using Ume: accounts, acceptable use, your content, copyright and repeat infringers, billing, inactivity and termination.',
  alternates: { canonical: '/terms' },
}

const SECTIONS = [
  { id: 'agreement', title: 'The agreement' },
  { id: 'accounts', title: 'Accounts and servers' },
  { id: 'content', title: 'Your content' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'copyright', title: 'Copyright and repeat infringers' },
  { id: 'billing', title: 'Plans and billing' },
  { id: 'inactivity', title: 'Inactivity and deletion' },
  { id: 'commands', title: 'Destructive commands' },
  { id: 'availability', title: 'Availability and changes' },
  { id: 'disclaimers', title: 'Disclaimers and liability' },
  { id: 'termination', title: 'Termination' },
  { id: 'contact', title: 'Contact' },
]

export default function TermsPage() {
  const free = PLANS[0]!
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      intro={`These terms govern your use of ${BRAND.name}: the Discord bot, the website and everything behind them. They are written to be read. If anything here is unclear, ask before you rely on it.`}
      sections={SECTIONS}
    >
      <LegalSection id="agreement" index={1} title="The agreement">
        <p>
          By adding the {BRAND.name} bot to a Discord server, signing in on the website, or using
          either, you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>.
          If you are adding {BRAND.name} on behalf of a community or organisation, you confirm you
          are allowed to bind it to these terms.
        </p>
        <p>
          {BRAND.name} runs on top of Discord. Discord&apos;s own Terms of Service and Community
          Guidelines apply to everything you do there, and nothing here overrides them. {BRAND.name}{' '}
          is not affiliated with Discord Inc.
        </p>
      </LegalSection>

      <LegalSection id="accounts" index={2} title="Accounts and servers">
        <p>
          You sign in with Discord (or Google). One account can belong to many servers; each server
          you claim becomes a workspace with its own members, roles, playlists and storage. You are
          responsible for what happens under your account and for keeping your Discord and Google
          sign-ins secure.
        </p>
        <ul>
          <li>
            Only a server&apos;s owner or a member with the Administrator permission can claim it,
            rotate its token, reset it or purge it. We re-check this on every privileged action.
          </li>
          <li>
            The workspace <strong>Owner</strong> is the person who claimed the server. There is
            exactly one, and they are the only person who can change billing or run the danger-zone
            actions.
          </li>
          <li>
            Access you grant to others (roles, Discord role mappings, share links, email invites) is
            your decision. Share links are bearer credentials: anyone holding one gets the role,
            which is why they are capped at contributor-level access.
          </li>
          <li>
            You must be at least 13 years old (or older where your local law requires) to use{' '}
            {BRAND.name}.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="content" index={3} title="Your content">
        <p>
          You keep every right to the audio, titles, artwork and playlist names you add. You give{' '}
          {BRAND.name} a limited, non-exclusive licence to store, transcode, cache and stream that
          content solely to operate the service for your server. That licence ends when the content
          is deleted, except for copies held in backups for a short period or where we must retain
          something to comply with the law or a dispute.
        </p>
        <p>
          When you upload a file we transcode it to {UPLOAD.output.bitrateKbps} kbps Opus with
          loudness normalisation and delete the original. Keep your own copy; {BRAND.name} is a
          playback library, not a backup service.
        </p>
        <p>
          When you add a song from a link, {BRAND.name} fetches the audio from that link on your
          instruction, transcodes it the same way and stores it in your workspace as your content.
          We keep the source link, the site&apos;s identifier for the track and the author name the
          site shows, for attribution and for takedowns. We may turn link fetching off globally or
          per workspace at any time, for example when a source site blocks it; existing tracks are
          not affected and new links then become metadata-only entries.
        </p>
        <p>
          <strong>Rights attestation.</strong> Each time you upload a file or add a song from a link
          you represent and warrant that you own the audio or hold a licence that allows it to be
          stored by {BRAND.name} and played in your Discord server, and that doing so breaks no law
          and no term of the site the link points to. The workspace Owner accepts this attestation
          on behalf of the server when claiming it and before the first link is fetched. You agree
          to indemnify and hold harmless {BRAND.name} and the people who run it against any claim,
          loss or cost arising from audio you added. Other members of a workspace can see who added
          each track.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" index={4} title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>
            upload or link content you do not have the right to share, or that infringes
            anyone&apos;s rights;
          </li>
          <li>
            upload content that is illegal, that sexualises minors, or that incites violence or
            hatred;
          </li>
          <li>
            use {BRAND.name} to harass people, evade a Discord ban, or circumvent Discord&apos;s
            rules;
          </li>
          <li>
            attempt to bypass storage quotas, rate limits, role checks, token checks or any other
            protection;
          </li>
          <li>probe, scan or attack the service, or scrape it beyond ordinary personal use;</li>
          <li>resell or white-label {BRAND.name} without a written agreement.</li>
        </ul>
        <p>
          We may remove content, disable tracks, suspend workspaces or ban accounts that break these
          rules. Where we can, we will tell you what happened and why.
        </p>
      </LegalSection>

      <LegalSection id="copyright" index={5} title="Copyright and repeat infringers">
        <p>
          We respond to copyright takedown notices under the Digital Millennium Copyright Act (17
          U.S.C. § 512). Our designated agent, the takedown form and the counter-notice process are
          on the <Link href="/dmca">DMCA page</Link>.
        </p>
        <p>When we receive a valid notice we:</p>
        <ul>
          <li>disable the identified track so it can no longer be played or downloaded;</li>
          <li>notify the member who added it and the workspace Owner;</li>
          <li>
            block the file&apos;s content hash so the same audio cannot be re-uploaded anywhere on{' '}
            {BRAND.name};
          </li>
          <li>record the notice, our action and any counter-notice.</li>
        </ul>
        <p>
          <strong>Repeat-infringer policy.</strong> Each valid takedown that is not successfully
          counter-noticed counts as a strike against the account that added the content. An account
          that receives <strong>three strikes within any twelve-month period</strong> is terminated
          and may not re-register. We may also terminate sooner for flagrant cases, and we may
          suspend a workspace whose Owner repeatedly ignores notices.
        </p>
        <p>
          Knowingly sending a false takedown or counter-notice can make you liable for damages under
          17 U.S.C. § 512(f).
        </p>
      </LegalSection>

      <LegalSection id="billing" index={6} title="Plans and billing">
        <ul>
          <li>
            Plans are per workspace (per server), billed monthly in USD through Stripe. The Free
            plan includes {formatBytes(free.storageBytes)} of storage. Current prices are on the{' '}
            <Link href="/pricing">pricing page</Link>.
          </li>
          <li>
            Upgrades apply immediately and are prorated. Downgrades and cancellations apply at the
            end of the period.
          </li>
          <li>
            If a workspace exceeds its quota, new uploads pause. We never delete music to enforce a
            quota, including after a downgrade.
          </li>
          <li>
            If a payment fails we retry for a short period and then downgrade the workspace to Free.
            Your library stays intact.
          </li>
          <li>
            Refunds are given for outages on our side that materially prevented use during a period.
            Otherwise fees are non-refundable, except where the law says otherwise.
          </li>
          <li>We may change prices with at least 30 days&apos; notice by email and in the app.</li>
        </ul>
      </LegalSection>

      <LegalSection id="inactivity" index={7} title="Inactivity and deletion">
        <p>
          Free workspaces that show no activity for{' '}
          <strong>{INACTIVITY.purgeAfterDays} consecutive days</strong> are permanently deleted,
          including playlists, tracks and memberships. Activity means any of: a person present in
          the home voice channel, any command, any playback, or any edit or upload on the web.
        </p>
        <p>
          Before deletion we send a notice at <strong>{INACTIVITY.firstNoticeAtDays} days</strong>{' '}
          of inactivity and a final notice{' '}
          <strong>{INACTIVITY.finalNoticeHoursBefore} hours</strong> before deletion, by email to
          the Owner, by Discord DM, and in the server&apos;s notice channel where one is configured.
          Any activity resets the clock.
        </p>
        <p>
          <strong>Paid workspaces are never auto-deleted.</strong> If a subscription ends, the
          workspace becomes Free and the inactivity clock starts from that date.
        </p>
      </LegalSection>

      <LegalSection id="commands" index={8} title="Destructive commands">
        <p>Three commands are irreversible and are described here so nobody is surprised:</p>
        <ul>
          <li>
            <strong>/reload</strong> issues a new single-use token and disconnects the current web
            workspace. The workspace stays read-only until the new token is entered. Music is not
            affected.
          </li>
          <li>
            <strong>/reset</strong> removes every web member except the Owner and revokes all
            invites. Playlists and music stay. Requires a confirmation code.
          </li>
          <li>
            <strong>/purge</strong> deletes the workspace and everything in it. Requires a
            confirmation code. There is no undo.
          </li>
        </ul>
        <p>
          Only the server owner, an Administrator, or the workspace Owner (as applicable) can run
          these.
        </p>
      </LegalSection>

      <LegalSection id="availability" index={9} title="Availability and changes">
        <p>
          We aim to keep {BRAND.name} online 24/7 but do not guarantee uninterrupted service.
          Discord outages, voice region issues and maintenance can interrupt playback. We may change
          or retire features; where a change removes something you rely on we will try to give
          notice.
        </p>
        <p>
          We may update these Terms. Material changes are announced by email and in the app at least
          14 days before they take effect. Continuing to use {BRAND.name} after that date means you
          accept the new terms.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" index={10} title="Disclaimers and liability">
        <p>
          {BRAND.name} is provided &quot;as is&quot; and &quot;as available&quot; without warranties
          of any kind, express or implied, including fitness for a particular purpose and
          non-infringement. We do not warrant that stored audio will never be lost; keep your own
          copies.
        </p>
        <p>
          To the fullest extent the law allows, {BRAND.name} and the people who run it are not
          liable for indirect, incidental, special or consequential damages, or for lost data,
          profits or goodwill. Our total liability for any claim is limited to the amount you paid
          us in the twelve months before the claim, or USD 50 if you paid nothing. Some
          jurisdictions do not allow these limits, in which case they apply only as far as
          permitted.
        </p>
        <p>
          You agree to indemnify us against claims arising from content you added or from your
          breach of these Terms.
        </p>
      </LegalSection>

      <LegalSection id="termination" index={11} title="Termination">
        <p>
          You can stop at any time: remove the bot from your server, run /purge, or ask us to delete
          your account. We can suspend or terminate accounts and workspaces that break these Terms,
          that create legal risk for us, or that have been inactive as described above. On
          termination your licence to use {BRAND.name} ends; sections 3, 5, 10 and 11 survive.
        </p>
      </LegalSection>

      <LegalSection id="contact" index={12} title="Contact">
        <p>
          Questions about these Terms go to the contact address on the{' '}
          <Link href="/dmca">DMCA page</Link> or to the support server linked in the footer.
          Copyright notices must use the DMCA process.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
