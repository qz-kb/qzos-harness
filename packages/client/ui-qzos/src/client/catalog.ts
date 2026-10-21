/** Synthetic content only; IDs do not address QZOS business entities. */
export type CatalogId = 'knowledge' | 'employees' | 'connectors' | 'skills' | 'templates' | 'outputs'
export type Panel = 'home' | CatalogId
export interface Example {
  id: string
  title: string
  description: string
  category: string
  status: 'ready' | 'pending' | 'error' | 'loading'
  content: string
}
export const catalogs: Record<CatalogId, readonly Example[]> = {
  knowledge: [
    { id: 'kb-team', title: '团队知识库', description: '团队制度、工作规范与常见问题，让新同事更快进入状态。', category: '团队共享', status: 'ready', content: '员工手册.md\n入职指引.md\n协作规范.md\n\n示例：入职第一周完成账号准备、团队介绍与知识学习。' },
    { id: 'kb-product', title: '产品与客户洞察', description: '整理产品说明、用户反馈和调研笔记，形成共同认知。', category: '产品研发', status: 'loading', content: '产品说明.pdf · 示例准备中\n客户访谈.md · 示例就绪' },
    { id: 'kb-project', title: '项目复盘资料', description: '沉淀项目经验，回看决策与行动。', category: '项目协作', status: 'error', content: '季度复盘.pdf · 示例解析异常\n本轮不会上传或重新解析文件。' },
  ],
  employees: [
    { id: 'employee-assistant', title: '知识助手', description: '梳理问题，查找团队知识，给出有依据的回答。', category: '知识问答', status: 'ready', content: '擅长：知识整理、问题拆解、来源引用\n示例知识：团队知识库\n仅为业务员工展示，不创建或替换 DSH Preset。' },
    { id: 'employee-writer', title: '内容编辑', description: '从零散想法到结构清晰的方案、总结与对外文案。', category: '内容创作', status: 'ready', content: '擅长：结构规划、内容润色、表达检查\n示例技能：文档写作、内容校对' },
    { id: 'employee-analyst', title: '研究分析员', description: '比较信息、提炼洞察，为下一步决策提供参考。', category: '研究分析', status: 'pending', content: '擅长：资料对比、研究摘要\n该员工为待接入示例，暂不可用于模拟对话。' },
  ],
  connectors: [
    { id: 'connector-drive', title: '团队文档', description: '从已有文档空间获取工作资料。', category: '文件与资料', status: 'pending', content: '拟接入能力：按授权范围读取文档\n本轮不收集账号、密钥或凭据。' },
    { id: 'connector-github', title: 'GitHub', description: '关联代码、Issue 与项目进展。', category: '研发协作', status: 'pending', content: '拟接入能力：仓库与 Issue 查询\n实际授权范围将在接入时确定。' },
    { id: 'connector-calendar', title: '日历', description: '把日程与工作计划放在同一视野中。', category: '日常办公', status: 'pending', content: '拟接入能力：日程查询\n尚未请求或保存任何外部授权。' },
  ],
  skills: [
    { id: 'skill-writing', title: '文档写作', description: '将目标、背景与要点整理成可阅读的文档。', category: '内容创作', status: 'ready', content: '输入：目标、读者、关键要点\n输出：结构化文档\n这里只预览能力说明，不安装或执行技能。' },
    { id: 'skill-research', title: '资料分析', description: '从多份资料中提取共同点、差异与待确认项。', category: '研究分析', status: 'ready', content: '输入：资料与问题\n输出：对比摘要、来源清单\n检索与分析尚未接入。' },
    { id: 'skill-slides', title: '演示文稿', description: '把复杂内容整理成有层次的演示结构。', category: '日常办公', status: 'pending', content: '输入：主题、受众、材料\n输出：演示大纲\n本轮不会生成实际文件。' },
  ],
  templates: [
    { id: 'template-weekly', title: '一周工作总结', description: '整理进展、问题和下周安排。', category: '日常办公', status: 'ready', content: '请帮我整理本周工作总结，按已完成、遇到的问题、下周计划组织。以下是我的记录：\n' },
    { id: 'template-research', title: '专题研究', description: '围绕一个问题形成结构化的研究提纲。', category: '研究分析', status: 'ready', content: '请围绕以下主题，整理研究问题、资料来源和待验证假设：\n' },
    { id: 'template-onboarding', title: '新同事入职指南', description: '将团队知识转成易于执行的入职安排。', category: '团队共享', status: 'ready', content: '请根据团队知识库，为新同事拟定第一周入职指南，标注待确认事项：\n' },
  ],
  outputs: [
    { id: 'output-weekly', title: '团队周报 · 示例', description: '来自示例对话的结构化工作总结。', category: '文档', status: 'ready', content: '# 团队周报\n\n本周进展\n完成知识目录梳理，明确下一轮界面范围。\n\n下周计划\n体验模拟流程，收集界面反馈。\n\n这是合成示例，不代表实际项目成果。' },
  ],
}
export const panels: readonly Panel[] = ['home', 'knowledge', 'employees', 'connectors', 'skills', 'templates', 'outputs']
