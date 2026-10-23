---
description: "Private QZOS employee authorization and per-turn knowledge context."
kind: "package-reference"
---
# QZOS employee Host adapter

English | [中文](README.zh.md)

## Summary

Private QZOS authorization, knowledge retrieval, bound capabilities and optional usage receipts for native employee Sessions.

## Table of Contents

- [Contract](#contract)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)
- [Optional execution adapter](#optional-execution-adapter)

## Contract

The Web composition mounts this private plugin alongside ui-qzos. `apiUrl` selects the local QZOS API; `requestTimeoutMs` bounds each business request. POST `/qzos/employees` uses the native connection trust fence and accepts authorize, logout and bind operations. Tokens live only in memory. The `qzos_employees` storage domain persists immutable account, employee and backend bindings keyed by native Session ID. Native forks inherit the binding.

Before each model step, the plugin validates the active account and employee availability. New user input triggers authorized knowledge retrieval; allowlisted role and excerpts become logged ordinary messages through `agent/pre-step`. Native DSH owns execution and results. Login changes cancel the previous account's bound agents. After Host restart, authorization must be restored by revalidating the browser’s saved business session or signing in again. Removal requires removing both this plugin and its browser integration.

## Optional execution adapter

Configure `execution: { secretEnv: QZOS_DSH_BRIDGE_SECRET }` on this private Host plugin. Keep the shared secret (at least 32 bytes) in Host/server environment only. On Server run `php think dsh:migrate`, enable the existing trace/feedback migrations, and set `QZOS_DSH_MODEL_MAP` to exact `provider/model` → enabled child-model IDs. Missing mapping or business allowance refuses a bound model request; the employee's saved model never overrides the work-window route. The adapter is off by default.

The `qzos_execution` domain v1 stores turn metadata and an account-scoped receipt outbox; it stores no tokens or signing secrets. Model responses and exact provider usage are journaled before settlement. Interrupted calls without usage remain unknown, and recovery retries only settlement, never the model. Server serializes account updates, snapshots price, deduplicates call IDs and updates one answer record per native turn. Feedback uses those server-owned records; historical pre-adapter answers are not fabricated. Auxiliary title/compaction usage is billed but does not replace the answer.

Per-agent tools list currently bound capabilities, load a skill's validated instructions for the selected window model, run allowed plugin actions and query existing outcomes. QZOS rechecks current binding and authorization. Mutating plugin actions require native one-shot approval; send actions additionally confirm the server-frozen recipient and payload. Unknown outcomes are queried without resending. No credential or confirmation secret is exposed to the model. Skill instructions and plugin results add ordinary context tokens and may cause additional model steps; no cache layout changes.

Tests cover receipt/account isolation, exact cached counters, tool confirmation/rejection and uncertain results. The local synthetic station verified real model skill execution, read/draft/send plugin calls, cancellation/revocation, nonzero idempotent settlement and native-answer feedback. This is not production deployment, arbitrary external plugin verification or multi-user Host isolation.


## Model Experience

### Employee knowledge

#### What the model sees

Each new user turn receives `employeeId`, `name`, `role` and authorized `sources` as a logged context message. Credentials and workflow configuration are excluded.

#### Token effect

Role and retrieved excerpts add input tokens. Retrieval uses the configured QZOS embedding model.

#### KV Cache effect

The plugin does not change provider requests or cache layout.

## Known Limitations and Deferred Work

- This is one local Host account, not isolation of DSH files, tools or history between business users. It does not restore the PHP chat runtime or support external employee workflows. The optional execution adapter writes actual work-window usage and answer records to QZOS. Retrieval failures refuse execution. Model context adds input tokens; no provider request or cache layout changes.

Focused tests cover HTTP trust rejection, binding reload, per-turn retrieval, employee pause, account switching and logout using real HTTP and domain services with synthetic upstream responses. Local browser verification now covers a real knowledge answer and a follow-up with fresh retrieval through QZOS and the configured Aliyun model. Browser verification also covers saved business-session revalidation after Host restart, restored conversation history and a follow-up that retrieves fresh knowledge without selecting the employee again. Multiple simultaneous local preview tabs can stall restoration; reuse an existing tab when restarting. See the original Product task for current results.

Retrieval messages carry the `qzos-employee-context` source with `snapshot` form. Native Chat hides this context while keeping it in model history and Session records; answers retain knowledge ID citations.

### Dev Note

<details>
<summary>Local integration</summary>

Verification details are maintained in the original Product task.

</details>

Each authorized excerpt retains allowlisted file identity, name, version, fragment ID and verified parse coordinates from QZOS. The logged context asks the model to cite these fields and never invent missing locations. Native Chat continues to hide the context message; readable answer citations remain visible.

The opt-in `tests/access-live.spec.ts` takes `QZOS_LIVE_ACCESS_DIR`, a prepared local synthetic fixture directory containing `member-account.json`, `member.json`, `access-state.json` (kb_id, employee, rule, body, url), and `correction.pdf`; its parent contains the existing owner `account.json`. The test locks the fixture, logs in normally, and checks reference revocation/restoration, membership removal on the next step of the same bound agent, and original-download rejection. Teardown restores synthetic membership and grants and disposes the Host. Enable only against an explicitly prepared mutable synthetic fixture. No language model call is made.
