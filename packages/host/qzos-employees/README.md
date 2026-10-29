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

Before each model step, the plugin validates the active account and employee availability. New user input triggers authorized knowledge retrieval; allowlisted role and excerpts become logged ordinary messages through `agent/pre-step`. Native DSH owns execution and results. In the unassigned local preview, login changes cancel the previous account's bound agents. After Host restart, authorization must be restored by revalidating the browser’s saved business session or signing in again. Removal requires removing both this plugin and its browser integration.

Set `managedGateway: true` with `ownerUserId` when the deployment gateway owns login. The Host injects only the assigned user ID into the private browser UI; it never injects the business token. The UI uses gateway cookies and relative business routes. The gateway must bind authenticated requests to this Host and revoke native access and live connections on logout. This setting alone does not create that gateway.

For a dedicated Host, set `ownerUserId` to the user ID returned by the configured backend. Authorization and binding reject a different backend-authenticated ID with HTTP 403 and `QZOS_HOST_ACCOUNT_MISMATCH`, without replacing the active credential. The `qzos_host_owner` domain retains the account and exact API URL; changing either or removing the assignment refuses plugin activation. Existing employee bindings for another account also refuse activation. Omission preserves the unassigned local preview; it is not a multi-user deployment. Account assignment is deployment-owned configuration, not a browser claim or a first-login claim.

Use a fresh Host data directory for each assigned user. Do not apply assignment to an existing mixed history: this plugin cannot determine ownership of unbound native Sessions. Migration requires an explicit ownership decision. Native authentication, credentials, persistence, attachments, storage, workspaces and execution must all be separate. Distinct `DSH_HOME` directories alone do not confine shell commands or absolute file reads. Use separate OS identities or containers with no peer data mounts; route each authenticated user only to their Host, and protect configuration from tenant changes. Native Host owner credentials must never be shared between users. Business logout alone revokes employee execution; the managed gateway separately revokes entry cookies, native proxy access and live connections.

## Optional execution adapter

Configure `execution: { secretEnv: QZOS_DSH_BRIDGE_SECRET }` on this private Host plugin. Keep the shared secret (at least 32 bytes) in Host/server environment only. On Server run `php think dsh:migrate`, enable the existing trace/feedback migrations, and set `QZOS_DSH_MODEL_MAP` to exact `provider/model` → enabled child-model IDs. Missing mapping or business allowance refuses a bound model request; the employee's saved model never overrides the work-window route. The adapter is off by default; employees with knowledge require it.

The `qzos_execution` domain v1 stores turn metadata and an account-scoped receipt outbox; it stores no tokens or signing secrets. Model responses and exact provider usage are journaled before settlement. Interrupted calls without usage remain unknown, and recovery retries only settlement, never the model. Server serializes account updates, snapshots price, deduplicates call IDs and updates one answer record per native turn. Feedback uses those server-owned records; historical pre-adapter answers are not fabricated. Auxiliary title/compaction usage is billed but does not replace the answer.

Per-agent tools list currently bound capabilities, load a skill's validated instructions for the selected window model, run allowed plugin actions and query existing outcomes. QZOS rechecks current binding and authorization. Mutating plugin actions require native one-shot approval; send actions additionally confirm the server-frozen recipient and payload. Unknown outcomes are queried without resending. No credential or confirmation secret is exposed to the model. Skill instructions and plugin results add ordinary context tokens and may cause additional model steps; no cache layout changes.

`qzos_knowledge_search` searches the bound employee's knowledge bases through the trusted retrieval adapter. The model can call it repeatedly with focused queries while building a solution; each result is reference data with knowledge and source identities, never instructions. It uses the same signed `retrieve` path and turn identity as automatic retrieval, so employee knowledge permissions and receipts stay authoritative. It is registered only when the execution adapter is enabled.

Tests cover receipt/account isolation, exact cached counters, tool confirmation/rejection and uncertain results. The local synthetic station verified real model skill execution, read/draft/send plugin calls, cancellation/revocation, nonzero idempotent settlement and native-answer feedback. This is not production deployment, arbitrary external plugin verification or multi-user Host isolation.


## Model Experience

### Employee knowledge

#### What the model sees

