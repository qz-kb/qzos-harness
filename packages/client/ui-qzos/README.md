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

Knowledge pages read the local QZOS catalog, configuration, documents, fragments and members through native `useResource`. Management, rename, fragment operations, membership, transfer and search use existing endpoints. Successful writes reload server state; failures retain the form and report the backend reason. No synthetic documents or search hits are generated. Identity changes unmount knowledge views and isolate resource addresses; credentials only enter local API headers. Model options come from `/index/models` and respect backend readiness. Employee management now uses local QZOS APIs; connectors, skills and templates retain their previews. Native DSH modals, menus and controls own the interaction machinery.

Employee entry creates a fresh native Session, names it for the employee and inserts `@employee` without sending. Selecting an employee in an empty composer uses that conversation; selecting one in an existing conversation opens a new one and preserves the old draft. Partial-name/role matching and original file/Session references remain. The first send loads current role settings and searches linked knowledge through QZOS authorization, then serializes only the role and retrieved excerpts into the ordinary DSH message. Disabled/paused/retired employees, invalid knowledge bindings, external workflows and failed retrieval refuse the send and retain the draft. The current or sole Workspace supplies the new Session.

## Model Experience

### Business actions

#### What the model sees

This UI plugin adds no DSH system prompt or tool schema; the optional private Host execution adapter separately supplies employee skill and plugin tools. Each user turn receives `employeeId`, role and authorized knowledge excerpts; DSH logs this context and executes using the model selected in its work window. Backend model IDs, workflow secrets and login tokens are not copied into model input.

#### Token effect

User-requested learning and search may consume the configured QZOS model quota; the per-turn role and excerpts also consume DSH input tokens. Listing, login and ACL operations add no DSH model tokens.

#### KV Cache effect

The plugin does not construct DSH provider requests or change their cache layout.

## Known Limitations and Deferred Work

- QZOS validates knowledge permissions. Employee Host binding and per-turn context are connected; local synthetic knowledge answers and follow-up retrieval have been verified with working model configuration. Connector authorization, skill installation and template application remain unavailable. Desktop Web and narrow layouts are covered; Electron is not validated.

The current account integration targets the local `qzos-login-test` environment only. Password recovery, production endpoint configuration, SMS/email delivery and WeChat provider verification are not included in the verified scope. This is business sign-in, not multi-user isolation for DSH files, conversations or tools.

The private plugin mounts the full-screen login/register surface through the native shell overlay. Signed-out users see it before the work interface; there is no QZOS account sidebar module. Sign-in closes it, sign-out or verified session expiry brings it back. This presentation does not add multi-user authorization to the DSH Host.

The local knowledge environment includes isolated PostgreSQL, original installation schemas and ACL/version migrations, plus a synthetic knowledge fixture. Local credentials now support successful synthetic knowledge creation, vector training and retrieval. Private uploads and server parsing now use the existing Python workers. Document status opens revision-bound review, draft saving, confirm-and-learn, retry, replacement, continuation and cancellation actions from the server. Version updates accept one source file; unsuccessful imports retain their request identity for resubmission. Parsing does not imply activation: the current version remains searchable until learning completes.

File ACL now uses the existing rules/subjects/add/edit/del endpoints inside the native modal. Deletion disables rules, preserving backend history. The knowledge external-use switch uses `/kb.publish/knowledgeExternal`, confirms enablement and reads back state; switch-only saves do not require a ready model. Synthetic local API checks cover rule creation/edit/disable, owner preservation, switch round trips and anonymous rejection. Local chat and embedding models, Python, PDF utilities and private upload are configured. Synthetic XLSX upload, manual formula-cache correction, saved review readback, learning, retry recovery and cancellation have been exercised. The next employee turn changed from version 1 (day 17) to version 2 (day 23); cancelling version 3 preserved version 2 retrieval. Later checks cover quota continuation, explicit unknown-usage retry, PDF/PPTX learning, and PDF/PPTX/XLSX correction versions with precise sources. The server infrastructure-retry exhaustion state is fixed. Automatic OCR still lacks a configured service and remains unverified; these results do not cover every layout or failure branch.

