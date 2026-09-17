import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COMMANDS, findCommand } from './commands'
import { COMMAND_PREFIX } from './constants'
import { OWNER_ONLY_CAPS } from './roles'

const DISCORD_NAME = /^[a-z0-9_-]{1,32}$/
const DISCORD_DESCRIPTION_MAX = 100

test('command names are unique and valid Discord command names', () => {
  const names = COMMANDS.map((c) => c.name)
  assert.ok(names.length > 0)
  assert.equal(new Set(names).size, names.length)
  for (const name of names) assert.match(name, DISCORD_NAME)
})

test('descriptions are non-empty and fit the Discord limit, so registration never truncates', () => {
  for (const c of COMMANDS) {
    assert.ok(c.description.trim().length > 0, c.name)
    assert.ok(c.description.length <= DISCORD_DESCRIPTION_MAX, `${c.name}: ${c.description.length}`)
  }
})

test('options: unique valid names, descriptions within 100 chars, required before optional', () => {
  const optionTypes = new Set(['string', 'integer', 'channel', 'user'])
  for (const c of COMMANDS) {
    const names = c.options.map((o) => o.name)
    assert.equal(new Set(names).size, names.length, c.name)
    let seenOptional = false
    for (const o of c.options) {
      const label = `${c.name}.${o.name}`
      assert.match(o.name, DISCORD_NAME, label)
      assert.ok(o.description.length > 0 && o.description.length <= DISCORD_DESCRIPTION_MAX, label)
      assert.ok(optionTypes.has(o.type), label)
      if (!o.required) seenOptional = true
      else assert.equal(seenOptional, false, `${label}: required option after an optional one`)
    }
  }
})

test('examples use the ~ prefix followed by the command name', () => {
  assert.equal(COMMAND_PREFIX, '~')
  for (const c of COMMANDS) {
    assert.ok(c.examples.length > 0, c.name)
    const bare = `${COMMAND_PREFIX}${c.name}`
    for (const ex of c.examples) assert.ok(ex === bare || ex.startsWith(`${bare} `), ex)
  }
})

test('scopes, categories and permission flags are consistent', () => {
  const scopes = new Set(['dm', 'guild', 'both'])
  const categories = new Set(['setup', 'library', 'playback', 'info'])
  for (const c of COMMANDS) {
    assert.ok(scopes.has(c.scope), c.name)
    assert.ok(categories.has(c.category), c.name)
    if (c.requires !== undefined) {
      assert.equal(c.scope, 'guild', `${c.name}: capability checks only apply in a guild`)
      assert.equal(
        c.requires & OWNER_ONLY_CAPS,
        0,
        `${c.name}: never gate a command on owner-only caps`,
      )
    }
    if (c.scope === 'guild')
      assert.ok(c.requires !== undefined, `${c.name}: guild command needs a cap`)
    if (c.requiresGuildAdmin || c.requiresOwner) {
      assert.equal(c.category, 'setup', c.name)
      assert.equal(c.scope, 'dm', c.name)
    }
  }
  assert.deepEqual(
    COMMANDS.filter((c) => c.requiresOwner).map((c) => c.name),
    ['reset', 'purge'],
  )
})

test('findCommand is case-insensitive and misses unknown names', () => {
  assert.equal(findCommand('play')?.name, 'play')
  assert.equal(findCommand('PLAY')?.name, 'play')
  assert.equal(findCommand('nope'), undefined)
  assert.equal(findCommand(''), undefined)
})
