# QZOS resource page preview

English | [中文](README.zh.md)

This private browser plugin adds knowledge, digital employees, connectors, skills and templates to DSH. The native work window remains the default entry and owns every conversation. Workbench and deliverable pages are removed.

## Use this package

The Web bundle mounts `ui-qzos`. Removing the row restores the upstream presentation. Run `pnpm run dev:web --patch apps/web/tests/pin-browse-picker.overlay.yml --port 3081` with the root `.node-version`; keep launcher options before Web options.

Knowledge and employee presentation follows the existing QZOS client: `qzos-pc/src/pages/application/layout/{kb,robot}.vue`, `application/kb/detail/`, and `application/robot/setting.vue` with its child views. Cover cards, member entry, employee avatars and menus, detail sidebars, creation fields and grouped configuration follow those sources. Chinese source labels are retained in locale dictionaries. Publication artwork comes from the existing QZOS assets. Connectors, skills and templates keep the native Plugins/Automation tasks page style.

The browser-only store supports resource creation/editing/deletion, document and fragment lists, import selection, search previews, member changes, settings, employee menus, publication examples and conversation records. Refresh clears these changes. Image selection reads local images for preview; document selection stages names and synthetic rows, without uploading, parsing, OCR or learning. Exports contain synthetic data. Publication links use `example.invalid`; keys are nonfunctional examples. Native DSH modals, menus, controls and effect-owned registrations provide the interaction machinery.

Employee entry returns to the native composer and inserts `@employee` without sending or replacing the draft. New and edited preview employees update that menu. Partial-name/role matching, original file/Session references and duplicate prevention remain. Preview employee references refuse execution with an explanation; removing them restores ordinary DSH submission. A sole Workspace may prepare its blank Session; otherwise select a Workspace first.

## Model Experience

No QZOS business API, model, retrieval, authorization, billing, parser, publishing or external connector calls are made by these previews. DSH native controls retain their normal behavior.

## Known Limitations and Deferred Work

Business execution and authoritative data integration remain deferred. Simulated permissions do not grant access. Connector authorization, skill installation and template application remain unavailable. Desktop Web and narrow layouts are covered; Electron is not validated.