Fixed local startup: workspace `scripts/start-dsh-ui.sh` forwards to the tracked plugin script `scripts/start-local.sh`. From the repository root, run `bash packages/client/ui-qzos/scripts/start-local.sh`. It reads `.node-version`, uses workspace `.local/toolchains/node-v<version>/bin` (Node plus `include/node` development headers), then delegates fresh builds and watching to upstream `dev:web`. Build failures stop startup; occupied ports fail explicitly without killing other processes. The local port is 3081; startup uses `--no-open` so restarts do not accumulate browser tabs. Reuse the existing preview tab and follow the launch output for Host authentication. Another machine needs the matching Node distribution, pnpm, installed dependencies and a local QZOS backend. Runtime files, test accounts and credentials are not committed.

### Dev Note

<details>
<summary>Local integration context</summary>

The plugin owns business transport and native resource registration. Credentials and local runtime state stay outside Git. The original Product task records verification and remaining model/parser setup.

</details>

Employee management reads full configurations and preserves nested workflow settings and menu images during writes. Publication drafts, usage limits, state changes and conversation records use existing endpoints. Synthetic local checks cover creation, configuration readback, browser saving, disabled publication CRUD and anonymous rejection. API publication is blocked by the current test license; key lifecycle success is unverified. Public visitor URLs and embedding/posters remain unavailable; skill/plugin bindings now use current APIs. Selecting an employee never sends automatically. The private Host adapter persists employee/account bindings and rechecks authorization and knowledge for each new user turn. Business login authorizes the Host in memory; after restart, page reload revalidates a saved business session and restores Host authorization, or requires sign-in if the credential is invalid. With the optional private execution adapter enabled, native answers and actual usage are also written to QZOS. Cross-account file/history/tool isolation remains deferred. Local model setup and synthetic knowledge answers are verified; this does not validate the deferred employee features.

Employee context is hidden in Chat; user questions, answers and their knowledge citations remain visible. New retrieval messages use the private context source and native Chat filtering. For existing history, a registered text rule recognizes only complete legacy employee envelopes and hides their Chat rows. Session records, model input and Trajectory inspection remain unchanged.

Unavailable employee knowledge links default to preservation. Settings allow explicit rebinding to a nonempty selection or removal of all links with confirmation. Saving rereads the employee and verifies the resulting links; failures retain the form. The next user question uses the saved selection, or skips knowledge retrieval after removal. Existing conversation history and citations remain.

Effective structured files expose “Correct as a new version” through server-advertised actions. Correction drafts bind the active version, save and reread facts, and use the existing review/learning workflow; the prior version remains active until learning completes. Review and search results display explicit page, slide or worksheet/cell coordinates. Search translates the form’s semantic mode to the API’s similar mode. Missing locations are labelled rather than inferred.

The document list offers **Original and lifecycle** for managed sources. Downloads use credential headers, no cache and no redirects; account changes or closing the panel discard pending bytes. Historical public URLs are not opened. Editors can read lifecycle revisions and validity windows and request existing draft/review/publish/archive transitions. Server enablement and two-person review still apply. Writes are read back; uncertain outcomes require refresh rather than automatic replay. Existing Session history is not erased by revocation.

Employee settings state that answers use the work-window model and label saved-only fields as inactive in DSH. Skill and plugin bindings cannot be changed. External workflows cannot be enabled or edited; an existing enabled workflow can be turned off and saved through the existing API. These presentation changes do not alter execution or the save protocol.

The current private UI adds server-prepared QA/text and two-column CSV/XLSX imports, learning/QA status, retry and cost estimate reads; import algorithms remain in Python Workers. Employee discovery/sharing, skill/plugin bindings and the native conversation's answer-feedback overlay call current QZOS APIs. Bindings apply only with the optional Host execution adapter configured. The overlay belongs to the root business scope, clears on account changes and reads the current account's last 100 recorded turns. DSH usage totals include only authoritative receipts, with pending usage shown separately. External workflow editing is removed while saved configuration is preserved and an enabled legacy flow can be disabled. External API publication remains deferred; production OCR and external workflow services were not tested.
