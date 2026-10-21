# QZOS workspace preview

English | [中文](README.zh.md)

This private browser plugin adds a workbench, knowledge, digital employee, connector, skill, template and deliverable catalog to the existing DSH shell. It uses synthetic Chinese example content and localized interface controls. The native DSH work window remains the default landing view and the first sidebar entry. QZOS panels do not replace its Session engine, composer, tools, workspace navigation or right-side panes.

## Use this package

The Web bundle mounts `ui-qzos`. Remove or disable that row to restore the upstream presentation. The plugin owns its `qzos-*` main panels and sidebar entries. Browser-memory state retains drafts, catalog selections and simulated conversations across panel navigation; refresh clears it. Employee cards and details open the native work window and insert a structured `@employee` reference without sending, replacing the draft or changing earlier messages. The native `@` menu lists employees first and matches partial names or role keywords; original file and Session references remain available. Selecting the same employee twice from the catalog does not duplicate its chip. With no selected Session, a sole Workspace opens its blank Session; otherwise the user first selects a Workspace in the native window. Templates fill the current draft without submitting it.

Start through `pnpm dsh web --patch apps/web/tests/pin-browse-picker.overlay.yml` using the root `.node-version`. For developer state previews, set `sessionStorage.setItem("qzos.preview", "1")` in the browser console and reload; remove that key to hide the controls. Ordinary users see the demo-data label but no state controls. Native DSH controls still perform their original actions; only QZOS panels are synthetic.

## Model Experience

No model requests, token usage or KV-cache changes. Native draft, navigation and trigger services support the employee entry. Preview employee references refuse submission with a localized explanation; deleting the references restores ordinary DSH submission. Entering a blank native Session may use the existing DSH Workspace flow, but does not run a model or employee task. Catalog actions have no QZOS business API or credential integration.

## Known Limitations and Deferred Work

This first slice targets desktop Web with collapsible navigation in narrow windows. Upload, publishing, external authorization, skill installation, file generation and download are unavailable. Previews and selections do not grant permissions. Business identity, citations, billing and task execution remain future integrations. Electron is not validated.
