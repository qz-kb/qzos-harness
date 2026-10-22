---
description: "私有 QZOS 员工授权与逐轮知识上下文。"
kind: "package-reference"
---
# QZOS 员工 Host 适配

[English](README.md) | 中文

## 概述

为原生员工 Session 提供私有 QZOS 授权与知识检索。

## 目录

- [契约](#contract)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="contract"></a>
## 契约

Web 组合与 ui-qzos 一起加载本私有插件。`apiUrl` 指定本机 QZOS API，`requestTimeoutMs` 限制单次业务请求。POST `/qzos/employees` 沿原连接认证，支持 authorize、logout、bind。令牌仅存内存；`qzos_employees` 存储域按原生 Session ID 持久保存不可改绑的账号、员工与后端归属。原生分叉继承绑定。

每个模型步骤前校验当前账号及员工可用性；有新用户输入时经授权检索知识，将允许的角色与片段通过 `agent/pre-step` 写入普通消息记录。DSH 保持执行与结果存储。账号切换取消上一账号的员工任务；Host 重启后需通过重新校验浏览器保存的业务会话或重新登录来恢复授权。移除时需同时移除本插件和对应浏览器接入。

<a id="model-experience"></a>
## 模型体验

### 员工知识

#### 模型看到什么

每轮新用户输入获得包含 `employeeId`、`name`、`role` 和授权 `sources` 的已记录上下文消息，不包含凭据及工作流配置。

#### Token 影响

角色与检索片段增加输入 token；检索使用配置的 QZOS 向量模型。

#### KV Cache 影响

插件不改变模型请求或缓存布局。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 仅支持一个本机 Host 活跃业务账号，不隔离不同业务用户的 DSH 文件、工具或历史。不恢复 PHP 聊天运行时，不映射 QZOS 额度／统计，不支持员工外部工作流。检索失败拒绝执行。上下文增加输入 token，不修改模型请求或缓存布局。

定向测试使用真实 HTTP 和存储域服务、合成上游响应，覆盖认证拒绝、绑定重载、逐轮检索、暂停员工、切换账号和退出。本机浏览器已验证 QZOS 检索与阿里云模型的真实知识回答、逐轮检索追问；还已验证 Host 重启后保存的业务会话重新校验、历史回读及不重新选择员工的追问检索。多个本机预览标签并存时可能出现恢复等待，重启时复用已有标签；结果沿 Product 原任务记录。

检索消息使用 `qzos-employee-context` 来源和 `snapshot` 形式；原生聊天隐藏此上下文，模型历史与 Session 记录保留，回答继续引用知识库编号。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>本机接入</summary>

实际验证结果沿 Product 原任务维护。

</details>
