import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_CAPS,
  CAP,
  CAP_LABELS,
  DEFAULT_ROLES,
  LINK_INVITE_FORBIDDEN_CAPS,
  OWNER_ONLY_CAPS,
  capNames,
  hasAnyCap,
  hasCap,
  roleGrantableByEmail,
  roleGrantableByLink,
  sanitizeCapsForNonOwner,
  type CapabilityName,
} from './roles'

const capValues = Object.values(CAP)
const role = (key: string) => DEFAULT_ROLES.find((r) => r.key === key)!

test('every capability is a distinct power of two with a label', () => {
  for (const v of capValues) assert.ok(v > 0 && (v & (v - 1)) === 0, `${v} is not a power of two`)
  assert.equal(new Set(capValues).size, capValues.length)
  assert.equal(
    ALL_CAPS,
    capValues.reduce((a, b) => a | b, 0),
  )
  for (const name of Object.keys(CAP) as CapabilityName[]) {
    assert.ok(CAP_LABELS[name].label.length > 0, name)
    assert.ok(CAP_LABELS[name].description.length > 0, name)
  }
})

test('hasCap requires every bit, hasAnyCap requires one, capNames lists them', () => {
  const mask = CAP.VIEW_LIBRARY | CAP.ADD_TRACK
  assert.equal(hasCap(mask, CAP.ADD_TRACK), true)
  assert.equal(hasCap(mask, CAP.MANAGE_ROLES), false)
  assert.equal(hasCap(mask, CAP.VIEW_LIBRARY | CAP.ADD_TRACK), true)
  assert.equal(hasCap(mask, CAP.VIEW_LIBRARY | CAP.MANAGE_ROLES), false)
  assert.equal(hasCap(0, CAP.VIEW_LIBRARY), false)
  assert.equal(hasAnyCap(mask, CAP.MANAGE_ROLES, CAP.ADD_TRACK), true)
  assert.equal(hasAnyCap(mask, CAP.MANAGE_ROLES, CAP.DANGER_ZONE), false)
  assert.deepEqual(capNames(mask), ['VIEW_LIBRARY', 'ADD_TRACK'])
  assert.deepEqual(capNames(0), [])
  assert.deepEqual(capNames(ALL_CAPS), Object.keys(CAP))
})

test('default roles map system keys to display names; Owner holds every capability', () => {
  assert.deepEqual(
    DEFAULT_ROLES.map((r) => [r.key, r.name, r.position]),
    [
      ['owner', 'Owner', 0],
      ['master', 'Admin', 1],
      ['servant', 'Contributor', 2],
      ['peon', 'Listener', 3],
    ],
  )
  assert.equal(role('owner').capabilities, ALL_CAPS)
  for (const v of capValues) assert.ok(hasCap(role('owner').capabilities, v))
  for (const r of DEFAULT_ROLES) assert.match(r.color, /^#[0-9A-Fa-f]{6}$/)
})

test('non-owner default roles never hold MANAGE_BILLING or DANGER_ZONE and narrow downwards', () => {
  for (const r of DEFAULT_ROLES.filter((r) => r.key !== 'owner')) {
    assert.equal(hasAnyCap(r.capabilities, CAP.MANAGE_BILLING, CAP.DANGER_ZONE), false, r.key)
    assert.equal(roleGrantableByEmail(r.capabilities), true, r.key)
    assert.equal(sanitizeCapsForNonOwner(r.capabilities), r.capabilities, r.key)
  }
  // Each role's capabilities are a strict subset of the role above it.
  for (let i = 1; i < DEFAULT_ROLES.length; i++) {
    const higher = DEFAULT_ROLES[i - 1]!.capabilities
    const lower = DEFAULT_ROLES[i]!.capabilities
    assert.equal(lower & ~higher, 0, DEFAULT_ROLES[i]!.key)
    assert.notEqual(lower, higher)
  }
})

test('owner-only caps are stripped by sanitizeCapsForNonOwner and block email grants', () => {
  assert.equal(OWNER_ONLY_CAPS, CAP.MANAGE_BILLING | CAP.DANGER_ZONE)
  assert.equal(sanitizeCapsForNonOwner(ALL_CAPS), ALL_CAPS & ~OWNER_ONLY_CAPS)
  assert.equal(sanitizeCapsForNonOwner(CAP.DANGER_ZONE), 0)
  assert.equal(roleGrantableByEmail(ALL_CAPS), false)
  assert.equal(roleGrantableByEmail(CAP.MANAGE_BILLING), false)
  assert.equal(roleGrantableByEmail(sanitizeCapsForNonOwner(ALL_CAPS)), true)
})

test('roleGrantableByLink never admits owner-only or people-management caps (all masks)', () => {
  assert.equal(OWNER_ONLY_CAPS & ~LINK_INVITE_FORBIDDEN_CAPS, 0)
  let admitted = 0
  for (let mask = 0; mask <= ALL_CAPS; mask++) {
    if (!roleGrantableByLink(mask)) continue
    admitted++
    assert.equal(hasAnyCap(mask, CAP.MANAGE_BILLING, CAP.DANGER_ZONE), false, String(mask))
    assert.equal(mask & LINK_INVITE_FORBIDDEN_CAPS, 0, String(mask))
    assert.equal(roleGrantableByEmail(mask), true, String(mask))
  }
  assert.ok(admitted > 1)
  assert.equal(roleGrantableByLink(role('servant').capabilities), true)
  assert.equal(roleGrantableByLink(role('peon').capabilities), true)
  assert.equal(roleGrantableByLink(role('master').capabilities), false)
  assert.equal(roleGrantableByLink(role('owner').capabilities), false)
  assert.equal(roleGrantableByLink(CAP.DELETE_ANY_TRACK), false)
  assert.equal(roleGrantableByLink(CAP.MANAGE_MEMBERS), false)
})
