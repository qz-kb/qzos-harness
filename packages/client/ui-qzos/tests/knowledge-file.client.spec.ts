/** Managed downloads fail closed after revocation, cancellation or identity changes. */
import { afterEach, expect, it, vi } from 'vitest'
import { downloadOriginal, lifecycleTargets } from '../src/client/knowledge-file.ts'
import { loginApi, loginSessionKey } from '../src/client/login-client.ts'
const path = `/api/kb.file_gateway/download?object_id=${'a'.repeat(64)}`
function setup() {
  const values = new Map([[loginSessionKey, JSON.stringify({ api: loginApi, token: 'test-member' })]])
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null })
  const fetcher = vi.fn<typeof fetch>(); vi.stubGlobal('fetch', fetcher)
  return { values, fetcher }
}
afterEach(() => { vi.unstubAllGlobals() })
it('downloads exact bytes using a header credential and no cookies, redirects or cache', async () => {
  const { fetcher } = setup(); fetcher.mockResolvedValue(new Response('source-bytes'))
  expect(await (await downloadOriginal(path, new AbortController().signal, 'test-member')).text()).toBe('source-bytes')
  expect(fetcher.mock.calls[0]).toMatchObject([`${loginApi}${path.slice(4)}`, { cache: 'no-store', credentials: 'omit', redirect: 'error', headers: { token: 'test-member' } }])
})
it('rejects arbitrary URLs and revoked access without saving error JSON', async () => {
  const { fetcher } = setup()
  await expect(downloadOriginal('https://external.invalid/source', new AbortController().signal, 'test-member')).rejects.toThrow('Invalid managed source')
  expect(fetcher).not.toHaveBeenCalled()
  fetcher.mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: '私有文件不可用' }), { headers: { 'Content-Type': 'application/json' } }))
  await expect(downloadOriginal(path, new AbortController().signal, 'test-member')).rejects.toThrow('私有文件不可用')
})
it('drops bytes when the account changes or the view closes during body reading', async () => {
  const { fetcher, values } = setup()
  const response = new Response('private'); vi.spyOn(response, 'blob').mockImplementation(async () => { values.clear(); return new Blob(['private']) })
  fetcher.mockResolvedValue(response)
  await expect(downloadOriginal(path, new AbortController().signal, 'test-member')).rejects.toThrow('登录账号已变更')
  const next = setup(); const lifetime = new AbortController()
  const cancelled = new Response('private'); vi.spyOn(cancelled, 'blob').mockImplementation(async () => { lifetime.abort(); return new Blob(['private']) })
  next.fetcher.mockResolvedValue(cancelled)
  await expect(downloadOriginal(path, lifetime.signal, 'test-member')).rejects.toThrow()
})
it('offers only existing workflow edges including separate submission and approval', () => {
  expect([0, 1, 2, 3, 4, 5].map(lifecycleTargets)).toEqual([[1], [0, 2], [0, 3], [0], [], []])
})
