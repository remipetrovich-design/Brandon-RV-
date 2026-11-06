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

Global role permissions are stored in \`user_roles\` and \`user_role_permissions\`. Owner and Website Developer have unrestricted application access. Legacy business-membership and permission-group tables are retained for migration compatibility, but runtime authentication and permission checks no longer depend on business roles or business memberships.

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
- `NEXT_PUBLIC_APP_URL` — public application origin used for account links
- `RESEND_API_KEY` and `EMAIL_FROM` — transactional email configuration

## Business scope

The initial service model is mobile, appointment-based and focused on suitable minor non-structural caravan and motorhome interior repairs and accessories. Regulated, specialist or higher-risk work must not be offered unless the required competence, permissions and insurance have been confirmed. The application does not itself establish business licences, qualifications, insurer approvals or supplier agreements.

## Deployment

The application is configured for deployment through the connected hosting environment. Configure the production environment variables there separately from GitHub Actions migration secrets. A successful database migration run confirms the migrations were applied; it does not, by itself, confirm a production website deployment.
