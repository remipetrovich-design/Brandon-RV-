# Brandon RV — UX and Workflow Contract

This document is the single behavioral reference for the public website, customer portal, admin workspace and staff workspace. It is based on the Brandon RV business plan and the requested Jobcard/Workcard process. Update it whenever a workflow or shared UI behavior changes.

## 1. Product boundaries

Brandon RV is a mobile caravan and motorhome interior repair and accessory service based in Tamworth NSW. The system must not imply a fixed workshop, vehicle storage, towing or general mobile-mechanic service.

Launch candidates: minor non-structural cabinetry repairs; hinges, latches, runners, doors and trims; suitable living-area fittings and accessories. Conditional work: exact 12V/24V accessory tasks, pumps/taps/fittings/leaks, awnings and insurance-related work. Each conditional task requires an individual competence, legal-scope, site-safety and insurance assessment before acceptance. Diesel heaters, underbody servicing, motorhome mechanical work, 240V, gas, complex inverter/solar, structural repairs, major water damage and certification/roadworthiness inspections are deferred or excluded unless formally approved later. Horse floats and camper trailers may be considered only for comparable approved tasks. Vehicle type never authorises a task.

The public service menu is driven by approved service records. Only `approved_for_launch` services may be presented as available. Conditional services must be labelled assessment required and must not be bookable as if approved. Deferred or excluded services must not be offered as selectable work.

## 2. Canonical record model — reuse existing records

Avoid duplicate parallel records and avoid a destructive rewrite.

- **Jobcard (customer master record):** use the existing `enquiries` record as the Jobcard for every Request a Quote submission. Keep its ID and request number stable from submission to archive. It owns the customer/guest identity, vehicle, request, status, messages, quote links, booking links, customer-visible progress and final handover summary. General enquiries remain enquiries and do not become Jobcards.
- **Quote:** reuse `quotes` and `quote_items`. Revisions are separately numbered, linked to the same Jobcard and immutable once issued or answered. A response always identifies the exact revision.
- **Workcard / Workorder (one staff execution record):** these are two names for the same thing, not separate records or workflows. Reuse the existing `jobs` record and keep the database/API naming for compatibility. Create exactly one Workcard from the accepted quote while the customer Jobcard is open. Link it to the Jobcard through the quote/enquiry relationship. The Workcard is reviewed and approved for assignment before a worker is assigned. The assigned worker accepts it, then coordinates a preferred booking. Management confirms the booking and links it to that same Workcard. Never create another `jobs` record when a booking is confirmed.
- **Invoice/payment:** reuse `invoices` and `payments`; preserve provider-confirmed payment and authorised manual reconciliation records.
- **Messages, attachments, history and audit:** reuse `customer_messages`, `enquiry_attachments`, `enquiry_stage_history` and `audit_events`. Internal notes, worker-only instructions, supplier costs and private attachments never appear in customer views.

The customer Jobcard page aggregates these linked records into one chronological view. The staff Workcard page is the execution surface. They are two views of the same job, not duplicate jobs.

## 3. Separate entry routes

### General Enquiry
- Public Contact page is for general questions, business/service-area enquiries and suitability questions.
- Creates one general/public enquiry only.
- No quote, booking, Jobcard, Workcard or customer reply composer is created by this route.
- Staff record internal notes and follow-up attempts (email/phone), with actor and timestamp.
- If the visitor is signed in, use verified account contact details; otherwise use submitted details.
- A general enquiry can be directed to Request a Quote through a link, but its form must not turn into a quote form.

### Request a Quote
- Dedicated public route and form; no General Enquiry mode, contact-form fields or route-switching toggle.
- Signed-in customers have contact details prefilled and can select a saved vehicle or add one.
- Guests can submit without creating an account and receive a secure, expiring access link.
- Capture vehicle type, make, model, year, registration, VIN/chassis where supplied, location, symptoms/requested work, urgency, preferred timing, access/site details, contact preference and photos/documents.
- A preferred date is a request only, never a confirmed appointment.
- Submission creates the enquiry and its customer Jobcard immediately. It does not create a quote, appointment or Workcard automatically.

