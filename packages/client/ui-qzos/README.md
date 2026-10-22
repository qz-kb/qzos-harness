---
description: "Private QZOS knowledge UI and local business login for DSH."
kind: "package-reference"
---

# QZOS resource page preview

English | [中文](README.zh.md)

## Summary

This private browser plugin adds knowledge, digital employees, connectors, skills and templates to DSH. The native work window remains the default entry and owns every conversation. Workbench and deliverable pages are removed.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

The Web bundle mounts `ui-qzos`. Removing the row restores the upstream presentation. Run `pnpm run dev:web --patch apps/web/tests/pin-browse-picker.overlay.yml --port 3081` with the root `.node-version`; keep launcher options before Web options.

Knowledge and employee presentation follows the existing QZOS client: `qzos-pc/src/pages/application/layout/{kb,robot}.vue`, `application/kb/detail/`, and `application/robot/setting.vue` with its child views. Cover cards, member entry, employee avatars and menus, detail sidebars, creation fields and grouped configuration follow those sources. Chinese source labels are retained in locale dictionaries. Publication artwork comes from the existing QZOS assets. Connectors, skills and templates keep the native Plugins/Automation tasks page style.

Knowledge pages read the local QZOS catalog, configuration, documents, fragments and members through native `useResource`. Management, rename, fragment operations, membership, transfer and search use existing endpoints. Successful writes reload server state; failures retain the form and report the backend reason. No synthetic documents or search hits are generated. Identity changes unmount knowledge views and isolate resource addresses; credentials only enter local API headers. Model options come from `/index/models` and respect backend readiness. Employees and other catalogs retain their browser-only previews. Native DSH modals, menus and controls own the interaction machinery.

Employee entry returns to the native composer and inserts `@employee` without sending or replacing the draft. New and edited preview employees update that menu. Partial-name/role matching, original file/Session references and duplicate prevention remain. Preview employee references refuse execution with an explanation; removing them restores ordinary DSH submission. A sole Workspace may prepare its blank Session; otherwise select a Workspace first.

## Model Experience

### Business actions

#### What the model sees

The `ui-qzos` browser plugin adds no DSH system prompt or tool schema. QZOS knowledge learning and search delegate to the existing business backend; employee references remain blocked from execution until integration is implemented.

#### Token effect

User-requested learning and search may consume the configured QZOS model quota; listing, login and ACL operations add no DSH model tokens.

#### KV Cache effect

The plugin does not construct DSH provider requests or change their cache layout.

## Known Limitations and Deferred Work

- QZOS validates knowledge permissions. Employee business integration remains deferred. Connector authorization, skill installation and template application remain unavailable. Desktop Web and narrow layouts are covered; Electron is not validated.

The current account integration targets the local `qzos-login-test` environment only. Password recovery, production endpoint configuration, SMS/email delivery and WeChat provider verification are not included in the verified scope. This is business sign-in, not multi-user isolation for DSH files, conversations or tools.

The private plugin mounts the full-screen login/register surface through the native shell overlay. Signed-out users see it before the work interface; there is no QZOS account sidebar module. Sign-in closes it, sign-out or verified session expiry brings it back. This presentation does not add multi-user authorization to the DSH Host.

The local knowledge environment includes isolated PostgreSQL, original installation schemas and ACL/version migrations, plus a synthetic knowledge fixture. Usable model credentials remain absent, so successful creation/editing and learning/search are unverified. Server parsing is disabled: document import/version updates explain the missing prerequisite instead of adding browser algorithms.

File ACL now uses the existing rules/subjects/add/edit/del endpoints inside the native modal. Deletion disables rules, preserving backend history. The knowledge external-use switch uses `/kb.publish/knowledgeExternal`, confirms enablement and reads back state; switch-only saves do not require a ready model. Synthetic local API checks cover rule creation/edit/disable, owner preservation, switch round trips and anonymous rejection. Models remain unready; Python/PDF/OCR executables, private upload and server parsing are not enabled in the isolated runtime.

Fixed local startup: workspace `scripts/start-dsh-ui.sh` forwards to the tracked plugin script `scripts/start-local.sh`. From the repository root, run `bash packages/client/ui-qzos/scripts/start-local.sh`. It reads `.node-version`, uses workspace `.local/toolchains/node-v<version>/bin` (Node plus `include/node` development headers), then delegates fresh builds and watching to upstream `dev:web`. Build failures stop startup; occupied ports fail explicitly without killing other processes. The local port is 3081; follow the launch output for Host authentication. Another machine needs the matching Node distribution, pnpm, installed dependencies and a local QZOS backend. Runtime files, test accounts and credentials are not committed.

### Dev Note

<details>
<summary>Local integration context</summary>

The plugin owns business transport and native resource registration. Credentials and local runtime state stay outside Git. The original Product task records verification and remaining model/parser setup.

</details>
