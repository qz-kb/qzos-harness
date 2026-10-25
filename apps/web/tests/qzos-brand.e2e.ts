/** Exercise QZOS alongside the shipped brand, including the official Desktop build profile. */
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold, watchConsole } from './scaffold.ts'

it('boots QZOS with the shipped brand and restores it when QZOS is removed', async () => {
  const scaffold = await launchWebScaffold()
  try {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ locale: 'zh-CN' })
      const console = watchConsole(page)
      // This composition check must never contact the existing local login test service.
      await page.route('http://127.0.0.1:3082/**', route => route.abort())
      await page.addInitScript(() => { sessionStorage.setItem('qzos.preview', '1') })
      await page.goto(scaffold.authenticatedUrl)
      const brand = page.locator('strong').filter({ hasText: /^QZOS$/ })
      await brand.waitFor()
      await page.getByRole('navigation').getByRole('button', { name: '知识库', exact: true }).waitFor()
      expect(console.pageErrors).toEqual([])
      const entry = [...scaffold.ctx.loader.entries()].find(item => item.options.name === '@deepseek-ai/dsh-client-ui-qzos')
      expect(entry).toBeDefined()
      entry!.parent.tree.remove(entry!.options.id)
      await brand.waitFor({ state: 'detached' })
      if (process.env.DSH_CLIENT_BUILD_PROFILE === 'official') {
        await page.locator('svg[viewBox="26 0 156 24"]').waitFor()
      }
      await scaffold.ctx.loader.create({ name: '@deepseek-ai/dsh-client-ui-qzos' })
      await brand.waitFor()
      expect(console.pageErrors).toEqual([])
    } finally { await browser.close() }
  } finally { await scaffold.close() }
})
