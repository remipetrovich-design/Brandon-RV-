# Vendor-Neutral Automation Integration

## Purpose

Provide one optional, secure business API that lets an external automation platform operate Brandon RV. The API is platform-neutral: UiPath, Activepieces, Flowise, Node-RED, a custom agent, or another compatible client can use the same contract. Do not put UiPath-specific dependencies or assumptions into the Brandon RV application.

This document describes the integration contract and implementation plan. The API is not active until its authentication, endpoints, migration, tests and deployment are implemented.

## Architecture

```
UiPath / Activepieces / Flowise / Node-RED / custom agent
                         |
                HTTPS + OpenAPI
                         |
             Brandon RV Integration API
                         |
             API key + scoped permissions
                         |
              Existing Brandon RV rules
                         |
        Existing services, records and database
```

The Brandon RV website remains the system of record. External automation must use the same business validation as the admin application. Never expose Supabase credentials or allow arbitrary database queries to an agent.

## Design requirements

- **Detachable:** disabling or revoking the integration blocks external access immediately. Normal website pages, customer portal, staff workflows and database records continue to work.
- **Replaceable:** no vendor-specific SDK, callback URL, data model or workflow dependency in core website code.
- **Least privilege:** issue a separate API credential per automation platform/agent, with explicit read/write scopes.
- **Auditable:** record credential identity, action, entity, outcome and timestamp. Never log bearer tokens or sensitive customer content unnecessarily.
- **Safe by default:** reads and draft preparation can be automated; sending quotes/messages, confirming bookings, issuing invoices/refunds, changing financial records and destructive actions require configured approval.
- **Idempotent:** support an idempotency key for create operations so retries do not create duplicate customers, quotes, jobs or appointments.
- **Versioned:** prefix routes with `/api/integrations/v1`; make breaking changes only in a new version.
- **Standards-based:** publish an OpenAPI 3.1 document; use JSON over HTTPS and standard bearer authentication. Optionally expose an MCP adapter later, built on this same API.

## Authentication and management

Create a random credential for each integration. Store only a cryptographic hash, show the secret once at creation, and support immediate revocation and optional expiry. Use a non-secret key identifier/prefix for display. Scope examples:

- `business.read`, `services.read`
- `customers.read`, `customers.write`
- `enquiries.read`, `enquiries.write`
- `quotes.read`, `quotes.draft`, `quotes.send`
- `availability.read`, `appointments.read`, `appointments.write`
- `jobs.read`, `jobs.write`
- `parts.read`, `parts.write`
- `invoices.read`, `invoices.draft`, `invoices.issue`
- `communications.send`

Credentials must be manageable by an authorised Brandon RV administrator: create, view metadata, rotate/revoke, set expiry, and select scopes. The full secret must never be retrievable after creation.

## API resource groups

Initial API groups to implement:

| Group | Operations |
|---|---|
| Business and services | Read business profile, opening hours, booking policy and active service catalogue |
| Customers and vehicles | Search, read and create customer records; read and manage linked vehicles |
| Enquiries | List, read, create and update customer enquiries |
| Quotes | Read quote requests and quote records; prepare drafts; request approval/send through approved workflow |
| Availability and appointments | Check available windows; create, confirm, reschedule and cancel appointments under booking rules |
| Workcards | Create from accepted quotes; read and update scope, status, priority, schedule and work entries |
| Parts and suppliers | Read and update required/used parts, quantities, costs and supplier details |
| Invoices and payments | Read balances; prepare invoices; issue only with approval; record permitted payment events |
| Communications | Prepare customer messages and send only when the credential has the send scope and approval policy allows it |

All operations must enforce business ownership, existing role/permission rules, quote acceptance gates, Workcard approval gates, booking notice/opening-hour/conflict/travel-buffer rules, GST/pricing rules and invoice eligibility.

## Error and safety contract

Use standard HTTP status codes and JSON errors. Include stable machine-readable error codes, a human-readable message and a request/correlation ID. Never return stack traces, database credentials, password hashes, private session tokens or unrestricted internal records.

For actions needing owner/staff approval, create a pending action and return its approval identifier; do not perform the action until approved. Record the approving user and final outcome.

## Delivery sequence

1. Add integration-key storage migration and admin key-management endpoints/UI.
2. Add shared bearer-token authentication, scope checks, revocation and audit logging.
3. Implement read-only business, service, customer, enquiry, quote, appointment and Workcard endpoints.
4. Implement write operations, reusing existing business rules and transactional helpers.
5. Publish and validate the OpenAPI specification; add idempotency, rate limiting and integration tests.
6. Add optional adapters/examples for UiPath, Activepieces, Flowise, Node-RED and MCP. These adapters must remain outside core business logic.
7. Deploy disabled by default, create a key for one selected platform, test in read-only mode, then grant write scopes gradually.

## Important operational note

Open-source automation software can be free to run, but a hosted server, domain, model inference, email/SMS delivery and backups may still cost money. A zero-software-subscription setup is possible with self-hosted automation and a local model (for example Ollama), provided a suitable computer remains online. Do not promise zero total operating cost without checking hosting and communication requirements.
