---
kind: upgrade-guide
description: "QZOS knowledge retrieval requires the private signed execution adapter."
---
# QZOS knowledge retrieval receipts

English | [中文](guide.zh.md)

## Change

The private QZOS employee plugin no longer calls the unsigned knowledge search-test endpoint. Employees with knowledge require the existing `execution.secretEnv` adapter. Native DSH model routing and Session format are unchanged.

## Migration

1. Update the matching QZOS Server candidate and run `php think dsh:migrate` for retrieval receipts and import source metadata.
2. In the QZOS Host overlay, configure `execution: { secretEnv: QZOS_DSH_BRIDGE_SECRET }`. Supply the existing account-bound secret to Server and that user's Host; keep it out of browser configuration.
3. Keep `QZOS_DSH_MODEL_MAP` mapped to the selected work-window provider/model. Send a synthetic employee question and verify `kb.dsh/retrieve` succeeds, its actual retrieval usage is recorded once, and the answer retains knowledge citations.
