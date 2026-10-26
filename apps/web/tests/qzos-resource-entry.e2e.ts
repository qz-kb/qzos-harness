/** Opt-in real local QZOS API checks through the shipped Web composition. */
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold } from './scaffold.ts'

it.skipIf(!process.env.QZOS_RESOURCE_TEST_ACCOUNT)('retains catalog cards and creates linked knowledge without losing the employee draft', async () => {
  const account = JSON.parse(await readFile(process.env.QZOS_RESOURCE_TEST_ACCOUNT!, 'utf8')) as { email?: string; mobile?: string; password: string }
  const base = process.env.QZOS_RESOURCE_API ?? 'http://127.0.0.1:3082/api'
  const world = await mkdtemp(join(tmpdir(), 'qzos-resource-entry-'))
  const overlay = join(world, 'business.yml')
  await writeFile(overlay, `- id: qzos-employees\n  config:\n    apiUrl: ${JSON.stringify(base)}\n    requestTimeoutMs: 60000\n`)
  const scaffold = await launchWebScaffold({ extraOverlayPath: overlay })
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
  page.setDefaultTimeout(30000)
  let token = ''
  let knowledgeId = 0, employeeId = 0, linkedKnowledgeId = 0
  let modelReads = 0
  let releaseList: (() => void) | undefined
  page.on('request', (request) => {
    if (request.url().startsWith(`${base}/`)) {
      token = request.headers().token || token
      if (request.url().includes('/index/models')) modelReads++
    }
  })
  const api = async (path: string, body?: object) => {
    const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
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
    await page.addInitScript((value) => { Reflect.set(globalThis, '__QZOS_BUSINESS_API__', value) }, base)
    await page.goto(scaffold.authenticatedUrl)
    const welcome = page.getByRole('button', { name: /^(Continue|继续)$/ })
    if (await welcome.isVisible()) await welcome.click()
    const nativeAccount = page.getByRole('dialog', { name: /^(Get started|开始使用)$/ })
    if (await nativeAccount.isVisible()) await nativeAccount.getByRole('button', { name: /^(Close|关闭)$/ }).click()
    const login = page.getByRole('dialog', { name: '登录 QZOS', exact: true })
    await login.getByRole('button', { name: account.email ? '邮箱登录' : '手机号登录', exact: true }).click()
    await page.locator('#qzos-login-account').fill(account.email ?? account.mobile ?? '')
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
    await panel.getByRole('button', { name: '共享员工', exact: true }).click()
    await panel.getByRole('combobox', { name: '员工分类' }).waitFor()
    await screenshot('employees-shared')
    await panel.getByRole('button', { name: '我的数字员工', exact: true }).click()
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
    await expect.poll(() => capturedList, { timeout: 30000 }).toBe(true)
    await nav.getByRole('button', { name: '数字员工', exact: true }).click()
    await panel.getByRole('button', { name: '创建数字员工', exact: true }).click()
    const employee = page.getByRole('dialog', { name: '新建数字员工', exact: true })
    const stamp = Date.now()
    const name = `界面验证员工-${stamp}`, kbName = `界面验证知识库-${stamp}`
    await employee.getByRole('textbox', { name: '名称', exact: true }).fill(name)
    await employee.getByRole('textbox', { name: '一句话介绍', exact: true }).fill('创建知识库后保留草稿')
    await employee.getByRole('textbox', { name: '职责描述', exact: true }).fill('依据有权限的知识回答，保留来源。')
    const backendModel = employee.getByRole('combobox', { name: '后台对话模型', exact: true })
    await expect.poll(() => backendModel.inputValue()).toMatch(/^[1-9][0-9]*:[1-9][0-9]*$/)
    const backendModelId = Number((await backendModel.inputValue()).split(':')[0])
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
    await employee.locator('summary').click()
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
    expect(Number(saved.model_id)).toBe(backendModelId)
    expect(saved.roles_prompt).toBe('依据有权限的知识回答，保留来源。')
    await screenshot('employee-saved')
    // Creating a second library from settings must preserve unsaved employee fields.
    await panel.getByRole('textbox', { name: '简介', exact: true }).fill('设置页新增知识库时保留的简介')
    await panel.getByRole('button', { name: '新增知识库', exact: true }).click()
    const fromSettings = page.getByRole('dialog', { name: '新增知识库', exact: true })
    await fromSettings.getByRole('textbox', { name: '知识库名称', exact: true }).fill(`设置关联-${stamp}`)
    await fromSettings.locator('input[type="file"]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') })
    const settingsAdded = page.waitForResponse(response => response.url().includes('/kb.know/add') && response.request().method() === 'POST')
    await fromSettings.getByRole('button', { name: '创建并关联', exact: true }).click()
    const settingsResult = await (await settingsAdded).json() as { code: number; data: { id: number } }
    expect(settingsResult.code).toBe(1); linkedKnowledgeId = settingsResult.data.id
    await fromSettings.waitFor({ state: 'hidden' })
    expect(await panel.getByRole('textbox', { name: '简介', exact: true }).inputValue()).toBe('设置页新增知识库时保留的简介')
    await panel.getByRole('button', { name: '刷新知识库', exact: true }).click()
    expect(await panel.getByRole('textbox', { name: '简介', exact: true }).inputValue()).toBe('设置页新增知识库时保留的简介')
    await panel.getByRole('button', { name: '保存', exact: true }).click()
    await expect.poll(async () => (await api(`/kb.robot/detail?id=${employeeId}`)).kb_ids).toEqual([knowledgeId, linkedKnowledgeId])
    await panel.getByRole('button', { name: 'AI模型/搜索配置', exact: true }).click()
    await panel.getByText('内部 DSH 回答使用工作窗口中选择的模型；员工模型用于公开访客入口。').first().waitFor()
    expect(Number((await panel.getByRole('combobox', { name: '后台对话模型' }).inputValue()).split(':')[0])).toBe(backendModelId)
    await screenshot('employee-search')
    await panel.getByRole('button', { name: '界面配置', exact: true }).click()
    await panel.getByRole('textbox', { name: '欢迎语', exact: true }).fill('你好，欢迎咨询。#如何入职#')
    await panel.getByRole('button', { name: '+ 添加菜单', exact: true }).click()
    const menuDialog = page.getByRole('dialog', { name: '添加菜单', exact: true })
    await menuDialog.getByRole('textbox', { name: '关键词', exact: true }).fill('帮助')
    await menuDialog.getByRole('textbox', { name: '回复内容', exact: true }).fill('请说明需要查询的制度。')
    await menuDialog.getByLabel('上传图片', { exact: true }).setInputFiles({ name: 'menu.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') })
    await menuDialog.getByRole('img').waitFor()
    await screenshot('employee-menu')
    await menuDialog.getByRole('button', { name: '确认', exact: true }).click()
    await panel.getByRole('button', { name: '保存', exact: true }).click()
    await expect.poll(async () => (await api(`/kb.robot/detail?id=${employeeId}`)).welcome_introducer).toBe('你好，欢迎咨询。#如何入职#')
    const withMenu = await api(`/kb.robot/detail?id=${employeeId}`)
    expect((withMenu.menus as { keyword: string; images: string[] }[])[0]?.keyword).toBe('帮助')
    expect((withMenu.menus as { images: string[] }[])[0]?.images[0]).not.toMatch(/^data:/)
    await panel.getByRole('button', { name: '界面配置', exact: true }).click()
    await panel.getByRole('button', { name: '编辑', exact: true }).click()
    expect(await menuDialog.getByRole('img').count()).toBe(1)
    await menuDialog.getByRole('textbox', { name: '回复内容', exact: true }).fill('请提供制度名称。')
    await menuDialog.getByRole('button', { name: '确认', exact: true }).click()
    await panel.getByRole('button', { name: '保存', exact: true }).click()
    await expect.poll(async () => ((await api(`/kb.robot/detail?id=${employeeId}`)).menus as { content: string }[])[0]?.content).toBe('请提供制度名称。')
    await panel.getByRole('button', { name: '界面配置', exact: true }).click()
    await screenshot('employee-interface')
    expect(await panel.getByRole('button', { name: '工作流配置', exact: true }).isDisabled()).toBe(true)
    await panel.getByRole('button', { name: '发布 AI 员工', exact: true }).click()
    expect(await panel.getByRole('button', { name: /^API调用/ }).isDisabled()).toBe(true)
    await screenshot('employee-release')
    await panel.getByRole('button', { name: '对话数据', exact: true }).first().click()
    await panel.getByText('昨日对话次数', { exact: true }).waitFor()
    const counts = await api(`/kb.chat/dataCount?robot_id=${employeeId}`)
    expect(Number((counts.robot as { yesterdayChatCount: number }).yesterdayChatCount)).toBe(0)
    await expect.poll(() => panel.getByRole('alert').count()).toBe(0)
    await screenshot('employee-statistics')
    await page.setViewportSize({ width: 390, height: 844 })
    await screenshot('employee-settings-narrow')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await nav.getByRole('button', { name: '知识库', exact: true }).click()
    await panel.getByRole('button', { name: `查看详情 · ${kbName}`, exact: true }).click()
    await panel.getByRole('button', { name: '手动录入', exact: true }).waitFor()
    await screenshot('knowledge-learning')
    await panel.getByRole('button', { name: '导入数据', exact: true }).click()
    await panel.getByText(/^当前方式：/).waitFor()
    const picker = panel.getByLabel('选择文件', { exact: true })
    if (process.env.QZOS_RESOURCE_VERIFY_IMPORT === '1') {
      expect(await picker.getAttribute('accept')).toContain('.pptx')
      const capabilities = await api('/kb.teach/importCapabilities')
      const contracts = capabilities.file_contracts as { document: { selectable_extensions: string[] } }
      expect((await picker.getAttribute('accept'))?.split(',')).toEqual(contracts.document.selectable_extensions)
      await screenshot('knowledge-import')
      await picker.setInputFiles({ name: `layout-${stamp}.txt`, mimeType: 'text/plain', buffer: Buffer.from('页面适配验证：知识库入职培训的地点是青竹会议室。') })
      const imported = page.waitForResponse(response => response.url().includes('/kb.teach/import?') || response.url().endsWith('/kb.teach/import'))
      await panel.getByRole('button', { name: '保存', exact: true }).click()
      const importedResult = await (await imported).json() as { code: number; msg?: string }
      expect(importedResult.code, importedResult.msg).toBe(1)
      await panel.getByRole('button', { name: `layout-${stamp}.txt`, exact: true }).waitFor()
      await screenshot('knowledge-imported')
      const fileList = await api(`/kb.know/files?kb_id=${knowledgeId}&page_no=1&page_size=100`)
      const file = (fileList.lists as { id: number; name: string }[]).find(row => row.name === `layout-${stamp}.txt`)
      expect(file).toBeDefined()
      const fileRow = panel.getByRole('row').filter({ has: panel.getByRole('button', { name: `layout-${stamp}.txt`, exact: true }) })
      await fileRow.getByRole('button', { name: '解析与学习状态', exact: true }).click()
      const processing = page.getByRole('dialog').filter({ hasText: `layout-${stamp}.txt` })
      await screenshot('knowledge-processing')
      // Let the real parser finish, then review through the actual dialog if required.
      await expect.poll(async () => {
        const state = await api(`/kb.teach/parseStatus?kb_id=${knowledgeId}&fd_id=${file!.id}`)
        const processing = state.processing as { actions?: string[] } | undefined
        return Number(state.current_version) > 0 || processing?.actions?.includes('review') === true
      }, { timeout: 60000, interval: 1500 }).toBe(true)
      await processing.getByRole('button', { name: '刷新状态', exact: true }).click()
      const confirmLearn = processing.getByRole('button', { name: '确认并学习', exact: true })
      if (await confirmLearn.count()) {
        await confirmLearn.click()
        await processing.getByRole('button', { name: '确认操作', exact: true }).click()
      }
      await expect.poll(async () => Number((await api(`/kb.teach/parseStatus?kb_id=${knowledgeId}&fd_id=${file!.id}`)).current_version), { timeout: 60000, interval: 1500 }).toBeGreaterThan(0)
      await processing.getByRole('button', { name: '关闭', exact: true }).last().click()
    } else {
      // Explicitly separate unavailable server-import verification from the manual learning path.
      expect(await picker.isDisabled()).toBe(true)
      await screenshot('knowledge-import-unavailable')
      await panel.getByRole('button', { name: '文件导入', exact: true }).click()
      await panel.getByRole('button', { name: '手动录入', exact: true }).click()
      await panel.getByRole('button', { name: '录入数据', exact: true }).click()
      const entry = page.getByRole('dialog', { name: '录入数据', exact: true })
      await entry.getByRole('textbox', { name: '文档内容', exact: true }).fill('页面适配验证：知识库入职培训的地点是青竹会议室。')
      await screenshot('knowledge-entry')
      await entry.getByRole('button', { name: '确认', exact: true }).click()
      await entry.waitFor({ state: 'hidden' })
      await expect.poll(() => panel.getByRole('cell', { name: '学习成功', exact: true }).count(), { timeout: 60000, interval: 1500 }).toBe(1)
      await screenshot('knowledge-learned')
    }
    await panel.getByRole('button', { name: '搜索测试', exact: true }).click()
    await screenshot('knowledge-search')
    await panel.getByRole('textbox', { name: '测试文本', exact: true }).fill('入职培训地点在哪里？')
    await panel.getByRole('button', { name: '测试', exact: true }).click()
    await panel.getByText('页面适配验证：知识库入职培训的地点是青竹会议室。', { exact: true }).waitFor()
    await screenshot('knowledge-search-result')
    await panel.getByRole('button', { name: '团队成员', exact: true }).click()
    await panel.getByRole('cell', { name: '所有者', exact: true }).waitFor()
    await screenshot('knowledge-team')
    await panel.getByRole('button', { name: '+ 添加成员', exact: true }).click()
    const members = page.getByRole('dialog', { name: '添加成员', exact: true })
    await members.getByRole('textbox', { name: '搜索成员', exact: true }).fill('不存在的合成成员')
    await expect.poll(() => members.getByText('请搜索成员添加', { exact: true }).count()).toBe(1)
    expect(await members.getByRole('button', { name: '确认', exact: true }).isDisabled()).toBe(true)
    await screenshot('knowledge-members')
    if (process.env.QZOS_RESOURCE_READER_ACCOUNT) {
      const reader = JSON.parse(await readFile(process.env.QZOS_RESOURCE_READER_ACCOUNT, 'utf8')) as { mobile: string; password: string; nickname: string }
      await members.getByRole('textbox', { name: '搜索成员', exact: true }).fill(reader.nickname)
      await members.getByRole('checkbox', { name: reader.nickname, exact: true }).check()
      await members.getByRole('combobox', { name: `默认权限 · ${reader.nickname}`, exact: true }).selectOption('3')
      await members.getByRole('button', { name: '确认', exact: true }).click()
      await members.waitFor({ state: 'hidden' })
      const readerRow = panel.getByRole('row').filter({ hasText: reader.nickname })
      await readerRow.waitFor()
      const response = await page.request.post(`${base}/login/account`, { data: { mobile: reader.mobile, password: reader.password, scene: 1, terminal: 4 } })
      const authenticated = await response.json() as { code: number; data: { token: string } }
      expect(authenticated.code).toBe(1)
      const readDetail = async () => (await (await page.request.get(`${base}/kb.know/detail?id=${knowledgeId}`, { headers: { token: authenticated.data.token } })).json()) as { code: number; data: { power: number } }
      expect((await readDetail()).data.power).toBe(3)
      const rejected = await page.request.post(`${base}/kb.know/edit`, { headers: { token: authenticated.data.token }, data: { id: knowledgeId, name: '未授权修改' } })
      expect((await rejected.json() as { code: number }).code).not.toBe(1)
      await readerRow.getByRole('button', { name: '移出团队', exact: true }).click()
      await page.getByRole('dialog', { name: '确认删除？', exact: true }).getByRole('button', { name: '确认删除', exact: true }).click()
      await expect.poll(async () => (await readDetail()).code).not.toBe(1)
    } else {
      await members.getByRole('button', { name: '取消', exact: true }).click()
    }
    await panel.getByRole('button', { name: '知识库设置', exact: true }).click()
    await panel.getByRole('textbox', { name: '简介', exact: true }).fill('按原 QZOS 流程保存回读')
    expect(await panel.getByRole('combobox', { name: '向量模型', exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole('combobox', { name: '文件处理模型', exact: true }).isDisabled()).toBe(false)
    await panel.getByRole('button', { name: '保存设置', exact: true }).click()
    await expect.poll(async () => (await api(`/kb.know/detail?id=${knowledgeId}`)).intro).toBe('按原 QZOS 流程保存回读')
    await expect.poll(() => panel.getByRole('button', { name: '保存设置', exact: true }).isEnabled()).toBe(true)
    await screenshot('knowledge-settings')
    await page.setViewportSize({ width: 390, height: 844 })
    await screenshot('employee-narrow')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  } catch (error) {
    console.log('Visible errors:', await page.getByRole('alert').allTextContents())
    await page.locator('#qzos-login-account, #qzos-login-password').evaluateAll((inputs) => { for (const input of inputs) if (input instanceof HTMLInputElement) input.value = '' })
    await screenshot('failure'); throw new Error(error instanceof Error ? error.message.split('Call log:')[0] : 'Browser verification failed')
  } finally {
    releaseList?.()
    await page.unrouteAll({ behavior: 'wait' })
    // Only this test's newly created synthetic resources are removed.
    if (employeeId) await api('/kb.robot/del', { id: employeeId })
    if (knowledgeId) await api('/kb.know/del', { id: knowledgeId })
    if (linkedKnowledgeId) await api('/kb.know/del', { id: linkedKnowledgeId })
    await browser.close(); await scaffold.close(); await rm(world, { recursive: true, force: true })
  }
}, 300000)
