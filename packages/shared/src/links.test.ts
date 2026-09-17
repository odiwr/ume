import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UPLOAD } from './constants'
import { LINK_EXTRACT, SUPPORTED_LINK_SITES, linkSiteLabel, parseMediaLink } from './links'

const YT = 'RMPX_vgqQnM'

test('YouTube watch, youtu.be, shorts, mobile, music and embed links normalise to one id', () => {
  const urls = [
    `https://www.youtube.com/watch?v=${YT}`,
    `https://youtube.com/watch?v=${YT}&t=42s`,
    `https://m.youtube.com/watch?v=${YT}`,
    `https://music.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?si=share`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    `  https://youtu.be/${YT}  `,
  ]
  const expected = {
    site: 'youtube',
    id: YT,
    canonicalUrl: `https://www.youtube.com/watch?v=${YT}`,
  }
  for (const u of urls) assert.deepEqual(parseMediaLink(u), expected, u)
  assert.equal(parseMediaLink('https://www.youtube.com/playlist?list=PL123'), null)
  assert.equal(parseMediaLink('https://www.youtube.com/watch?v=tooshort'), null)
})

test('SoundCloud tracks parse; sets, profiles, discover and short links are rejected', () => {
  assert.deepEqual(parseMediaLink('https://soundcloud.com/Artist/Track-Name?in=x'), {
    site: 'soundcloud',
    id: 'artist/track-name',
    canonicalUrl: 'https://soundcloud.com/Artist/Track-Name',
  })
  assert.equal(parseMediaLink('https://m.soundcloud.com/artist/track')?.site, 'soundcloud')
  assert.equal(parseMediaLink('https://soundcloud.com/artist/sets/album'), null)
  assert.equal(parseMediaLink('https://soundcloud.com/artist'), null)
  assert.equal(parseMediaLink('https://soundcloud.com/discover/sets/x'), null)
  assert.equal(parseMediaLink('https://on.soundcloud.com/abc123'), null)
})

test('Bandcamp tracks parse by subdomain; albums are rejected', () => {
  assert.deepEqual(parseMediaLink('https://Artist.bandcamp.com/track/Song-Title'), {
    site: 'bandcamp',
    id: 'artist/song-title',
    canonicalUrl: 'https://artist.bandcamp.com/track/Song-Title',
  })
  assert.equal(parseMediaLink('https://artist.bandcamp.com/album/record'), null)
  assert.equal(parseMediaLink('https://artist.bandcamp.com/'), null)
})

test('Audius, Mixcloud, Vimeo and archive.org', () => {
  assert.deepEqual(parseMediaLink('https://audius.co/Artist/Song'), {
    site: 'audius',
    id: 'artist/song',
    canonicalUrl: 'https://audius.co/Artist/Song',
  })
  assert.equal(parseMediaLink('https://audius.co/artist/playlist/mix'), null)
  assert.equal(parseMediaLink('https://audius.co/artist/album/lp'), null)
  assert.equal(parseMediaLink('https://audius.co/search/term'), null)

  assert.deepEqual(parseMediaLink('https://www.mixcloud.com/User/Mix/'), {
    site: 'mixcloud',
    id: 'user/mix',
    canonicalUrl: 'https://www.mixcloud.com/User/Mix/',
  })
  assert.equal(parseMediaLink('https://www.mixcloud.com/user/playlists/x'), null)
  assert.equal(parseMediaLink('https://www.mixcloud.com/user'), null)

  const vimeo = { site: 'vimeo', id: '123456789', canonicalUrl: 'https://vimeo.com/123456789' }
  assert.deepEqual(parseMediaLink('https://vimeo.com/123456789'), vimeo)
  assert.deepEqual(parseMediaLink('https://player.vimeo.com/video/123456789'), vimeo)
  assert.deepEqual(parseMediaLink('https://vimeo.com/channels/staffpicks/123456789'), vimeo)
  assert.equal(parseMediaLink('https://vimeo.com/about'), null)
  assert.equal(parseMediaLink('https://vimeo.com/1234'), null)

  assert.deepEqual(parseMediaLink('https://archive.org/details/SomeItem'), {
    site: 'archive',
    id: 'someitem',
    canonicalUrl: 'https://archive.org/details/SomeItem',
  })
  assert.equal(parseMediaLink('https://archive.org/search?query=x'), null)
})

test('direct audio files: canonical drops query/hash, id is a stable sha1 of the clean URL', () => {
  const a = parseMediaLink('https://example.com/music/Song.MP3?token=1#t=5')
  assert.equal(a?.site, 'direct')
  assert.equal(a?.canonicalUrl, 'https://example.com/music/Song.MP3')
  assert.match(a!.id, /^[0-9a-f]{40}$/)
  assert.equal(parseMediaLink('https://example.com/music/Song.MP3?token=2')?.id, a?.id)
  assert.notEqual(parseMediaLink('https://example.com/music/Other.mp3')?.id, a?.id)
  assert.equal(parseMediaLink('http://cdn.example.com/a.flac')?.site, 'direct')
  for (const ext of UPLOAD.acceptedExtensions) {
    assert.ok((LINK_EXTRACT.audioExtensions as readonly string[]).includes(ext), ext)
  }
})

test('non-URLs, non-http schemes and unsupported hosts are rejected', () => {
  for (const bad of [
    '',
    'not a url',
    'youtube.com/watch?v=RMPX_vgqQnM', // no scheme
    'ftp://example.com/song.mp3',
    'javascript:alert(1)',
    'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://example.com/',
    'https://example.com/readme.txt',
  ]) {
    assert.equal(parseMediaLink(bad), null, JSON.stringify(bad))
  }
})

test('every documented example parses to its site and labels resolve', () => {
  for (const s of SUPPORTED_LINK_SITES) {
    assert.equal(parseMediaLink(s.example)?.site, s.site, s.example)
    assert.equal(linkSiteLabel(s.site), s.label)
  }
  assert.equal(linkSiteLabel('youtube'), 'YouTube')
  assert.equal(linkSiteLabel('nope'), 'Link')
  assert.equal(linkSiteLabel(null), 'Link')
})
