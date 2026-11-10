# Brandon RV — Operations Workflow Rebuild

## Business rules sourced from the business plan
Brandon RV launches as a mobile caravan and motorhome interior repair/accessory service, not a general mobile mechanic. Launch candidates include minor non-structural cabinetry, hinges, latches, runners, doors, trims and suitable interior fittings. 12V/24V accessories, water-system work, awnings and insurance-related work remain conditional. Diesel heaters, underbody servicing, motorhome mechanical work, 240V, gas, complex inverter/solar, structural repairs, major water damage and certification inspections are deferred or excluded until the required scope, competence, permissions and insurance are established.

The form must capture vehicle make/model/year, type, registration, VIN/chassis where available, location, symptoms, requested work, access/site information and photographs. Vehicle categories should include caravan, motorhome, camper trailer and horse float only where appropriate. Vehicle type never automatically authorises a task.

## Two separate intake routes
1. **General Enquiry** — public Contact page. Creates a general/public enquiry only. No quote, booking, jobcard or workcard is created. Admin can add internal notes, update contact details and record call/email follow-up. No customer reply composer is required.
2. **Request a Quote** — public quote form. Creates a quote-request ticket and the first customer-facing Jobcard. Guest requests receive a time-limited access link; signed-in customers can select a saved vehicle and reuse their account details. The contact form is not part of this flow.

## Target workflow
1. Customer submits Request a Quote.
2. Create a permanent Jobcard in **New / Senior review required** state, linked to the enquiry, customer or guest, and vehicle.
3. Senior staff review service suitability, vehicle details, photos, site conditions, scope boundaries and missing information. Record internal notes and the review decision.
4. Senior staff prepares a detailed, customer-readable quote with separate labour, parts, freight, consumables, travel and applicable tax treatment. Quote revisions remain immutable.
5. Customer discusses the request in the ticket thread and accepts or declines a specific quote revision. Record actor, timestamp, revision and decision.
6. Only an accepted quote can proceed to scheduling. Confirm the actual service date, start/end time, customer site address and access notes. A preferred time is not a booking.
7. Create an unassigned Workcard from the accepted scope and confirmed booking. Workcard is the technician document; Jobcard remains the customer-facing record.
8. Management assigns an eligible worker. Worker sees assigned Workcards and the information needed to perform that job.
9. Worker records arrival/start, site safety checks, existing condition, notes, photographs, time, labour, parts/materials, test results and handover details. Internal notes remain private.
10. If hidden damage or additional work changes scope/cost, worker submits a variation request with notes/photos. Senior staff reviews it and sends a revised quote/variation. No extra work proceeds until customer approval is recorded.
11. Worker submits the Workcard for completion and signs off their work.
12. Senior staff reviews the Workcard, verifies records and signs off/reopens it with required corrections.
13. Approved Workcard data is consolidated into the final Jobcard: approved original scope, variations, work performed, parts, labour/time, photographs, tests, costs, worker and senior approvals, dates and handover.
14. Issue the final itemised invoice. Customer reviews and signs off the completion record/invoice; payment is then recorded through verified payment-provider confirmation or an authorised manual reconciliation.
15. Close and archive the Jobcard only after required sign-offs and payment state are satisfied. Preserve all versions, messages, approvals and audit history.

## Document responsibilities
- **Jobcard:** customer-readable master record, from initial request through final handover. Shows customer/vehicle, enquiry summary, discussion outcome, quote revisions and decisions, booking, work completed, parts, variations, approvals, invoice and payment.
- **Workcard:** staff/worker execution document created only after quote acceptance and confirmed booking. Contains internal instructions, assignment, safety/site checks, work notes, photos, time, parts, tests, variations and worker/senior sign-offs. Printable as an A4 hard copy and usable digitally.

## Current repository findings
The existing system already has a unified `enquiries` intake, quote revisions, ticket messages, guest access tokens, appointments, jobs/work orders, staff assignments and job work entries. The current production sequence creates a `jobs` work order after a confirmed appointment. That is not yet the requested model because the customer Jobcard must exist immediately at quote-request submission and the Workcard must be created later. Do not silently repurpose or delete existing records. Introduce a parent Jobcard record and a separate Workcard record, then link existing enquiry/quote/appointment/job records to them with a forward-only migration and backfill strategy.

## Delivery sequence
- P0: compact and stabilise admin/staff workspace; separate General Enquiries and Quote Requests queues; improve list loading and action discoverability.
- P1: introduce Jobcard/Workcard data model, migration, secure APIs, status transitions and audit trail.
- P2: implement senior review, quote revision approval, accepted-quote booking gate and Workcard generation/assignment.
- P3: implement worker execution form, variation approvals, worker sign-off and senior sign-off.
- P4: consolidate final Jobcard, printable customer PDF, invoice approval/payment and archive.
- P5: run end-to-end permission, customer-isolation, failure, duplicate-submit, print and mobile verification.

## Non-negotiable safeguards
- Keep existing customers, vehicles, enquiries, quotes, jobs, invoices and payment history.
- No work starts before quote acceptance, confirmed booking and worker assignment.
- No scope/cost increase without customer approval.
- Keep internal notes and supplier costs private.
- Enforce permissions server-side.
- Keep all sign-offs immutable and attributable to a user and timestamp.
- No production migration is applied by creating this branch or pull request.
