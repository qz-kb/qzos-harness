/** Opt-in real local QZOS API checks through the shipped Web composition. */
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold } from './scaffold.ts'

it.skipIf(!process.env.QZOS_RESOURCE_TEST_ACCOUNT)('retains catalog cards and creates linked knowledge without losing the employee draft', async () => {
  const account = JSON.parse(await readFile(process.env.QZOS_RESOURCE_TEST_ACCOUNT!, 'utf8')) as { email: string; password: string }
  const scaffold = await launchWebScaffold({})
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
  page.setDefaultTimeout(30000)
  let token = ''
  let knowledgeId = 0, employeeId = 0
  let modelReads = 0
  let releaseList: (() => void) | undefined
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:3082/api/')) {
      token = request.headers().token || token
      if (request.url().includes('/index/models')) modelReads++
    }
  })
  const api = async (path: string, body?: object) => {
    const response = await fetch(`http://127.0.0.1:3082/api${path}`, { method: body ? 'POST' : 'GET', headers: { token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const value = await response.json() as { code: number; msg?: string; data: Record<string, unknown> }
    if (value.code !== 1) throw new Error(`${path}: ${value.msg}`)
    return value.data
  }
  const screenshot = async (name: string) => {
    if (!process.env.QZOS_RESOURCE_SCREENSHOTS) return
    await mkdir(process.env.QZOS_RESOURCE_SCREENSHOTS, { recursive: true })
    await page.screenshot({ animations: 'disabled', path: `${process.env.QZOS_RESOURCE_SCREENSHOTS}/${name}.png` })
  }
  try {
    await page.goto(scaffold.authenticatedUrl)
    const welcome = page.getByRole('button', { name: /^(Continue|继续)$/ })
    if (await welcome.isVisible()) await welcome.click()
    const nativeAccount = page.getByRole('dialog', { name: /^(Get started|开始使用)$/ })
    if (await nativeAccount.isVisible()) await nativeAccount.getByRole('button', { name: /^(Close|关闭)$/ }).click()
    const login = page.getByRole('dialog', { name: '登录 QZOS', exact: true })
    await login.getByRole('button', { name: '邮箱登录', exact: true }).click()
    await page.locator('#qzos-login-account').fill(account.email)
    await page.locator('#qzos-login-password').fill(account.password)
    await login.getByRole('button', { name: '登录', exact: true }).click()
    await login.waitFor({ state: 'hidden' })
    const nav = page.getByRole('navigation')
    const panel = page.locator('[data-qzos-panel]')
    await nav.getByRole('button', { name: '知识库', exact: true }).click()
    await panel.locator('article').first().waitFor()
    await screenshot('knowledge')
    await nav.getByRole('button', { name: '数字员工', exact: true }).click()
    await panel.getByRole('button', { name: '创建数字员工', exact: true }).waitFor()
    await screenshot('employees')
    await nav.getByRole('button', { name: '知识库', exact: true }).click()
    expect(await panel.locator('article').count()).toBeGreaterThan(0)
    expect(await page.getByText('正在加载知识库…', { exact: true }).count()).toBe(0)
    expect(modelReads).toBe(0)
    await nav.getByRole('button', { name: '数字员工', exact: true }).click()
    // Delay an actual old server response across creation to exercise an in-flight refresh.
    const heldList = new Promise<void>((resolve) => { releaseList = resolve })
    let capturedList = false
    await page.route('**/api/kb.know/lists?*', async (route) => {
      const response = await route.fetch()
      capturedList = true
      await heldList
      await route.fulfill({ response })
    }, { times: 1 })
    await nav.getByRole('button', { name: '知识库', exact: true }).click()
    await expect.poll(() => capturedList).toBe(true)
    await nav.getByRole('button', { name: '数字员工', exact: true }).click()
    await panel.getByRole('button', { name: '创建数字员工', exact: true }).click()
    const employee = page.getByRole('dialog', { name: '新建数字员工', exact: true })
    const stamp = Date.now()
    const name = `界面验证员工-${stamp}`, kbName = `界面验证知识库-${stamp}`
    await employee.getByRole('textbox', { name: '名称', exact: true }).fill(name)
    await employee.getByRole('textbox', { name: '一句话介绍', exact: true }).fill('创建知识库后保留草稿')
    await employee.getByRole('textbox', { name: '职责描述', exact: true }).fill('依据有权限的知识回答，保留来源。')
    expect(await employee.getByRole('combobox', { name: '对话模型', exact: true }).count()).toBe(0)
    await screenshot('employee-create')
    await employee.getByRole('button', { name: '新增知识库', exact: true }).click()
    const knowledge = page.getByRole('dialog', { name: '新增知识库', exact: true })
    await knowledge.getByRole('textbox', { name: '知识库名称', exact: true }).fill(kbName)
    await knowledge.getByRole('textbox', { name: '知识库简介', exact: true }).fill('仅含合成内容')
    await expect.poll(() => knowledge.getByRole('combobox', { name: '向量模型', exact: true }).inputValue()).not.toBe('')
    const vectorId = await knowledge.getByRole('combobox', { name: '向量模型', exact: true }).inputValue()
    await knowledge.locator('input[type=file]').setInputFiles({ name: 'synthetic-cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64') })
    await screenshot('knowledge-create')
    const added = page.waitForResponse(response => response.url().includes('/kb.know/add') && response.request().method() === 'POST')
    await knowledge.getByRole('button', { name: '创建并关联', exact: true }).click()
    const result = await (await added).json() as { code: number; data: { id: number }; msg?: string }
    expect(result.code, result.msg).toBe(1); knowledgeId = result.data.id
    await knowledge.waitFor({ state: 'hidden' })
    expect(await employee.getByRole('textbox', { name: '名称', exact: true }).inputValue()).toBe(name)
    expect(await employee.getByRole('textbox', { name: '一句话介绍', exact: true }).inputValue()).toBe('创建知识库后保留草稿')
    expect(await employee.getByRole('checkbox', { name: kbName, exact: true }).isChecked()).toBe(true)
    const refreshedList = page.waitForResponse(async (response) => {
      if (!response.url().includes('/kb.know/lists?')) return false
      const value = await response.json() as { data: { lists: { id: number }[] } }
      return value.data.lists.some(row => Number(row.id) === knowledgeId)
    })
    releaseList!()
    await refreshedList
    expect(String((await api(`/kb.know/detail?id=${knowledgeId}`)).embedding_model_id)).toBe(vectorId)
    const employeeAdded = page.waitForResponse(response => response.url().includes('/kb.robot/add') && response.request().method() === 'POST')
    await employee.getByRole('button', { name: '创建并配置', exact: true }).click()
    const employeeResult = await (await employeeAdded).json() as { code: number; data: { id: number }; msg?: string }
    expect(employeeResult.code, employeeResult.msg).toBe(1); employeeId = employeeResult.data.id
    await employee.waitFor({ state: 'hidden' })
    const saved = await api(`/kb.robot/detail?id=${employeeId}`)
    expect(saved.kb_ids).toEqual([knowledgeId])
    expect(Number(saved.model_id)).toBe(0)
    expect(saved.roles_prompt).toBe('依据有权限的知识回答，保留来源。')
    await screenshot('employee-saved')
    await page.setViewportSize({ width: 390, height: 844 })
    await screenshot('employee-narrow')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  } catch (error) {
    await screenshot('failure'); throw error
  } finally {
    releaseList?.()
    // Only this test's newly created synthetic resources are removed.
    if (employeeId) await api('/kb.robot/del', { id: employeeId })
    if (knowledgeId) await api('/kb.know/del', { id: knowledgeId })
    await browser.close(); await scaffold.close()
  }
}, 120000)