## 4. Jobcard state flow

`New → Senior review → Awaiting customer information / Assessment required → Quote preparation → Quote sent → Customer decision`

From Customer decision:
- **Accepted:** move to booking coordination. Acceptance is not a booking.
- **Declined:** mark the quote declined, close and archive the Jobcard, revoke guest access immediately, preserve all records and audit history. Decline reason is optional. The customer can still view the archived outcome through their account/history; the guest access link is no longer usable after closure.
- **Expired:** record expiry distinctly from customer rejection; close/archive only under the agreed expiry policy and notify the customer.

Only an accepted, current quote may proceed to Workcard creation. The Workcard can exist before a booking is arranged. Booking requires an agreed date, start/end time, actual customer-site location, access conditions and management confirmation. Do not represent a preferred date or requested appointment as confirmed.

## 5. Workcard state flow

After the accepted quote and confirmed booking:
1. Create one unassigned Workcard linked to the Jobcard, quote and appointment.
2. Management assigns an eligible active worker. Record who assigned it and when.
3. Worker accepts the assignment before starting.
4. Worker records arrival, site permission and safety checks, pre-existing condition, work notes, photos, time/labour, parts/materials, tests and handover details.
5. Internal notes and supplier costs remain private. Customer-visible updates are explicitly marked.
6. If scope or cost changes, stop the affected work and raise a variation with evidence. Senior staff reviews it and sends the customer a separate variation quote. No additional chargeable work starts until the customer approves that variation.
7. Worker submits the Workcard and signs off their work.
8. Senior staff checks the Workcard, records a separate sign-off, or returns it for correction. Worker sign-off must never count as senior approval.
9. Approved Workcard details are consolidated into the customer Jobcard.

No job is started before accepted quote, confirmed booking, worker assignment and worker acceptance.

## 6. Customer completion and closeout

The final Jobcard presents the agreed scope, accepted quote and variations, confirmed booking, work performed, customer-visible photos, labour/time, parts, test results, worker and senior sign-offs, itemised invoice and payment status.

Customer approval is attached to the exact final Jobcard/report revision. A request for changes reopens the correction process and must not issue the final invoice as though approved. After customer approval, issue the final itemised invoice. Payment is complete only when confirmed by the payment provider or reconciled by an authorised staff member. Archive the Jobcard after required approvals and payment/closeout conditions are satisfied. Preserve immutable quote revisions, approvals, messages and audit history.

## 7. Role boundaries

- **Customer:** sees their Jobcard, their own messages, issued quotes, confirmed booking, customer-visible Workcard updates, final report, invoice and payment history. Can accept/decline a quote, approve/request changes to final work, and approve/decline variations.
- **Worker:** sees only assigned Workcards and the customer/site information needed to perform them. Can accept assignment, record work, submit variations and sign off own work. Cannot approve own Workcard or see internal financial/admin information beyond what the role requires.
- **Senior staff/manager:** reviews scope, creates/sends quotes, confirms bookings, assigns workers, approves variations, reviews/signs off Workcards, authorises final Jobcard and invoice.
- **Accounts:** manages invoices and reconciled payments within granted permissions; cannot change technical sign-offs.
- **Administrator/owner:** manages business configuration and permissions. Server-side authorization is mandatory for every mutation; hidden buttons are not security.

Every approval records actor, role, timestamp, target record/revision and decision. Approval events are append-only; corrections are new events.

## 8. Page and layout system

### Public brand site
Preserve the existing Brandon RV identity (deep green, orange accent, warm neutral background and editorial serif display). Keep pages readable and responsive. Marketing pages must not inherit the admin navy palette.

### Authenticated product workspace
Use one shared shell, content width and spacing system across admin, customer and staff pages. The admin workspace uses the compact navy/blue operational palette defined in `DESIGN.md`; the customer portal retains the public brand palette while using the same structural spacing and control behavior.

