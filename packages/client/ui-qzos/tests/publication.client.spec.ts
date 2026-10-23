import { describe, expect, it } from 'vitest'
import { publicationEmbed, publicationUrl } from '../src/client/publication-client.ts'

describe('public artifacts', () => {
  it('uses the business visitor origin and encodes public IDs without account credentials', () => {
    expect(publicationUrl('https://business.example/api', 'public/a?x=1', 2)).toBe('https://business.example/chat/public%2Fa%3Fx%3D1')
    expect(() => publicationUrl('https://business.example/api', 'api-secret', 4)).toThrow()
    expect(() => publicationUrl('https://token@business.example/api', 'public', 1)).toThrow()
  })
  it('escapes embed attributes and isolates separate visitor instances', () => {
    const first = publicationEmbed('https://business.example/chat/x?x="<', 'first')
    expect(first).toContain('&quot;&lt;')
    expect(first).toContain('name="qzos-publish:first"')
    expect(publicationEmbed('https://business.example/chat/x', 'second')).not.toBe(first)
  })
})
