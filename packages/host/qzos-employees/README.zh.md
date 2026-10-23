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

每个模型步骤前校验当前账号及员工可用性；有新用户输入时经授权检索知识，将允许的角色与片段通过 `agent/pre-step` 写入普通消息记录。DSH 保持执行与结果存储。未指定归属的本机预览中，账号切换取消上一账号的员工任务；Host 重启后需通过重新校验浏览器保存的业务会话或重新登录来恢复授权。移除时需同时移除本插件和对应浏览器接入。

部署网关管理登录时，同时设置 `managedGateway: true` 与 `ownerUserId`。Host 仅向私有浏览器 UI 注入指定用户 ID，不注入业务令牌；UI 使用网关 Cookie 与相对业务路径。网关须将认证请求绑定到该 Host，并在退出时撤销原生访问及实时连接。此配置本身不创建网关。

专用 Host 可配置 `ownerUserId`，值为所选后端返回的用户 ID。授权及绑定遇到不同的后端认证 ID 时返回 HTTP 403 与 `QZOS_HOST_ACCOUNT_MISMATCH`，不替换当前凭据。`qzos_host_owner` 存储域保存账号与完整 API URL；改动任一值或移除归属配置都会拒绝插件加载。已有其他账号的员工绑定也会拒绝加载。省略配置保留未指定归属的本机预览，不表示多用户部署。账号归属由部署配置指定，不接受浏览器声明或首次登录抢占。

每个指定用户使用全新的 Host 数据目录。不能直接给混合历史指定归属：本插件无法判断未绑定原生 Session 的所有者，迁移需要明确归属决策。原生认证、凭据、持久化、附件、存储、工作区及执行环境均须独立。仅分开 `DSH_HOME` 不能限制 shell 命令或绝对路径读取；须采用独立系统身份或不挂载其他用户数据的容器，将已认证用户仅路由至其 Host，并保护配置不被租户修改。原生 Host owner 凭据不可跨用户共享。业务退出仅撤销员工执行，不撤销原生 DSH Cookie 或原生文件／历史访问。

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

- 账号归属可阻止专用 Host 切换业务账号，但不提供登录路由、原生退出、操作系统执行隔离或数据迁移。共享 Host 仍会向所有持有原生 owner 凭据的用户暴露原生文件、工具及历史。不恢复 PHP 聊天运行时，不映射 QZOS 额度／统计，不支持员工外部工作流。检索失败拒绝执行。上下文增加输入 token，不修改模型请求或缓存布局。

定向测试使用真实 HTTP 和存储域服务、合成上游响应，覆盖认证拒绝、绑定重载、逐轮检索、暂停员工、切换账号和退出。本机浏览器已验证 QZOS 检索与阿里云模型的真实知识回答、逐轮检索追问；还已验证 Host 重启后保存的业务会话重新校验、历史回读及不重新选择员工的追问检索。多个本机预览标签并存时可能出现恢复等待，重启时复用已有标签；结果沿 Product 原任务记录。

检索消息使用 `qzos-employee-context` 来源和 `snapshot` 形式；原生聊天隐藏此上下文，模型历史与 Session 记录保留，回答继续引用知识库编号。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>本机接入</summary>

实际验证结果沿 Product 原任务维护。

</details>
