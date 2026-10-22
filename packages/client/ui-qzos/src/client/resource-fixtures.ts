/** Synthetic resource records used only by the QZOS page reproduction. */
export interface PreviewRow {
  id: string
  name: string
  [key: string]: string
}
export const documentExamples: PreviewRow[] = [
  { id: 'manual', name: '手动录入', waiting: '0', trained: '2', totalData: '2', createdAt: '2026-10-20 10:00', status: 'ready' },
  { id: 'handbook', name: '员工手册.pdf', waiting: '0', trained: '8', totalData: '8', createdAt: '2026-10-20 10:15', status: 'ready' },
  { id: 'guide', name: '入职指引.docx', waiting: '3', trained: '0', totalData: '3', createdAt: '2026-10-20 10:30', status: 'processing' },
]
export const fragmentExamples: PreviewRow[] = [
  { id: 'fragment-1', name: '入职第一周需要完成哪些事项？', question: '入职第一周需要完成哪些事项？', answer: '完成账号准备、团队介绍与知识学习。', status: 'learned', consumed: '128', updatedAt: '2026-10-20 10:15' },
  { id: 'fragment-2', name: '如何提交工作总结？', question: '如何提交工作总结？', answer: '按已完成、遇到的问题、下周计划组织。', status: 'learned', consumed: '96', updatedAt: '2026-10-20 10:15' },
]
export const memberExamples: PreviewRow[] = [
  { id: 'self', name: '我', nickname: '我', role: 'owner', power: 'all' },
  { id: 'member-1', name: '示例成员', nickname: '示例成员', role: 'member', power: 'view' },
]
export const dialogueExamples: PreviewRow[] = [
  { id: 'record-1', name: '入职第一周需要完成哪些事项？', userInfo: '演示用户', question: '入职第一周需要完成哪些事项？', answer: '完成账号准备、团队介绍与知识学习。', feedback: '', questionTime: '2026-10-20 10:30', reviewed: '0' },
]
