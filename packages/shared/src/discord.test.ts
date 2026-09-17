import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOT_INVITE_PERMISSIONS, botInviteUrl, permissionsInclude } from './discord'

const VIEW_CHANNEL = 1n << 10n
const CONNECT = 1n << 20n
const SPEAK = 1n << 21n
const MANAGE_ROLES = 1n << 28n
const SET_VOICE_CHANNEL_STATUS = 1n << 48n
const ADMINISTRATOR = 1n << 3n
const MANAGE_CHANNELS = 1n << 4n

test('invite link requests the permissions Ume needs to self-grant in its home channel', () => {
  for (const bit of [VIEW_CHANNEL, CONNECT, SPEAK, MANAGE_ROLES, SET_VOICE_CHANNEL_STATUS]) {
    assert.ok(permissionsInclude(BOT_INVITE_PERMISSIONS, bit), `missing bit ${bit}`)
  }
  assert.equal(BOT_INVITE_PERMISSIONS, 281477395860480n)
})

test('invite link never requests Administrator or Manage Channels', () => {
  assert.equal(permissionsInclude(BOT_INVITE_PERMISSIONS, ADMINISTRATOR), false)
  assert.equal(permissionsInclude(BOT_INVITE_PERMISSIONS, MANAGE_CHANNELS), false)
})

test('botInviteUrl encodes scopes, permissions and an optional locked guild', () => {
  const open = new URL(botInviteUrl('123'))
  assert.equal(open.searchParams.get('client_id'), '123')
  assert.equal(open.searchParams.get('scope'), 'bot applications.commands')
  assert.equal(open.searchParams.get('permissions'), '281477395860480')
  assert.equal(open.searchParams.get('guild_id'), null)

  const locked = new URL(botInviteUrl('123', '456'))
  assert.equal(locked.searchParams.get('guild_id'), '456')
  assert.equal(locked.searchParams.get('disable_guild_select'), 'true')
})
