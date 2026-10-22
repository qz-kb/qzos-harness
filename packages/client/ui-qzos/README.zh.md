---
description: "DSH 的私有 QZOS 知识库页面与本机业务登录。"
kind: "package-reference"
---

# QZOS 资源页面预览

[English](README.md) | 中文

## 概述

这个私有浏览器插件为 DSH 增加知识库、数字员工、连接器、技能和模板。原生工作窗口仍是默认入口，承载所有会话；工作台和成果页已移除。

## 目录

- [使用方式](#use-this-package)
- [模型影响](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用方式

Web bundle 挂载 `ui-qzos`，移除这一行即可恢复上游呈现。按根目录 `.node-version` 使用 Node，执行 `pnpm run dev:web --patch apps/web/tests/pin-browse-picker.overlay.yml --port 3081`；启动器参数须放在 Web 参数之前。

知识库和员工页面依据现有 QZOS 客户端的 `qzos-pc/src/pages/application/layout/{kb,robot}.vue`、`application/kb/detail/`、`application/robot/setting.vue` 及其子视图还原。封面卡片、成员入口、员工头像与更多菜单、详情侧栏、新建字段和配置分组沿这些原页面；中文原文归语言字典，发布图标复用 QZOS 原资产。连接器、技能、模板继续沿 DSH 插件／自动化任务页面风格。

知识库页面通过原生 `useResource` 读取本机 QZOS 列表、配置、资料、分段和成员，新增／修改／删除、重命名、分段操作、成员授权／移交与检索沿原接口。写入成功后回读，失败保留表单并显示后端原因；不再生成模拟资料或检索结果。业务身份切换会卸载知识库页面并隔离资源地址，令牌只进入本机 API 请求头。模型选项取自 `/index/models`，保持后端 readiness 限制。员工及其他资源继续使用原模拟状态，刷新清空。交互设施复用 DSH 原生弹窗、菜单和控件。

员工入口回到原生输入框并插入 `@员工`，不自动发送或替换草稿。新增和编辑后的模拟员工同步到候选菜单，保留部分名称／职责匹配、原文件／对话引用及重复选择去重。含模拟员工引用的执行会显示尚未接入说明，移除引用可继续原生 DSH 发送。只有一个工作区时可准备其空白会话，否则先选择工作区。

<a id="model-experience"></a>
## 模型影响

### 业务操作

#### 模型看到的内容

`ui-qzos` 不增加 DSH 系统提示词或工具定义。知识库学习和检索委托现有业务后端，数字员工引用在接入前不能执行。

#### Token 影响

用户主动发起学习和检索时可能消耗 QZOS 模型额度；列表、登录和权限操作不增加 DSH 模型 Token。

#### KV 缓存影响

插件不构造 DSH 模型请求，也不改变其缓存结构。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 知识库由 QZOS 后端复核权限，数字员工业务接入留待后续。连接器授权、技能安装和模板应用尚未开放。覆盖桌面 Web 和窄窗口，Electron 未验证。

当前账号接入仅指向本机 `qzos-login-test` 环境。找回密码、生产端点配置、短信／邮件送达和微信服务商验证不在已验证范围。本轮是业务登录，不是 DSH 文件、会话或工具的多用户隔离。

私有插件通过原生 shell overlay 挂载全屏登录／注册页，未登录时先显示该页；左侧不增加账号模块。登录后进入工作界面，退出或经服务端确认的过期回到登录页。此展示不新增 DSH Host 的多用户授权能力。

本机知识库验证环境包含独立 PostgreSQL、原安装结构及 ACL／版本迁移，保留合成知识库供页面查看。尚无可用模型凭据，新增／修改库及学习／检索未完成成功路径验证；未启用服务端解析，文件导入与新版本更新会提示前置缺失，不回退到前端算法。文件权限弹窗现已接入规则查询、主体候选和增改停用；沿服务端软删除契约保留停用记录。对外服务开关使用 `/kb.publish/knowledgeExternal`，开启前确认，保存后回读；只改开关不要求模型就绪。本机合成资料的规则增改停用、所有者规则保留、开关开启关闭回读及未登录拒绝已验证。Python 解析源码可复用，但当前隔离容器未安装 Python／PDF／OCR 依赖，私有上传与服务端解析尚未启用。

固定本机启动入口：工作区 `scripts/start-dsh-ui.sh` 转发到本插件跟踪的 `scripts/start-local.sh`。也可在仓库根目录执行 `bash packages/client/ui-qzos/scripts/start-local.sh`。脚本读取 `.node-version`，使用工作区 `.local/toolchains/node-v<版本>/bin`（需包含 Node 可执行文件和 `include/node` 开发头文件），沿官方 `dev:web` 先构建再启动，监听后续修改；构建失败停止，端口占用明确提示，不杀其他进程。默认地址为本机 3081，按启动输出完成原 Host 认证。首次使用其他机器需准备对应 Node 发行包、pnpm、项目依赖和本机 QZOS 后端；运行环境、测试账号与密钥不入库。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>本机接入上下文</summary>

插件负责业务传输与原生资源注册。凭据及本机运行状态不进入 Git；实际验证与模型、解析配置缺项记录在 Product 原任务中。

</details>
