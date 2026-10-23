---
description: "Private QZOS employee authorization and per-turn knowledge context."
kind: "package-reference"
---
# QZOS employee Host adapter

English | [中文](README.zh.md)

## Summary

Private QZOS authorization and knowledge retrieval for native employee Sessions.

## Table of Contents

- [Contract](#contract)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Contract

The Web composition mounts this private plugin alongside ui-qzos. `apiUrl` selects the local QZOS API; `requestTimeoutMs` bounds each business request. POST `/qzos/employees` uses the native connection trust fence and accepts authorize, logout and bind operations. Tokens live only in memory. The `qzos_employees` storage domain persists immutable account, employee and backend bindings keyed by native Session ID. Native forks inherit the binding.

Before each model step, the plugin validates the active account and employee availability. New user input triggers authorized knowledge retrieval; allowlisted role and excerpts become logged ordinary messages through `agent/pre-step`. Native DSH owns execution and results. Login changes cancel the previous account's bound agents. After Host restart, authorization must be restored by revalidating the browser’s saved business session or signing in again. Removal requires removing both this plugin and its browser integration.

## Model Experience

### Employee knowledge

#### What the model sees

Each new user turn receives `employeeId`, `name`, `role` and authorized `sources` as a logged context message. Credentials and workflow configuration are excluded.

#### Token effect

Role and retrieved excerpts add input tokens. Retrieval uses the configured QZOS embedding model.

#### KV Cache effect

The plugin does not change provider requests or cache layout.

## Known Limitations and Deferred Work

- This is one local Host account, not isolation of DSH files, tools or history between business users. It does not restore the PHP chat runtime, map QZOS quotas/statistics or support external employee workflows. Retrieval failures refuse execution. Model context adds input tokens; no provider request or cache layout changes.

Focused tests cover HTTP trust rejection, binding reload, per-turn retrieval, employee pause, account switching and logout using real HTTP and domain services with synthetic upstream responses. Local browser verification now covers a real knowledge answer and a follow-up with fresh retrieval through QZOS and the configured Aliyun model. Browser verification also covers saved business-session revalidation after Host restart, restored conversation history and a follow-up that retrieves fresh knowledge without selecting the employee again. Multiple simultaneous local preview tabs can stall restoration; reuse an existing tab when restarting. See the original Product task for current results.

Retrieval messages carry the `qzos-employee-context` source with `snapshot` form. Native Chat hides this context while keeping it in model history and Session records; answers retain knowledge ID citations.

### Dev Note

<details>
<summary>Local integration</summary>

Verification details are maintained in the original Product task.

</details>

Each authorized excerpt retains allowlisted file identity, name, version, fragment ID and verified parse coordinates from QZOS. The logged context asks the model to cite these fields and never invent missing locations. Native Chat continues to hide the context message; readable answer citations remain visible.

The opt-in `tests/access-live.spec.ts` takes `QZOS_LIVE_ACCESS_DIR`, a prepared local synthetic fixture directory containing `member-account.json`, `member.json`, `access-state.json` (kb_id, employee, rule, body, url), and `correction.pdf`; its parent contains the existing owner `account.json`. The test locks the fixture, logs in normally, and checks reference revocation/restoration, membership removal on the next step of the same bound agent, and original-download rejection. Teardown restores synthetic membership and grants and disposes the Host. Enable only against an explicitly prepared mutable synthetic fixture. No language model call is made.
