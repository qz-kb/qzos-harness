import { afterEach, expect, it, vi } from 'vitest'
import { loginApi, loginRequest, loginSessionKey, LoginError, storedLogin } from '../src/client/login-client.ts'

afterEach(() => { vi.unstubAllGlobals() })
it('keeps QZOS credentials separate from Host cookies and handles business rejection', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 1, data: { token: 'synthetic' } })))
  vi.stubGlobal('fetch', fetcher)
  expect(await loginRequest('/login/account', { scene: 1, mobile: 'test', password: 'synthetic', terminal: 4 })).toEqual({ token: 'synthetic' })
  expect(fetcher.mock.calls[0]?.[0]).toBe(`${loginApi}/login/account`)
  const options = fetcher.mock.calls[0]?.[1] as RequestInit
  expect(options.credentials).toBe('omit')
  expect(options.redirect).toBe('error')
  expect(options.headers).not.toHaveProperty('token')
  fetcher.mockResolvedValue(new Response(JSON.stringify({ code: -1, msg: 'expired', data: [] })))
  await expect(loginRequest('/user/info', undefined, 'synthetic')).rejects.toBeInstanceOf(LoginError)
  expect((fetcher.mock.calls[1]?.[1] as RequestInit).headers).toHaveProperty('token', 'synthetic')
})
it('handles empty logout replies and refuses malformed or HTTP error responses', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 1, data: [] })))
  vi.stubGlobal('fetch', fetcher)
  expect(await loginRequest('/login/logout', {}, 'synthetic')).toEqual({})
  fetcher.mockResolvedValue(new Response('{}', { status: 503 }))
  await expect(loginRequest('/index/config')).rejects.toThrow('HTTP 503')
  fetcher.mockResolvedValue(new Response(JSON.stringify({ code: 1, data: 'not-an-object' })))
  await expect(loginRequest('/index/config')).rejects.toThrow('Invalid QZOS response')
})
it('restores only credentials owned by the selected business API', () => {
  const getItem = vi.fn(() => JSON.stringify({ api: loginApi, token: 'synthetic' }))
  const storage = { getItem } as unknown as Storage
  expect(storedLogin(storage)).toBe('synthetic')
  expect(getItem).toHaveBeenCalledWith(loginSessionKey)
  getItem.mockReturnValue(JSON.stringify({ api: 'https://other.invalid', token: 'synthetic' }))
  expect(storedLogin(storage)).toBeUndefined()
  getItem.mockReturnValue('broken')
  expect(storedLogin(storage)).toBeUndefined()
})
