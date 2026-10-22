---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-22-qzos-employee-context

English | [中文](2026-10-22-qzos-employee-context.zh.md)

## Summary

Adds the private qzos-employee-context message source for logged employee retrieval context.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

Existing source alternatives and Session versions are unchanged. The new kind carries attribution and snapshot presentation only, with no authority or required replay behavior. Existing readers preserve unknown message sources and their text; native Chat classifies non-user sources as context. New readers also retain legacy user-source messages; ui-qzos hides only matching legacy display rows. Model text and answer citations are unchanged.

<a id="verification"></a>
## Verification

Private Host binding HTTP test passed with source metadata and unchanged user input assertions. Browser verification after Host restart and refresh retained historical questions and citations, hid old JSON and new context, and completed a fresh retrieval answer. Host and client aggregate TypeScript checks passed.

<a id="dev-note"></a>
## Dev Note

None.
