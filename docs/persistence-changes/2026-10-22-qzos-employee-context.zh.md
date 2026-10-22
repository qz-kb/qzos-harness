---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-22-qzos-employee-context

[English](2026-10-22-qzos-employee-context.md) | 中文

## 概述

新增私有 qzos-employee-context 消息来源，标记已记录的员工检索上下文。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-22-qzos-employee-context
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-13-user-rpc-principal"
    after: "731be31151ce4f582480e3a70065a2e571f271ddab7f45c2fe6b6ea6335d040c"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-13-user-rpc-principal"
    after: "d9aa9c98d4b2f8832acd908324910d55434c70da3dfe1781d0ba6081637e3071"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-13-user-rpc-principal"
    after: "57c7e7db2f71d14fe57dabad0a29179f44ef81c47b91bd78c47cf9d63d1f083f"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-13-user-rpc-principal"
    after: "6f6adb773b9aabf3520c88933903e8e22256fe755ee067fa92648738d9b6b95a"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有来源选项与 Session 版本不变。新 kind 仅携带来源与 snapshot 展示信息，不承载授权或必需回放行为。已有读取方保留未知消息来源及正文，原生聊天将非 user 来源归为上下文。新读取方仍保留旧 user 来源消息，ui-qzos 仅隐藏匹配的旧展示行。模型正文和回答引用不变。

<a id="verification"></a>
## 验证

私有 Host 绑定 HTTP 测试通过，覆盖来源标记与原用户输入保持不变。Host 重启和刷新后的浏览器验证保留历史提问与引用、隐藏旧 JSON 和新上下文，并完成一次新检索回答。Host 与 client aggregate TypeScript 检查通过。

<a id="dev-note"></a>
## 开发备注

无。
