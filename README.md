# Brandon RV

Brandon RV is a mobile caravan and motorhome interior repair and accessories business based in Tamworth, NSW. This repository contains the public website, customer portal and shared staff/admin application.

## Application

- Public business website and service information
- Customer registration, sign-in and account portal
- Customer vehicle records and appointment requests
- Quotes, invoices and customer job information
- Staff workspace, work orders and job assignment
- Business administration, service catalogue and service-area settings
- Role- and permission-based access for staff and administrators

The application is built with Next.js 16, React 19, TypeScript and Supabase.

## Account and database model

The \`public.users\` table is the single account identity table. Every person has one customer account, one login and \`primary_group = customer\`. The nullable \`user_role\` field defaults to \`NULL\`, which means customer-only access. Owner, Website Developer and other employee roles are assigned directly to the user account through the global user-role catalogue.

Employment is an optional addon on the same user row. It stores employment type/status, job title, employee number, start/end dates, pay rate and frequency, payroll details, emergency contacts and employee notes. Hiring an existing customer activates these fields; it never creates another account. Terminating employment removes ordinary employee access but preserves the customer login and all customer data.

Vehicles, enquiries, quotes, appointments, jobs, invoices, payments and documents remain separate operational records linked to the same user/customer ID. The customer and employee screens are different views of that one identity.

Global role permissions are stored in \`user_roles\` and \`user_role_permissions\`. Owner and Website Developer have unrestricted application access. Legacy business-membership and permission-group tables are retained for migration compatibility, but runtime authentication and permission checks no longer depend on business roles or business memberships. Role-level and member-specific permissions are migrated into global roles; distinct effective permission sets receive separate shared synthetic roles so one employee's extra permissions are not granted to everyone with the same base role.

## Supabase migrations

Database migrations are stored in `supabase/migrations/` and are applied through the GitHub Actions workflow:

`.github/workflows/supabase-migrations.yml`

### GitHub Actions secrets

Add these as repository Actions secrets:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token used by the Supabase CLI |
| `SUPABASE_DB_PASSWORD` | Database password for the target Supabase project |
| `SUPABASE_PROJECT_ID` | Supabase project reference |

The configured project reference is `thkxalrsklgademwrrlq`.

**Migration status:** The production migration workflow has been run successfully. The required GitHub Actions secrets were recognised and the database migrations completed successfully.

Do not commit access tokens, database passwords, service-role keys or other credentials to this repository.

## Local development

Requirements: Node.js and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the required values in `.env.local` before using application features that connect to Supabase or send email.

Available scripts:

- `npm run dev` — start the local development server
- `npm test` — run the user-role access policy tests
- `npm run typecheck` — run the TypeScript check
- `npm run build` — create a production build
- `npm run start` — start the production server

## Environment variables

See `.env.example` for the supported configuration:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role key; never expose it with a `NEXT_PUBLIC_` prefix
- `BRANDON_RV_SETUP_SECRET` — optional legacy owner-bootstrap secret
- `NEXT_PUBLIC_APP_URL` — public application origin used for account and invitation links; production is `https://brandon-rv.vercel.app`
- `ORBITFS_MAIL_URL` — base URL of the connected OrbitFS Mail service
- `BRANDONSRV_MAIL_API_KEY` — Brandon RV Mail System API key; keep server-side only

## Transactional email and staff invitations

The production website origin is **https://brandon-rv.vercel.app**. Set `NEXT_PUBLIC_APP_URL` to this exact origin in the Vercel production environment. Account verification, password reset and staff invitation links use this configured origin, with the production URL as the safe fallback; they must not be generated from an API request host or preview deployment.

Transactional mail is sent through the existing OrbitFS Mail integration. Configure `ORBITFS_MAIL_URL` and `BRANDONSRV_MAIL_API_KEY` in the Vercel environment. The email-template admin page is available under Admin → Business configuration → Email templates and requires `business.settings.manage`.

Administrators can create, edit and delete custom templates, attach templates to registered application events/functions, enable or disable eligible templates, and select a sender mailbox from the live sender assignments returned by OrbitFS Mail. Sender mailbox IDs are checked against the current Mail System directory before sending. Required account-security templates cannot be disabled, moved to another event or deleted.

The shared email renderer applies Brandon RV branding to automated and manually-triggered template emails: branded header with the business logo and tagline, message content, and footer with logo, website, phone and email contact details, privacy/sensitive-information handling notice and copyright. Messages sent from a `noreply` mailbox display an additional notice at the top stating that the mailbox is unmonitored and replies or messages sent to it will not be read. The current shared logo asset is `public/brv-mark.webp`.

