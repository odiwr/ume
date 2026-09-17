import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLAIM_TOKEN, INVITE } from './constants'
import {
  generateClaimToken,
  generateConfirmCode,
  generateInviteToken,
  hashToken,
  isClaimTokenShape,
  normalizeClaimToken,
  secretsEqual,
  tokensEqual,
} from './tokens'

const BASE32 = /^[a-z2-7]+$/
const many = <T>(f: () => T, n = 50): T[] => Array.from({ length: n }, f)

test('claim tokens have the ume_ prefix, 40 base32 chars, and are unique', () => {
  const t = generateClaimToken()
  assert.equal(CLAIM_TOKEN.prefix, 'ume_')
  assert.ok(t.startsWith(CLAIM_TOKEN.prefix))
  assert.equal(t.length, CLAIM_TOKEN.prefix.length + 40)
  assert.match(t.slice(CLAIM_TOKEN.prefix.length), BASE32)
  assert.equal(isClaimTokenShape(t), true)
  assert.equal(new Set(many(generateClaimToken)).size, 50)
})

test('isClaimTokenShape accepts padded real tokens and rejects other shapes', () => {
  const t = generateClaimToken()
  assert.equal(isClaimTokenShape(`  ${t}\n`), true)
  for (const bad of [
    '',
    'ume_',
    `ume_${'a'.repeat(39)}`,
    `ume_${'a'.repeat(41)}`,
    `ume_${'0'.repeat(40)}`, // 0/1/8/9 are not in the alphabet
    `ume-${'a'.repeat(40)}`,
    t.toUpperCase(), // the shape check is strict; callers normalise first
  ]) {
    assert.equal(isClaimTokenShape(bad), false, JSON.stringify(bad))
  }
})

test('normalizeClaimToken trims and lower-cases so pasted tokens match', () => {
  const t = generateClaimToken()
  assert.equal(normalizeClaimToken(`  ${t.toUpperCase()}  `), t)
  assert.equal(isClaimTokenShape(normalizeClaimToken(t.toUpperCase())), true)
})

test('invite tokens are 32 base32 chars with no prefix', () => {
  assert.equal(INVITE.linkTokenLength, 32)
  for (const t of many(generateInviteToken)) {
    assert.equal(t.length, INVITE.linkTokenLength)
    assert.match(t, BASE32)
  }
  assert.equal(new Set(many(generateInviteToken)).size, 50)
})

test('confirmation codes are six upper-case base32 characters', () => {
  for (const c of many(generateConfirmCode)) assert.match(c, /^[A-Z2-7]{6}$/)
})

test('hashToken is deterministic SHA-256 hex and never equals the clear value', () => {
  const t = generateClaimToken()
  assert.equal(hashToken(t), hashToken(t))
  assert.match(hashToken(t), /^[0-9a-f]{64}$/)
  assert.notEqual(hashToken(t), t)
  assert.notEqual(hashToken(t), hashToken(`${t}x`))
  assert.notEqual(hashToken(t), hashToken(t.toUpperCase()))
  assert.equal(hashToken(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('tokensEqual and secretsEqual compare exact strings and reject empty secrets', () => {
  assert.equal(tokensEqual('abc', 'abc'), true)
  assert.equal(tokensEqual('abc', 'abd'), false)
  assert.equal(tokensEqual('abc', 'abcd'), false)
  assert.equal(tokensEqual('', ''), true)
  assert.equal(secretsEqual('s', 's'), true)
  assert.equal(secretsEqual('s', 't'), false)
  assert.equal(secretsEqual(undefined, 's'), false)
  assert.equal(secretsEqual('s', undefined), false)
  assert.equal(secretsEqual('', ''), false)
})
