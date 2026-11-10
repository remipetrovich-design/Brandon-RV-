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

## Current implementation evidence and remaining gaps

Implemented on the draft branch:
- The public General Enquiry route is now `/general-enquiry`; the old `/contact` route redirects there. Logged-in customer details are prefilled. It creates a general enquiry only and has no quote, booking or reply-composer flow.
- Request a Quote is a separate quote-only form. Signed-in customers can select saved vehicles; guests receive a secure Jobcard link with a time limit. The general-enquiry mode switch has been removed.
- The existing `enquiries` row is the Jobcard identity. Customer accounts have a Jobcard register and a single Jobcard document that aggregates request details, quote revisions/line items, booking, Workcard, customer-visible work entries/photos, final approval, invoice items and messages. Guest users see the same core Jobcard stages in their secure request workspace.
- General Enquiries, Quote Requests and Customer Enquiries have separate admin queues. General enquiry detail has internal notes and follow-up details but no customer reply composer. Archived requests are removed from active queues and remain filterable.
- Quotes are itemised (up to 30 lines), GST uses the configured business setting, and quote preparation is restricted to active Quote Request Jobcards. A separate authorised senior reviewer must approve a draft prepared by another staff member before the quote can be issued. Quote issue advances the Jobcard through an atomic database function.
- Customer quote acceptance/decline is atomic for account and guest users. Decline reason is optional; the quote and Jobcard close, archive timestamp is recorded, guest access is revoked and the event is audited.
- Account and guest booking requests require an accepted quote, prevent duplicate requests and apply the configured notice period, working days, unavailable dates, opening hours, advance window and appointment/travel conflict checks. A preferred time is still only a request.
- A Workcard is created only after an accepted quote and confirmed booking. Management assigns workers; workers must accept the assignment before starting or recording work. Assignment edits preserve accepted assignments.
- Staff Workcards use a compact one-at-a-time detail view. Workers can record labour, parts, non-billable notes and tests/checks, upload private photos, explicitly choose which photos are customer-visible, and print the submitted Workcard. Non-billable tests and notes are excluded from invoice totals.
- Worker completion records a sign-off. A different authorised senior staff member from the worker who signed off can approve the Workcard or return it for correction. Returning it reopens the Workcard, records the reason and removes the draft invoice. The final report is not shown to the customer until senior approval.
- The customer can approve or request changes to the final report. Draft invoice details remain hidden until customer approval; the itemised invoice is then issued and shown in the Jobcard.
- Admin enquiry detail panels are aligned in a two-column supporting layout. Workcard and quote controls are collapsed and lazy-loaded; the staff Workcard list opens one detailed record at a time. The public site styles remain separate. The Jobcard includes responsive and A4 print styling.

Still required before the workflow can be called complete:
- A formal variation workflow is not implemented yet. The worker must be able to request a variation, senior staff must review it, the customer must approve/decline the cost and scope, and the Workcard must prevent the extra work until approval. The current quote API deliberately blocks revising an accepted quote rather than silently changing the agreed scope.
- Successful closeout archive rules after final customer approval, invoice issue and payment need to be completed. Declined requests already archive and revoke guest access.
- Final customer approval and invoice issuance still need transaction-level failure/concurrency hardening; quote decisions and senior review are already database-transactional.
- Guest and signed-in workflows need end-to-end testing against a migrated test database, including email delivery, signed file access, duplicate submissions, role boundaries and rollback behavior.
- The A4 print output and all page widths/spacing still need browser-rendered visual QA at desktop, tablet and mobile breakpoints. The CSS and type/build checks do not by themselves prove every page looks correct in a live browser.
- Existing completed Workcards are grandfathered as legacy-approved and clearly labelled as records without a separate historical senior sign-off.

## Delivery order

- P0 — compact shared UI, split General Enquiry and Request a Quote, remove redundant controls and preserve existing data.
- P1 — customer Jobcard master, itemised quote revisions, senior quote approval, customer decision and confirmed-booking gate.
- P2 — Workcard assignment, worker execution, photos/tests, worker sign-off and separate senior review.
- P3 — formal variations, customer final approval, invoice issue, payment reconciliation and successful-closeout archive.
- P4 — browser-rendered page QA, A4 print verification, role isolation, failure/concurrency tests and migration validation.

## Non-negotiable safeguards

- Keep existing customer and financial history.
- Do not create a Workcard before accepted quote and confirmed booking.
- Do not start work before worker assignment and acceptance.
- No scope or cost increase without customer approval.
- Internal notes, supplier costs and private attachments never reach customers.
- Enforce permissions server-side.
- Record every approval with actor, role, timestamp and target revision.
- No production migration is applied by creating this branch or pull request.
