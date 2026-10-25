/** Pending correction identities survive view reloads without crossing business accounts. */
import { expect, it } from 'vitest'
import { correctionStorageKey, readCorrection, rememberCorrection } from '../src/client/employee-client.ts'

function tabStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size }, clear: () => data.clear(), key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) },
  }
}
const draft = { correction_key: 'request-12345678', kb_id: '9', question: 'Question', answer: 'Correct answer' }
it('restores the exact submitted request and content for a reopened view, then clears on acknowledgement', () => {
  const storage = tabStorage(), key = correctionStorageKey('1', '7', '15')
  expect(readCorrection(storage, key)).toBeUndefined()
  rememberCorrection(storage, key, { ...draft, feedback_key: 'unrelated', password: 'exclude' })
  expect(readCorrection(storage, correctionStorageKey('1', '7', '15'))).toEqual(draft)
  expect(storage.getItem(key)).not.toContain('password')
  storage.removeItem(key)
  expect(readCorrection(storage, key)).toBeUndefined()
})
it('isolates account, employee and conversation-record drafts', () => {
  const storage = tabStorage()
  rememberCorrection(storage, correctionStorageKey('1', '7', '15'), draft)
  for (const [user, employee, record] of [['2', '7', '15'], ['1', '8', '15'], ['1', '7', '16']]) {
    expect(readCorrection(storage, correctionStorageKey(user!, employee!, record!))).toBeUndefined()
  }
})
it('does not replace malformed recovery data with a new submission', () => {
  const storage = tabStorage(), key = correctionStorageKey('1', '7', '15')
  for (const raw of ['{', '{}', JSON.stringify({ ...draft, correction_key: 4 })]) {
    storage.setItem(key, raw)
    expect(() => readCorrection(storage, key)).toThrow()
    expect(storage.getItem(key)).toBe(raw)
  }
})
it('fails before submission when session storage cannot retain the request', () => {
  const storage = tabStorage()
  storage.setItem = () => { throw new Error('storage unavailable') }
  expect(() => rememberCorrection(storage, correctionStorageKey('1', '7', '15'), draft)).toThrow('storage unavailable')
})
