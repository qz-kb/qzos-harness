# QZOS workspace preview

English | [中文](README.zh.md)

This private browser plugin adds a workbench, knowledge, digital employee, connector, skill, template and deliverable catalog to the existing DSH shell. It uses synthetic Chinese example content and localized interface controls. It does not replace the native Session engine or its workspace navigation.

## Use this package

The Web bundle mounts `ui-qzos`. Remove or disable that row to restore the upstream presentation. The plugin owns its `qzos-*` main panels and sidebar entries. Browser-memory state retains drafts, catalog selections and simulated conversations across panel navigation; refresh clears it. Choosing an employee starts a new simulated conversation without changing earlier messages. Templates fill the current draft without submitting it.

Start through `pnpm dsh web --patch apps/web/tests/pin-browse-picker.overlay.yml` using the root `.node-version`. For developer state previews, set `sessionStorage.setItem("qzos.preview", "1")` in the browser console and reload; remove that key to hide the controls. Ordinary users see the demo-data label but no state controls. Native DSH controls still perform their original actions; only QZOS panels are synthetic.

## Model Experience

No model requests, token usage or KV-cache changes. This plugin injects only layout, slots and locale services. Catalog and conversation actions have no business API, credential or file-write integration.

## Known Limitations and Deferred Work

This first slice targets desktop Web with collapsible navigation in narrow windows. Upload, publishing, external authorization, skill installation, file generation and download are unavailable. Previews and selections do not grant permissions. Business identity, citations, billing and task execution remain future integrations. Electron is not validated.
