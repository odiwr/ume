import { Ban, CheckCircle2, FileText, RotateCcw, XCircle } from '@/components/ui/icons'
import { dmcaDisableTrackAction, dmcaSaveNotesAction, dmcaSetStatusAction } from '@/lib/ceo/actions'
import { ActionButton, ActionForm, ActionSubmit } from '@/components/ceo/action-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, Textarea } from '@/components/ui/input'
import type { DmcaNotice, Track } from '@/lib/db'

/**
 * Takedown workflow for one notice. Server component; the forms are client islands.
 * Flow: received -> actioned (track disabled + hash blocked) -> counter_noticed ->
 * restored (track back to ready) | rejected. Any step can be revisited.
 */
export function DmcaActions({
  notice,
  track,
  hashBlocked,
}: {
  notice: DmcaNotice
  track: Track | null
  hashBlocked: boolean
}) {
  const trackDisabled = track?.status === 'disabled'
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className={notice.status === 'received' ? 'border-warning/40' : undefined}>
        <CardHeader>
          <CardTitle>Takedown</CardTitle>
          <CardDescription>
            {track
              ? trackDisabled
                ? `The track is already disabled${hashBlocked ? ' and its hash is blocked everywhere' : ''}.`
                : `Disables the track (playback and download stop, the file is kept) and blocks its content hash so it cannot be re-uploaded to any workspace.`
              : 'No track is linked to this notice. Marking it actioned records the decision only; find and disable the track from the workspace page.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ActionButton
            action={dmcaDisableTrackAction}
            fields={{ noticeId: notice.id }}
            variant="danger"
            disabled={notice.status === 'actioned' && (trackDisabled || !track)}
            confirm={
              track
                ? `Disable "${track.title}" and block its hash?`
                : 'Mark this notice actioned without a linked track?'
            }
          >
            <Ban className="size-4" /> Disable track + block hash
          </ActionButton>
          <ActionButton
            action={dmcaSetStatusAction}
            fields={{ noticeId: notice.id, status: 'rejected' }}
            variant="outline"
            disabled={notice.status === 'rejected'}
            confirm="Reject this notice? The track stays as it is."
          >
            <XCircle className="size-4" /> Reject notice
          </ActionButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Counter-notice</CardTitle>
          <CardDescription>
            When the uploader sends a valid counter-notice, record it here. If the claimant does not
            file suit within 10 to 14 business days, restore the track. Restoring sets the track
            back to ready; a blocked hash stays blocked until you clear it in the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ActionButton
            action={dmcaSetStatusAction}
            fields={{ noticeId: notice.id, status: 'counter_noticed' }}
            variant="secondary"
            disabled={notice.status === 'counter_noticed'}
          >
            <FileText className="size-4" /> Mark counter-noticed
          </ActionButton>
          <ActionButton
            action={dmcaSetStatusAction}
            fields={{ noticeId: notice.id, status: 'restored' }}
            variant="secondary"
            disabled={notice.status === 'restored'}
            confirm={
              trackDisabled
                ? `Restore "${track?.title}" to ready?`
                : 'Mark restored? There is no disabled track to bring back.'
            }
          >
            <RotateCcw className="size-4" /> Restore track
          </ActionButton>
          <ActionButton
            action={dmcaSetStatusAction}
            fields={{ noticeId: notice.id, status: 'received' }}
            variant="ghost"
            disabled={notice.status === 'received'}
          >
            <CheckCircle2 className="size-4" /> Reopen as received
          </ActionButton>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
          <CardDescription>
            Never shown to the claimant or the uploader. Record what you checked and why you
            decided.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={dmcaSaveNotesAction} className="flex flex-col gap-3">
            <input type="hidden" name="noticeId" value={notice.id} />
            <div>
              <Label htmlFor="dmca-notes">Notes</Label>
              <Textarea
                id="dmca-notes"
                name="notes"
                defaultValue={notice.notes ?? ''}
                maxLength={5000}
                placeholder="e.g. Verified the claimant owns the catalogue via their label site. Track disabled 15 Sep."
              />
            </div>
            <div>
              <ActionSubmit variant="secondary">Save notes</ActionSubmit>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  )
}
