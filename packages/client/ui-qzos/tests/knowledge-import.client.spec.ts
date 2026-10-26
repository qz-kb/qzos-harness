// @vitest-environment jsdom
/** Import selection reflects server capabilities rather than a hard-coded extension list. */
import { expect, it } from 'vitest'
import { knowledgeImportOptions, acceptsKnowledgeFiles } from '../src/client/knowledge-import.ts'
it('advertises PNG, PDF and PPTX only when the backend enables them', () => {
  const options = knowledgeImportOptions({ methods: { '1': { mode: 'server' } }, file_contracts: { document: { selectable_extensions: ['.png', '.pdf', '.pptx'] } } }, 'docImport')
  expect(options.available).toBe(true)
  expect(acceptsKnowledgeFiles([new File(['a'], 'IMAGE.PNG'), new File(['b'], 'slides.pptx')], options.extensions, false)).toBe(true)
  expect(acceptsKnowledgeFiles([new File(['a'], 'bad.exe')], options.extensions, false)).toBe(false)
  expect(acceptsKnowledgeFiles([new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')], options.extensions, true)).toBe(false)
  expect(knowledgeImportOptions({}, 'docImport').available).toBe(false)
  expect(knowledgeImportOptions({ methods: { '2': { mode: 'browser', supports_server_preview: false } } }, 'qaSplit').available).toBe(false)
})
