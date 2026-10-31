import { afterEach, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { installKnowledgeMentions } from '../src/client/knowledge-mentions.ts'

function fixture() {
  const registerSource = vi.fn()
  const ctx = {
    effect: vi.fn((effect: () => unknown) => { effect(); return () => {} }),
    inputTriggers: { registerSource },
  } as unknown as Context
  return { ctx, registerSource }
}

afterEach(() => {
  delete (globalThis as { __QZOS_KNOWLEDGE_SEARCH__?: boolean }).__QZOS_KNOWLEDGE_SEARCH__
})

it('does not expose @knowledge until the Host enables knowledge search', () => {
  (globalThis as { __QZOS_KNOWLEDGE_SEARCH__?: boolean }).__QZOS_KNOWLEDGE_SEARCH__ = false
  const test = fixture()
  installKnowledgeMentions(test.ctx, key => key)
  expect(test.ctx.effect).not.toHaveBeenCalled()
  expect(test.registerSource).not.toHaveBeenCalled()
})

it('registers @knowledge when the Host enables knowledge search', () => {
  (globalThis as { __QZOS_KNOWLEDGE_SEARCH__?: boolean }).__QZOS_KNOWLEDGE_SEARCH__ = true
  const test = fixture()
  installKnowledgeMentions(test.ctx, key => key)
  expect(test.registerSource).toHaveBeenCalledOnce()
  expect(test.registerSource.mock.calls[0]?.[0]).toMatchObject({ name: 'qzos-knowledge', trigger: '@' })
})
