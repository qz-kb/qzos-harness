// Actual isolated Host and Server. No API interception or fabricated auth state.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const dir = resolve(process.env.PRODUCT_TEST_PRIVATE)
assert.ok(dir.endsWith('/qzos/.local/online-update'))
const user = JSON.parse(await readFile(resolve(dir, 'product-user.json'), 'utf8'))
const log = await readFile(resolve(dir, 'dsh.log'), 'utf8')
const entry = log.match(/http:\/\/127\.0\.0\.1:24921\/\S+/)?.[0]
assert.ok(entry, 'explicit isolated Host authentication entry required')
const secrets = new Set([user.password])
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
  page.setDefaultTimeout(30000)
  page.on('request', request => { const token = request.headers().token; if (token) secrets.add(token) })
  await page.addInitScript(() => { globalThis.__QZOS_BUSINESS_API__ = 'http://127.0.0.1:24911/api' })
  await page.goto(entry)
  await page.locator('#qzos-login-account').waitFor()
  const welcome = page.getByRole('button', { name: /^(Continue|继续)$/ })
  if (await welcome.isVisible()) await welcome.click()
  await page.locator('#qzos-login-account').fill(user.mobile)
  await page.locator('#qzos-login-password').fill(user.password)
  const nativeAccount = page.getByRole('dialog', { name: /^(Get started|开始使用)$/ })
  if (await nativeAccount.isVisible()) await nativeAccount.getByRole('button', { name: /^(Close|关闭)$/ }).click()
  await page.getByRole('dialog', { name: /^(Sign in to QZOS|登录 QZOS)$/ }).getByRole('button', { name: /^(Sign in|登录)$/ }).click()
  const history = page.getByRole('button', { name: /^(Release notes|更新日志)$/ })
  await history.waitFor()
  const composer = page.locator('[contenteditable="true"]').first()
  const draft = '隔离验证草稿：查看更新内容后仍保留。'
  await composer.fill(draft)
  await history.click()
  const dialog = page.getByRole('dialog', { name: /^(Release notes|更新日志)$/ })
  if (process.env.PRODUCT_EXPECT_LEGACY === '1') {
    await dialog.getByText(/暂时无法读取更新日志|Release notes are unavailable/).waitFor()
    await dialog.getByRole('button', { name: /^(Got it|知道了)$/ }).click()
    assert.equal(await composer.innerText(), draft)
    console.log('PASS restored historical Server: normal cross-origin QZOS login, explicit missing-history state, draft retained')
  } else {
  await dialog.getByText('仅用于隔离验证，不是已发布版本公告。', { exact: true }).waitFor()
  assert.equal(await dialog.getByText('历史显示合成样例，不代表正式版本说明。', { exact: true }).count(), 0)
  await dialog.getByRole('button', { name: /All updates|全部更新/ }).click()
  await dialog.getByText('历史显示合成样例，不代表正式版本说明。', { exact: true }).waitFor()
  await mkdir(resolve(dir, 'browser-live'), { recursive: true })
  await page.screenshot({ path: resolve(dir, 'browser-live/product-dsh.png') })
  await dialog.getByRole('button', { name: /^(Got it|知道了)$/ }).click()
  assert.equal(await composer.innerText(), draft)
  await history.click()
  assert.equal(await page.locator('[aria-label="See what changed"], [aria-label="本次更新内容已就绪"]').count(), 0)
  await page.setViewportSize({ width: 620, height: 480 })
  const rect = await dialog.boundingBox(); assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 620 && rect.y + rect.height <= 480)
  await dialog.getByRole('button', { name: /^(Got it|知道了)$/ }).click()
  const token = await page.evaluate(() => JSON.parse(sessionStorage.getItem('qzos.business-session.v1')).token)
  for (const surface of ['admin', 'desktop', 'web']) {
    for (const [version, expected] of [['2.12.3', 'client_too_old'], ['3.0.0', 'server_too_old']]) {
      const headers = { token, 'X-Qzos-Surface': surface, 'X-Qzos-Version': version }
      const rejected = await (await page.request.get('http://127.0.0.1:24911/api/kb.know/lists?type=0', { headers })).json()
      assert.equal(rejected.data.error_code, 'CLIENT_INCOMPATIBLE'); assert.equal(rejected.data.status, expected)
      const query = await (await page.request.get(`http://127.0.0.1:24911/api/kb.know/lists?type=0&qzos_surface=${surface}&qzos_version=${version}`, { headers: { token } })).json()
      assert.equal(query.data.error_code, 'CLIENT_INCOMPATIBLE'); assert.equal(query.data.status, expected)
      const readable = await (await page.request.get(`http://127.0.0.1:24911/api/productUpdate/overview?surface=${surface}&version=${version}`, { headers })).json()
      assert.equal(readable.code, 1); assert.equal(readable.data.compatibility.status, expected)
      const bootstrap = await (await page.request.get('http://127.0.0.1:24911/api/user/info', { headers })).json()
      assert.equal(bootstrap.code, 1)
    }
    const compatible = await (await page.request.get('http://127.0.0.1:24911/api/kb.know/lists?type=0', { headers: { token, 'X-Qzos-Surface': surface, 'X-Qzos-Version': '2.13.0' } })).json()
    assert.equal(compatible.code, 1)
  }
  const unauthenticated = await (await page.request.get('http://127.0.0.1:24911/api/productUpdate/overview?surface=web&version=2.13.0')).json()
  assert.notEqual(unauthenticated.code, 1)
  console.log('PASS actual DSH login, shared history, filters, retained draft, remembered read state, small viewport; all three compatibility boundaries and authenticated recovery reads')
  if (process.env.PRODUCT_HOST_UPGRADE === '1') {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const marker = resolve(dir, 'host-upgrade-ready')
    await writeFile(marker, 'ready\n', { mode: 0o600 })
    try {
      const notice = page.getByRole('dialog', { name: /^(Service version changed|服务版本变化)$/ })
      await notice.waitFor({ timeout: 240000 })
      assert.equal(await composer.innerText(), draft, 'Host update must wait for user confirmation')
      await page.screenshot({ path: resolve(dir, 'browser-live/product-host-update.png') })
      await notice.getByRole('button', { name: /^(Reload to load the new version|刷新以加载新版本)$/ }).click()
      await page.waitForLoadState('domcontentloaded')
      await history.waitFor()
      await notice.waitFor({ state: 'hidden' })
      console.log('PASS actual rebuilt Host reconnect: native version-change prompt, draft retained until explicit reload, authenticated new page restored')
    } finally { await rm(marker, { force: true }) }
  }
  }
} catch (error) {
  let message = String(error?.stack || error)
  for (const secret of secrets) message = message.replaceAll(secret, '[redacted]')
  console.error(message)
  process.exitCode = 1
} finally { await browser.close() }