- One page title and one primary action per page header. Do not repeat the same title in nested cards.
- Use compact filters/search above a stable data list or table. Put secondary actions in the row or detail view.
- Lists are summaries, not full forms. Never render every edit/work/approval form expanded inside every row.
- A record detail page has one consistent order: identity/status header; primary next action; customer/vehicle summary; current workflow step; linked documents; chronological activity; internal-only area for authorised staff.
- Keep one main content column for forms and one bounded list region only where the list itself needs scrolling. Long forms use natural document height. Never clip fields or create nested scroll traps.
- Use a consistent 12-column grid only where a real two-column relationship helps. Form fields use two columns on wide screens and one column on narrow screens. Related fields stay together. No arbitrary unequal card heights or empty decorative panels.
- Use compact, readable density: desktop controls typically 34–36px; important touch actions at least 44px on touch layouts. Body text remains legible; metadata never carries essential information alone.
- Reuse shared page headings, field labels, validation, buttons, status labels, empty/error states, dialogs, toasts and record timelines. No page-specific one-off styling where a shared owner exists.
- Use consistent status text and colour semantics. Colour is never the only status signal.
- No fixed-height page forms, horizontal overflow without an explicit scroll affordance, clipped actions, layout jumps when loading, or giant empty hero/card regions inside admin/portal.
- Printable Jobcard and Workcard use an A4-friendly document layout with repeated headers, legible tables and sensible page breaks. Print hides navigation, controls and private notes from customer copies.

### Navigation
- Admin navigation is grouped by daily work, finance and business configuration. Keep the active location obvious and labels stable.
- Customer navigation prioritises Jobcards/requests, quotes, bookings, vehicles, documents and invoices. Do not force customers to navigate separate silos to understand one job.
- Worker navigation prioritises Assigned Workcards, then time/leave tools permitted by role.
- Each page has one canonical list/parent route and a clear back destination. Preserve search/filter state when returning from a detail page.

## 9. Shared interaction behavior

- Mutations are pessimistic for quote decisions, booking confirmation, assignment, sign-offs, invoice issue, payment and archive. Show busy state; prevent double submission; only show success after server confirmation.
- On validation or server failure, preserve safe form values and show a specific inline error next to the action/field. Never show raw backend errors.
- Empty lists distinguish “nothing exists” from “no results match these filters”; filtered empty states offer Clear filters.
- Loading keeps layout dimensions stable. Stale requests cannot overwrite newer filters/results.
- Destructive/irreversible actions state the consequence and require confirmation where appropriate. Archive is reversible only by an authorised role and is audited.
- Internal notes and customer-visible messages use visibly distinct, server-enforced channels.
- Date/time is displayed in Australia/Sydney local time; money is AUD with tax treatment drawn from confirmed business settings.
- Keyboard focus is visible; every field has a label; errors are associated with fields; dialogs return focus to their trigger; all actions are keyboard/touch accessible.

## 10. Verification gate

A workflow is not complete because it typechecks or builds. Before release, verify:
- Every route in guest, customer, worker, senior and administrator roles.
- Correct access isolation for customers and worker assignments.
- Every state transition, including decline/archive, expiry, request changes, variation rejection, cancellation and reopening.
- Duplicate submissions, concurrent quote responses, stale data and server failures.
- Exactly one Workcard per accepted quote; Workcard creation does not wait for booking; booking confirmation links to the existing Workcard and never creates a duplicate; no work starts before setup approval, worker assignment/acceptance and confirmed booking.
- No customer-visible internal notes, supplier costs or private files.
- Customer and staff print output, A4 page breaks and private-field exclusion.
- Browser-rendered desktop, tablet and mobile widths; no overflow, uneven columns, clipped forms or overlapping actions.
- Keyboard focus, labels, errors, contrast and reduced-motion behavior.
- Database migration against a copy of existing data, including preservation of customers, vehicles, enquiries, quotes, jobs, invoices and payments.

Passing TypeScript/build is necessary but not sufficient. A page not rendered in a browser is not visually verified.
