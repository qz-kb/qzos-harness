/** Copy for the QZOS synthetic workspace; fixture content is owned separately. */
export const zh = {
  brand: 'QZOS', native: '工作窗口', home: '工作台', knowledge: '知识库', employees: '数字员工', connectors: '连接器', skills: '技能', templates: '模板', outputs: '成果',
  demo: '演示数据 · 未连接业务', welcome: '把想法交给你的数字团队', subtitle: '连接知识与工具，让每一项工作都有清晰的起点。',
  prompt: '今天想完成什么？', draft: '输入你的想法，或从下方模板开始…', send: '模拟发送', stop: '停止模拟', newChat: '新建模拟对话',
  recent: '最近对话', starter: '从一个好问题开始', resources: '你的工作资源', all: '全部', available: '可体验', search: '搜索名称或描述', empty: '没有匹配的内容', clear: '清除筛选',
  detail: '查看详情', back: '返回列表', use: '用于新对话', useTemplate: '填入工作台', select: '选择此知识库', selected: '已选择', preview: '预览',
  unavailable: '暂未接入', connectorAction: '授权连接暂未开放', skillAction: '安装与执行暂未开放', upload: '上传暂未开放', publish: '发布暂未开放', download: '下载暂未开放',
  scope: '适用范围', includes: '内容预览', employee: '当前员工', kb: '当前知识库', next: '选择仅影响新对话，已有消息保持原归属',
  running: '正在演示处理过程…', done: '模拟已完成', stopped: '模拟已停止', failed: '模拟失败，可重试', retry: '重试模拟', answer: '这是一条模拟回复。正式接入后，这里将展示基于授权资料的回答、来源和成果。当前没有检索、模型调用或业务写入。',
  noHistory: '还没有模拟对话', result: '关联成果', origin: '返回关联对话', synthetic: '合成示例', saved: '当前草稿已保留',
  knowledgeDesc: '让团队知识成为每一次回答的依据。', employeesDesc: '为不同工作选择合适的数字伙伴。', connectorsDesc: '把常用工具连接到工作中。', skillsDesc: '让员工拥有可复用的专业能力。', templatesDesc: '从经过整理的工作方法开始。', outputsDesc: '回看对话中产生的文档与成果。',
  ready: '示例就绪', pending: '待接入', error: '示例异常', loading: '示例准备中', disabledHint: '本轮仅预览，不会提交资料、授权或执行任务',
  debug: '开发状态预览', normal: '正常', loadingState: '加载', errorState: '失败', emptyState: '空列表', reset: '恢复示例', loadingHint: '正在加载示例内容', errorHint: '示例内容暂时无法加载', count: '项资源',
} satisfies Record<string, string>
export type QzosKey = keyof typeof zh
export const en: Record<QzosKey, string> = {
  brand: 'QZOS', native: 'Work window', home: 'Workbench', knowledge: 'Knowledge', employees: 'Digital employees', connectors: 'Connectors', skills: 'Skills', templates: 'Templates', outputs: 'Deliverables',
  demo: 'Demo data · Business disconnected', welcome: 'Work with your digital team', subtitle: 'Bring knowledge and tools together. Give every task a clear starting point.',
  prompt: 'What would you like to do today?', draft: 'Describe an idea, or start with a template…', send: 'Simulate send', stop: 'Stop simulation', newChat: 'New demo conversation',
  recent: 'Recent conversations', starter: 'Start with a good question', resources: 'Your resources', all: 'All', available: 'Preview available', search: 'Search names or descriptions', empty: 'No matching items', clear: 'Clear filters',
  detail: 'View details', back: 'Back to list', use: 'Use in a new conversation', useTemplate: 'Fill workbench draft', select: 'Select knowledge base', selected: 'Selected', preview: 'Preview',
  unavailable: 'Not connected', connectorAction: 'Authorization is not available yet', skillAction: 'Installation and execution are not available yet', upload: 'Upload unavailable', publish: 'Publish unavailable', download: 'Download unavailable',
  scope: 'Scope', includes: 'Content preview', employee: 'Current employee', kb: 'Current knowledge', next: 'Selections apply to new conversations; existing messages keep their original owner',
  running: 'Simulating progress…', done: 'Simulation complete', stopped: 'Simulation stopped', failed: 'Simulation failed; retry available', retry: 'Retry simulation', answer: 'This is a simulated response. Once connected, this area will show answers, sources and deliverables based on authorized material. No search, model call or business write occurred.',
  noHistory: 'No demo conversations yet', result: 'Related deliverable', origin: 'Return to conversation', synthetic: 'Synthetic example', saved: 'Draft retained',
  knowledgeDesc: 'Give every answer a foundation in team knowledge.', employeesDesc: 'Find the right digital partner for each kind of work.', connectorsDesc: 'Bring your everyday tools into your work.', skillsDesc: 'Equip employees with reusable specialist capabilities.', templatesDesc: 'Start with a structured way of working.', outputsDesc: 'Revisit documents and deliverables from your conversations.',
  ready: 'Preview ready', pending: 'Not connected', error: 'Example error', loading: 'Preparing example', disabledHint: 'Preview only; no upload, authorization or task execution',
  debug: 'Development state preview', normal: 'Normal', loadingState: 'Loading', errorState: 'Error', emptyState: 'Empty list', reset: 'Restore examples', loadingHint: 'Loading example content', errorHint: 'Example content could not be loaded', count: 'resources',
}