Each new user turn receives `employeeId`, `name`, `role` and authorized `sources` as a logged context message. Credentials and workflow configuration are excluded. `qzos_knowledge_search` returns focused excerpts and source fields as ordinary tool results; the model is instructed to cite them and treat them as data.

#### Token effect

Role and retrieved excerpts add input tokens. Retrieval uses the configured QZOS embedding model.

#### KV Cache effect

The private request hook applies only employee temperature, preserving the window provider/model and cache layout. Optimization/reranking settings go to the existing QZOS retrieval API.

## Known Limitations and Deferred Work

- Each Host has one active business account. Enterprise deployment uses dedicated Hosts/containers for files, history and tools; the shared local preview does not isolate business users. It does not restore the PHP chat runtime or support external employee workflows. The optional execution adapter writes actual work-window usage and answer records to QZOS. Retrieval failures refuse execution. Model context adds input tokens; only temperature changes, preserving model routing and cache layout.

Focused tests cover HTTP trust rejection, binding reload, per-turn retrieval, employee pause, account switching and logout using real HTTP and domain services with synthetic upstream responses. Local browser verification now covers a real knowledge answer and a follow-up with fresh retrieval through QZOS and the configured Aliyun model. Browser verification also covers saved business-session revalidation after Host restart, restored conversation history and a follow-up that retrieves fresh knowledge without selecting the employee again. Multiple simultaneous local preview tabs can stall restoration; reuse an existing tab when restarting. See the original Product task for current results.

Retrieval messages carry the `qzos-employee-context` source with `snapshot` form. Native Chat hides this context while keeping it in model history and Session records; answers retain knowledge ID citations.

### Dev Note

<details>
<summary>Local integration</summary>

Verification details are maintained in the original Product task.

</details>

Each authorized excerpt retains allowlisted file identity, name, version, fragment ID and verified parse coordinates from QZOS. The logged context asks the model to cite these fields and never invent missing locations. Native Chat continues to hide the context message; readable answer citations remain visible.

The opt-in `tests/access-live.spec.ts` takes `QZOS_LIVE_ACCESS_DIR`, a prepared local synthetic fixture directory containing `member-account.json`, `member.json`, `access-state.json` (kb_id, employee, rule, body, url), and `correction.pdf`; its parent contains the existing owner `account.json`. The test locks the fixture, logs in normally, and checks reference revocation/restoration, membership removal on the next step of the same bound agent, and original-download rejection. Teardown restores synthetic membership and grants and disposes the Host. Enable only against an explicitly prepared mutable synthetic fixture. No language model call is made.

Managed public sharing can set `publicVisitorOrigin`, restricted to an HTTP(S) origin without credentials or a path. The private UI receives this public origin instead of deriving visitor links from the internal container API. Real dual-container checks cover histories, files, terminals, restart persistence and logout revocation; the combined enterprise backend/model and signed-receipt deployment still requires configuration validation.

The execution journal persists admission parameters before `begin`. After an admission response is lost, recovery reuses the call identity and settles exact zero usage because the provider was never entered; it does not create an empty answer. Existing journal rows without admission parameters retain unknown-usage recovery. Explicit refusals of a first admission remove the local entry; ambiguous admissions remain journaled. Recovery discards an unentered registration only when Server explicitly confirms no accepted identity and refuses current eligibility; transport errors and identity conflicts remain recoverable. Server reconciliation checks an accepted identity before current employee/model eligibility.

Knowledge retrieval uses signed `kb.dsh/retrieve`, with a stable identity per account, Session, turn and question. Server owns employee settings, admission, global multi-library selection and actual embedding/optimization/ranking settlement. Successful retries reuse the result after fresh source authorization; uncertain retrievals never replay a paid provider call. The former unsigned search-test fallback is unavailable. See the [private adapter upgrade](../../../docs/upgrade-guide/v0.2.1-alpha.5/qzos-retrieval-receipts/guide.md).

Transport failure triggers one retry of the same retrieval identity. A pending response keeps the same turn active and polls the same identity until completion or cancellation. Business refusals and cancellation are not retried; repeated transport loss ends the turn with a recovery hint. A new user question has a new identity.
