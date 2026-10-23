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

Before each model step, the plugin validates the active account and employee availability. New user input triggers authorized knowledge retrieval; allowlisted role and excerpts become logged ordinary messages through `agent/pre-step`. Native DSH owns execution and results. In the unassigned local preview, login changes cancel the previous account's bound agents. After Host restart, authorization must be restored by revalidating the browser’s saved business session or signing in again. Removal requires removing both this plugin and its browser integration.

Set `managedGateway: true` with `ownerUserId` when the deployment gateway owns login. The Host injects only the assigned user ID into the private browser UI; it never injects the business token. The UI uses gateway cookies and relative business routes. The gateway must bind authenticated requests to this Host and revoke native access and live connections on logout. This setting alone does not create that gateway.

For a dedicated Host, set `ownerUserId` to the user ID returned by the configured backend. Authorization and binding reject a different backend-authenticated ID with HTTP 403 and `QZOS_HOST_ACCOUNT_MISMATCH`, without replacing the active credential. The `qzos_host_owner` domain retains the account and exact API URL; changing either or removing the assignment refuses plugin activation. Existing employee bindings for another account also refuse activation. Omission preserves the unassigned local preview; it is not a multi-user deployment. Account assignment is deployment-owned configuration, not a browser claim or a first-login claim.

Use a fresh Host data directory for each assigned user. Do not apply assignment to an existing mixed history: this plugin cannot determine ownership of unbound native Sessions. Migration requires an explicit ownership decision. Native authentication, credentials, persistence, attachments, storage, workspaces and execution must all be separate. Distinct `DSH_HOME` directories alone do not confine shell commands or absolute file reads. Use separate OS identities or containers with no peer data mounts; route each authenticated user only to their Host, and protect configuration from tenant changes. Native Host owner credentials must never be shared between users. Business logout revokes employee execution only; it does not revoke native DSH cookies or native file/history access.

## Model Experience

### Employee knowledge

#### What the model sees

Each new user turn receives `employeeId`, `name`, `role` and authorized `sources` as a logged context message. Credentials and workflow configuration are excluded.

#### Token effect

Role and retrieved excerpts add input tokens. Retrieval uses the configured QZOS embedding model.

#### KV Cache effect

The plugin does not change provider requests or cache layout.

## Known Limitations and Deferred Work

- Account assignment prevents business-account switching on a dedicated Host; it does not implement a login router, native logout, OS execution confinement or data migration. A shared Host still exposes native files, tools and history to every native owner credential. It does not restore the PHP chat runtime, map QZOS quotas/statistics or support external employee workflows. Retrieval failures refuse execution. Model context adds input tokens; no provider request or cache layout changes.

Focused tests cover HTTP trust rejection, binding reload, per-turn retrieval, employee pause, account switching and logout using real HTTP and domain services with synthetic upstream responses. Local browser verification now covers a real knowledge answer and a follow-up with fresh retrieval through QZOS and the configured Aliyun model. Browser verification also covers saved business-session revalidation after Host restart, restored conversation history and a follow-up that retrieves fresh knowledge without selecting the employee again. Multiple simultaneous local preview tabs can stall restoration; reuse an existing tab when restarting. See the original Product task for current results.

Retrieval messages carry the `qzos-employee-context` source with `snapshot` form. Native Chat hides this context while keeping it in model history and Session records; answers retain knowledge ID citations.

### Dev Note

<details>
<summary>Local integration</summary>

Verification details are maintained in the original Product task.

</details>
