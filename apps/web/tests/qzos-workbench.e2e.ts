/** QZOS synthetic flows inside the shipped Web composition. */
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold, watchConsole } from './scaffold.ts'

it('browses QZOS catalogs and keeps demo drafts and employee ownership isolated', async () => {
  const scaffold = await launchWebScaffold({ extraOverlayPath: fileURLToPath(new URL('./pin-browse-picker.overlay.yml', import.meta.url)) })
  try {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
      const console = watchConsole(page)
      await page.addInitScript(() => { window.sessionStorage.setItem('qzos.preview', '1') })
      await page.goto(scaffold.authenticatedUrl)
      const panel = page.locator('[data-qzos-panel]')
      await page.locator('[data-qzos-panel="home"]').waitFor()
      const navigate = async (name: string) => { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click() }
      expect(await panel.getByText('演示数据 · 未连接业务', { exact: true }).count()).toBeGreaterThan(0)
      await panel.getByRole('textbox', { name: '今天想完成什么？' }).fill('保留我的模拟草稿')
      for (const name of ['知识库', '数字员工', '连接器', '技能', '模板', '成果']) {
        await navigate(name)
        await panel.getByRole('heading', { name, exact: true }).waitFor()
      }
      await navigate('工作台')
      expect(await panel.getByRole('textbox', { name: '今天想完成什么？' }).inputValue()).toBe('保留我的模拟草稿')
      await navigate('知识库')
      await panel.getByRole('textbox', { name: '搜索名称或描述' }).fill('不会匹配')
      await panel.getByText('没有匹配的内容', { exact: true }).waitFor()
      await panel.getByRole('button', { name: '清除筛选' }).click()
      await panel.getByRole('button', { name: '查看详情 · 团队知识库', exact: true }).click()
      expect(await panel.getByRole('button', { name: '上传暂未开放' }).isDisabled()).toBe(true)
      await panel.getByRole('button', { name: '选择此知识库' }).click()
      await navigate('模板')
      await panel.getByRole('button', { name: '查看详情 · 一周工作总结', exact: true }).click()
      await panel.getByRole('button', { name: '填入工作台' }).click()
      expect(await panel.getByRole('textbox', { name: '今天想完成什么？' }).inputValue()).toContain('本周工作总结')
      await panel.getByRole('button', { name: '模拟发送', exact: true }).click()
      await panel.getByRole('button', { name: '停止模拟', exact: true }).click()
      await panel.getByRole('button', { name: '重试模拟', exact: true }).click()
      await panel.getByText('这是一条模拟回复。', { exact: false }).waitFor()
      await navigate('数字员工')
      await panel.getByRole('button', { name: '查看详情 · 内容编辑', exact: true }).click()
      await panel.getByRole('button', { name: '用于新对话' }).click()
      await panel.getByRole('button', { name: '当前员工 · 内容编辑', exact: true }).waitFor()
      await panel.getByRole('button', { name: /请帮我整理本周工作总结/ }).click()
      await panel.getByRole('button', { name: '当前员工 · 知识助手', exact: true }).waitFor()
      // Failure is explicit and retryable; the preview never invokes a model.
      await panel.getByText('开发状态预览', { exact: true }).click()
      await panel.getByRole('checkbox').check()
      await panel.getByRole('textbox', { name: '今天想完成什么？' }).fill('失败演示')
      await panel.getByRole('button', { name: '模拟发送', exact: true }).click()
      await panel.getByRole('button', { name: '重试模拟', exact: true }).waitFor()
      await panel.getByRole('button', { name: '重试模拟', exact: true }).click()
      await panel.getByText('这是一条模拟回复。', { exact: false }).waitFor()
      await navigate('知识库')
      await panel.getByRole('button', { name: '返回列表', exact: true }).click()
      await panel.getByText('开发状态预览', { exact: true }).click()
      await panel.getByRole('button', { name: '加载', exact: true }).click()
      await panel.getByText('正在加载示例内容', { exact: true }).waitFor()
      await panel.getByRole('button', { name: '失败', exact: true }).click()
      await panel.getByRole('button', { name: '恢复示例', exact: true }).click()
      await panel.getByRole('button', { name: '空列表', exact: true }).click()
      await panel.getByRole('button', { name: '清除筛选', exact: true }).click()
      await navigate('连接器')
      await panel.getByRole('button', { name: '查看详情 · GitHub', exact: true }).click()
      expect(await panel.getByRole('button', { name: '授权连接暂未开放' }).isDisabled()).toBe(true)
      await navigate('成果')
      await panel.getByRole('button', { name: '查看详情 · 团队周报 · 示例', exact: true }).click()
      await panel.getByRole('button', { name: '返回关联对话' }).click()
      await panel.getByRole('heading', { name: '整理团队一周工作总结', exact: true }).waitFor()
      const labels = await page.getByRole('navigation').getByRole('button').allTextContents()
      expect(labels.slice(0, 7)).toMatchInlineSnapshot(`
        [
          "工作台",
          "知识库",
          "数字员工",
          "连接器",
          "技能",
          "模板",
          "成果",
        ]
      `)
      const screenshots = process.env.QZOS_UI_SCREENSHOTS
      if (screenshots) {
        await mkdir(screenshots, { recursive: true })
        await panel.getByRole('button', { name: '新建模拟对话', exact: true }).click()
        await page.screenshot({ path: `${screenshots}/qzos-workbench.png` })
        await navigate('数字员工')
        await panel.getByRole('button', { name: '返回列表', exact: true }).click()
        await page.screenshot({ path: `${screenshots}/qzos-employees.png` })
      }
      await page.setViewportSize({ width: 520, height: 850 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await panel.getByRole('button', { name: '查看详情 · 知识助手', exact: true }).click()
      await panel.getByRole('button', { name: '用于新对话' }).click()
      await panel.getByRole('textbox', { name: '今天想完成什么？' }).fill('窄窗口模拟')
      await panel.getByRole('button', { name: '模拟发送', exact: true }).click()
      await panel.getByText('这是一条模拟回复。', { exact: false }).waitFor()
      if (screenshots) await page.screenshot({ path: `${screenshots}/qzos-narrow.png` })
      expect(console.pageErrors).toEqual([])
      expect(console.warnings).toEqual([])
      // Removing the contribution restores the upstream surface without fake Sessions.
      const entry = [...scaffold.ctx.loader.entries()].find(item => item.options.name === '@deepseek-ai/dsh-client-ui-qzos')
      expect(entry).toBeDefined()
      entry!.parent.tree.remove(entry!.options.id)
      await panel.waitFor({ state: 'detached' })
      expect(await page.getByRole('navigation').getByRole('button', { name: '知识库', exact: true }).count()).toBe(0)
      await scaffold.ctx.loader.create({ name: '@deepseek-ai/dsh-client-ui-qzos' })
      await page.locator('[data-qzos-panel="home"]').waitFor()
      expect(await panel.getByRole('textbox', { name: '今天想完成什么？' }).inputValue()).toBe('')
    } finally { await browser.close() }
  } finally { await scaffold.close() }
})
