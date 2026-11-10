# Brandon RV — Operations Workflow Rebuild

## Business rules from the plan

Brandon RV launches as a mobile caravan and motorhome interior repair/accessory service in Tamworth NSW. It is not a general mobile mechanic, workshop, storage or towing operation. Launch candidates are minor non-structural cabinetry, hinges, latches, runners, doors, trims and suitable living-area fittings. 12V/24V accessories, pumps/taps/fittings/leaks, awnings and insurance-related work are conditional on exact task, competence, legal permissions, site conditions and insurance. Diesel heaters, underbody servicing, motorhome mechanical work, 240V, gas, complex inverter/solar, structural repairs, major water damage and certification inspections are deferred or excluded unless later approved. Horse floats and camper trailers may be considered only for comparable approved tasks.

The public service menu must be driven by approved service records. A vehicle category never authorises a repair. The customer must provide make, model, year, registration/VIN where available, location, symptoms, requested work, site/access details and photos where useful. A preferred visit time is not a booking.

## Reuse-first data architecture

Do not create parallel Jobcard and Workcard tables if existing records can safely provide the same identity and lifecycle.

- **Jobcard:** existing `enquiries` record for `quote_request` becomes the permanent customer master record. It is created immediately on Request a Quote submission and retains its request number and ID through quote, booking, Workcard, invoice, payment and archive. General enquiries remain separate and never become Jobcards.
- **Workcard:** existing `jobs` record is the staff execution document. Keep the database table name for compatibility; label it Workcard in the interface. Create it only after the quote is accepted and a real booking is confirmed.
- **Quotes:** retain `quotes` and `quote_items`; each issued revision remains separately identifiable and linked to the Jobcard.
- **Appointments:** retain `appointments`; requested/preferred times are not confirmed bookings.
- **Invoices and payments:** retain `invoices` and `payments`.
- **Messages, files, assignment, history and audit:** reuse `customer_messages`, `enquiry_attachments`, `enquiry_assignments`, `enquiry_stage_history`, `job_assignments`, `job_work_entries` and `audit_events`.

The customer Jobcard view aggregates these related records. The staff Workcard view is the execution surface. They are two role-specific views of one job, not duplicate records. Existing data must be linked/backfilled safely; never delete or overwrite customer, vehicle, enquiry, quote, job, invoice or payment history.

## Separate public routes

1. **General Enquiry** — Contact page for general questions only. Creates a general/public enquiry. No quote, Jobcard, booking, Workcard or reply composer. Admin staff can record internal notes and email/phone follow-up.
2. **Request a Quote** — separate public form. Logged-in users have contact details prefilled and can select saved vehicles. Guests can submit without an account and receive a secure expiring access link. This form must not offer a mode switch into general enquiry. Submission creates one quote-request enquiry/Jobcard, not a quote, booking or Workcard.

## Jobcard workflow

1. Customer submits Request a Quote; create the Jobcard immediately.
2. Senior staff reviews suitability, vehicle details, photos, requested work, site conditions and missing information.
3. Senior staff records internal notes and either requests information, marks assessment required, declines unsuitable work or prepares a detailed itemised quote.
4. Quote includes labour, parts, freight, consumables, travel and correct tax treatment. Each revision is retained.
5. Customer discusses the Jobcard and accepts or declines a specific quote revision.
6. A declined quote closes and archives the Jobcard, revokes guest access and preserves the full record/audit trail. Decline reason is optional. Archived records leave active queues but remain available to authorised staff and customer history.
7. Only an accepted quote can move to scheduling. Staff confirms date, start/end time, customer-site location and access. A preferred date is not a confirmed booking.

## Workcard workflow

8. After accepted quote and confirmed booking, create one unassigned Workcard.
9. Management assigns an eligible active worker. Record the assigning manager and time.
10. Worker accepts assignment before starting. Worker sees only assigned Workcards.
11. Worker records arrival, site permission/safety checks, existing condition, notes, photos, time, labour, parts/materials, tests and handover. Internal notes and supplier costs remain private.
12. If scope/cost changes, worker stops the affected extra work and submits a variation with evidence. Senior staff reviews it and sends a variation quote. No extra work proceeds until customer approval.
13. Worker submits and signs off the Workcard.
14. Senior staff separately reviews and signs off or returns it for correction. A worker cannot approve their own Workcard.
15. Approved Workcard details are consolidated into the Jobcard, including scope, variations, work performed, parts, time, photos, tests, costs, approvals and handover.

## Final customer approval and payment

16. Customer reviews the final Jobcard/report revision and approves or requests changes. Approval is recorded against that exact revision.
17. After customer approval, issue the itemised invoice.
18. Record payment only from provider confirmation or authorised manual reconciliation.
19. Archive the Jobcard after required sign-offs and payment/closeout conditions are met. Preserve revisions, messages, approvals, files and audit history.

## Current implementation evidence and gaps

The repository already has enquiry records, quote revisions, ticket messages, guest token columns, appointments, jobs/work orders, staff assignment, work entries, invoices and payments. This supports a reuse-first implementation.

The current sequence is still incomplete:
- Quote submission creates an enquiry, but the customer does not yet have one complete Jobcard view spanning quote, booking, Workcard, final approval and invoice.
- The existing `jobs` Work Order is created after a confirmed booking, which is the correct creation gate for a Workcard, but the current staff interface still presents Work Orders rather than the complete compact Workcard workflow.
- Worker work entries and customer approval exist in partial form; a distinct immutable senior sign-off and a complete variation approval workflow still need to be enforced.
- Guest quote-request access is time-limited at creation, but closure must revoke it immediately. Guest access and the request-status route need end-to-end verification.
- The public Request a Quote form previously allowed a signed-in user to switch to a general conversation. That has been removed so General Enquiry and Request a Quote remain separate.
- Quote decline now records the customer decision and attempts to close/archive the related enquiry. This needs atomic database handling and end-to-end failure/concurrency tests before release.

## Delivery order

- P0 — lock the business boundaries, separate public intake, define the shared design/UX contract, compact admin/staff screens and remove redundant navigation/actions.
- P1 — complete Jobcard aggregation and status model using existing enquiry/quote/appointment records; add secure guest/customer access and archive/revocation behavior.
- P2 — complete quote revision review, customer discussion/decision and accepted-quote booking gate.
- P3 — complete Workcard creation/assignment, worker execution, attachments, time/parts/tests, variations, worker sign-off and separate senior sign-off.
- P4 — consolidate final Jobcard, customer approval, invoice issue, payment reconciliation and archive.
- P5 — browser-rendered page consistency, responsive/print QA, role isolation, failure/concurrency tests and migration validation.

## Non-negotiable safeguards

- Keep existing customer and financial history.
- Do not create a Workcard before accepted quote and confirmed booking.
- Do not start work before worker assignment and acceptance.
- No scope or cost increase without customer approval.
- Internal notes, supplier costs and private attachments never reach customers.
- Enforce permissions server-side.
- Record every approval with actor, role, timestamp and target revision.
- No production migration is applied by creating this branch or pull request.
