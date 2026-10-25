---
kind: upgrade-guide
description: "QZOS 知识检索要求启用私有签名执行适配器。"
---
# QZOS 知识检索回执

[English](guide.md) | 中文

## 变更

QZOS 私有员工插件不再调用无签名的知识搜索测试接口。关联知识库的员工必须启用已有 `execution.secretEnv` 适配。原生 DSH 模型路由和 Session 格式不变。

## 迁移

1. 更新匹配的 QZOS Server 候选并执行 `php think dsh:migrate`，准备检索回执与导入来源元数据。
2. 在 QZOS Host overlay 配置 `execution: { secretEnv: QZOS_DSH_BRIDGE_SECRET }`。沿现有账号绑定向 Server 与该用户的 Host 提供相同密钥，不写入浏览器配置。
3. 保持 `QZOS_DSH_MODEL_MAP` 与所选工作窗口 provider/model 对应。发送一条合成员工问题，确认 `kb.dsh/retrieve` 成功、实际检索用量只记账一次且回答保留知识引用。