### Staff invitation flow

Staff invitations are created by authorised staff administrators from People/Staff management. Each invitation is single-use, expires after seven days and is tied to the invited email address and selected staff role. The invitation email uses the managed `staff_invitation` template and links to:

`https://brandon-rv.vercel.app/portal/accept-staff-invitation?token=...`

If the invitee already has an active customer account, they sign in with that account and accept the invitation; staff access is added to the existing identity without replacing customer records or history. If they do not have an account, they register as a customer using the invited email address. Email verification, when enabled, carries the invitation token forward; after verification they return to the invitation acceptance page. The invitation is validated again at acceptance, including email match, expiry, revocation and single-use status. The new account remains a customer account with staff access added as an employment/role extension.

## Business configuration

The Business Configuration area is the control centre for the public business website and its customer-facing details.

- **Website editor:** edit the seeded example pages, preview draft content and save changes. Publishing is a separate action, so saved drafts do not automatically change the live website.
- **Services:** create, edit, organise, price, activate, publish and delete the services Brandon RV chooses to offer. The live catalogue starts empty; Chris manages the actual service list.
- **Service areas:** manage area names, descriptions, radius, suburbs, postcodes, travel fees and publication status.
- **Settings:** manage the public business profile and general operating preferences from one consolidated page.
- **Email templates:** remains a separate tool for managing automated and customer email content.
- **Integrations:** shows the status of existing connected services, including the OrbitFS Mail System, without exposing credentials.

Service and area changes are stored against the Brandon RV business and flow to the public service pages and customer-facing service selection where applicable. Draft or unpublished entries remain hidden from the public website. Existing customer, job, quote, appointment, invoice and account records are retained.

The business owner decides which services Brandon RV offers and manages the catalogue directly. The application does not create a résumé or infer a service list from the business plan.

## Deployment

The application is configured for deployment through the connected hosting environment. Configure the production environment variables there separately from GitHub Actions migration secrets. A successful database migration run confirms the migrations were applied; it does not, by itself, confirm a production website deployment.


## Customer intake, tickets, quotes and bookings

The public Contact page records **General Enquiries** separately from quote requests. General enquiries are not automatically converted into tickets, quotes or bookings.

The public Request a Quote form is available without registration. Guest requests receive a Request Quote ID and a secure access link/code. Signed-in customers can reuse their account details and select a saved vehicle; a newly entered vehicle is added to their vehicle list. Customer Enquiries are created from the customer portal and use the same ticket conversation system.

Customer Enquiries and Quote Requests are ticket-backed records. Customers and staff can exchange messages against the ticket; staff can add internal-only notes. Guest quote requests use a time-limited access token and do not require a customer login. Quotes are attached to tickets where applicable, support revision history, and record customer acceptance or decline with a timestamp.

A preferred appointment time is only a request. A confirmed Booking requires an accepted quote and the agreed date, start/end time and service location. Confirming the Booking creates the existing job record as a Pending Work Order. The customer and staff/admin interfaces remain views over the same user identity and Supabase database.

The migration for this workflow is applied through the existing production Supabase migration workflow after it is merged to main. No production database change is made by creating the feature branch or pull request.


## Owner configuration and launch readiness (Phase 6)

The owner-facing Business Configuration area supports public business details, draft website content with preview and separate publishing, service areas, email templates and sender assignments, integrations, role permissions, booking availability, cancellation settings and pricing/GST configuration. Booking days, hours and unavailable dates are enforced when configured. Rates and GST remain unconfigured until Chris confirms them with the accountant; the business-plan figures are not treated as approved prices.

Services have an explicit approval status: Approved for launch, Conditional, Assessment required, Deferred or Not offered. Only active, published services approved for launch are exposed to customers. Newly created services default to Assessment required and cannot be published until explicitly approved.

The Phase 6 migration adds this service approval gate. It is forward-only and is applied by the existing Supabase migration workflow after the pull request is merged. Do not apply it manually to production while the change is under review.

## Launch readiness (Phase 7)

The production build must complete successfully before the application is considered deployable. Customer account isolation, staff permissions, quote approval, confirmed booking creation, Work Order generation, invoices, payment provider confirmation, email delivery, private file access and backup recovery still require operational verification before real customer use. Some checks require Chris to use the customer and staff interfaces; those are not represented as completed by a successful build.
