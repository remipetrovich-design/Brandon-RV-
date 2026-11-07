# Brandon RV production setup

## Vercel environment

The Next.js server requires these production environment variables:

- `SUPABASE_URL` — the Brandon RV project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — the server-only Supabase service-role key. Never prefix this with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL` — the production website origin.
- `BRANDON_RV_SETUP_SECRET` — a long random one-time owner setup secret.
- `ORBITFS_MAIL_URL` — the base URL of the deployed OrbitFS Mail application.
- `BRANDONSRV_MAIL_API_KEY` — the send-only external-system API key created for Brandon RV in Mail Admin → External systems.
- `BRANDON_RV_MAIL_FROM` — the exact active mailbox address assigned to the Brandon RV external system.

Do not configure a Resend API key in Brandon RV. Resend credentials and provider delivery belong exclusively to the Mail System. Store the Mail API key only in the Brandon RV server environment; never expose it through a `NEXT_PUBLIC_` variable or commit it to source control.

### Mail System connection

1. Deploy the Mail System and confirm its `/api/mail` endpoint is reachable.
2. In Mail Admin → External systems, create an external system named `BrandonsRV`.
3. Assign the active sender mailbox that Brandon RV should use (for example, `brandonrvsystem@incendiarynetworks.cc`).
4. Copy the generated send-only API key. It is displayed once.
5. Set `ORBITFS_MAIL_URL`, `BRANDONSRV_MAIL_API_KEY`, and `BRANDON_RV_MAIL_FROM` in Brandon RV's Vercel server environment.
6. Redeploy Brandon RV and test account verification, password recovery, and enquiry notifications.

Brandon RV owns the email templates and generates the HTML and text content, including account links. The Mail System validates the assigned sender mailbox, sends the message through its configured provider, and records delivery activity against the Brandon RV external-system identity. The integration key has only the `mail:send` scope and cannot read mailboxes or administer the Mail System.

Set the variables for Production and Preview as appropriate. Do not commit secret values.

## First owner account

1. Set `BRANDON_RV_SETUP_SECRET` in Vercel.
2. Open `/setup` on the deployed site.
3. Enter the setup secret and create the owner account.
4. The owner is created as a normal customer identity with `primary_group = customer`, `user_role = owner` and employee details on the same user row.
5. The endpoint refuses to create a second owner. Remove `BRANDON_RV_SETUP_SECRET` from Vercel after setup.

Owner access does not depend on a business membership. Owner and Website Developer are global user roles with unrestricted application permissions.

## Automatic database migrations

The GitHub Actions workflow `.github/workflows/supabase-migrations.yml` applies pending migrations on pushes to `main` that change `supabase/migrations/**`.

Add these encrypted repository Actions secrets in GitHub:

- `SUPABASE_ACCESS_TOKEN` — scoped Supabase personal access token.
- `SUPABASE_DB_PASSWORD` — database password for the Brandon RV Supabase project.
- `SUPABASE_PROJECT_ID` — `thkxalrsklgademwrrlq`.

The migration workflow deliberately stops before linking or changing the database if any secret is missing.

## Authentication and user model

Brandon RV application accounts live in `public.users`; sessions, password reset tokens and email verification tokens are stored in Brandon RV tables. Supabase Auth is not used.

Every person has one customer account and one login. `users.user_role` is null for a customer-only account or contains a global user role for employee access. Employment details are an optional addon on the same user record. Hiring an existing customer does not create a second account; ending employment does not remove the customer's login or operational history.

Role permissions are stored in `user_roles` and `user_role_permissions`. Legacy business membership and permission-group tables remain for migration compatibility but are no longer used for runtime authorization. Staff invitations have been removed; the employee directory hires existing customer accounts.

The Next.js server uses the service-role key and performs user ownership and role/permission checks before reading or changing business records. Browser code must never access the service-role key or privileged tables directly.

## Vercel deployments

The Vercel project should be connected to this GitHub repository with Production Branch set to `main`. New commits to `main` then trigger Vercel builds and deployments. Confirm the deployment status in Vercel after the team connection is authorised.
