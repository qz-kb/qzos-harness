/** Template writes and offline downloads must stay under the captured business identity. */
import { afterEach, expect, it, vi } from 'vitest'
import { applyEmployeeTemplate, capabilityModels, exportSkill } from '../src/client/capability-client.ts'
import { loginApi, loginSessionKey } from '../src/client/login-client.ts'
const reply = (data: unknown) => new Response(JSON.stringify({ code: 1, data }))
function setup() {
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => key === loginSessionKey ? JSON.stringify({ api: loginApi, token: 'synthetic' }) : null })
  return fetcher
}
afterEach(() => { vi.unstubAllGlobals() })
it('creates only from trusted template identity and verifies model and name on readback', async () => {
  const fetcher = setup()
  fetcher.mockResolvedValueOnce(reply({ id: 9 })).mockResolvedValueOnce(reply({ id: 9, name: 'Reader', model_id: 2, model_sub_id: 3 }))
  expect(await applyEmployeeTemplate('4', ' Reader ', '2:3', new AbortController().signal, 'synthetic')).toBe('9')
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({ template_id: 4, name: 'Reader', model_id: 2, model_sub_id: 3 })
  expect(fetcher.mock.calls[1]?.[0] as string).toContain('/kb.robot/detail?id=9')
})
it('rejects stale identities and incomplete model selection before creating an employee', async () => {
  const fetcher = setup()
  await expect(applyEmployeeTemplate('4', 'Reader', '2:3', new AbortController().signal, 'old')).rejects.toThrow('账号已变更')
  await expect(applyEmployeeTemplate('4', 'Reader', '2:', new AbortController().signal, 'synthetic')).rejects.toThrow('可用模型')
  expect(fetcher).not.toHaveBeenCalled()
})
it('does not claim successful template application after a mismatched readback', async () => {
  const fetcher = setup()
  fetcher.mockResolvedValueOnce(reply({ id: 9 })).mockResolvedValueOnce(reply({ id: 9, name: 'Reader', model_id: 4, model_sub_id: 5 }))
  await expect(applyEmployeeTemplate('4', 'Reader', '2:3', new AbortController().signal, 'synthetic')).rejects.toThrow('回读不一致')
})
it('preserves model readiness instead of selecting an unavailable provider', () => {
  expect(capabilityModels({ chatModels: [{ id: 2, name: 'Group', is_ready: false, models: [{ id: 3, alias: 'Model' }] }] })).toEqual([{ value: '2:3', label: 'Group / Model', disabled: true }])
})
it('downloads the signed package with authenticated POST and rejects JSON errors', async () => {
  const fetcher = setup()
  fetcher.mockResolvedValueOnce(new Response('zip bytes', { headers: { 'Content-Type': 'application/zip' } }))
  expect(await (await exportSkill({ resource_id: 'skill.a', version: '1.0.0' }, new AbortController().signal, 'synthetic')).text()).toBe('zip bytes')
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit', headers: { token: 'synthetic' } })
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, msg: 'MARKET_DISABLED' }), { headers: { 'Content-Type': 'application/json' } }))
  await expect(exportSkill({ resource_id: 'skill.a', version: '1.0.0' }, new AbortController().signal, 'synthetic')).rejects.toThrow('MARKET_DISABLED')
})
