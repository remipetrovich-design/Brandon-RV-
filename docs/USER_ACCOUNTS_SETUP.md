# Brandon RV account system setup

The application owns customer and staff identities in the `public.users` table. Supabase is database infrastructure only; customer and staff login do not use Supabase Auth.

## Database

The Brandon RV Supabase project contains the business, customer, vehicle, enquiry, quote, appointment, job, invoice, payment and document tables, plus app-owned identity/session tables:

- `users`, `user_sessions`, `login_attempts`
- `email_verification_tokens`, `password_reset_tokens`
- `user_invitations`, `staff`, `business_members`
- `permissions`, `permission_groups`, `permission_group_permissions`, `member_permission_groups`

The seeded staff roles are Owner, Administrator, Manager, Technician, Office and Accounts. The Owner group has all 34 configured permissions; the other groups have their own permission sets. Owners can create custom roles and adjust permission assignments in `/admin/roles`.

The database uses RLS. The application accesses private customer and staff data through server-side Supabase service-role access only. Do not expose the service key to the browser.

## Required Vercel environment variables

- `SUPABASE_URL`: the Brandon RV Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the project service-role key. Server-side only.
- `BRANDON_RV_SETUP_SECRET`: a long random one-time secret used to create the first owner.
- `NEXT_PUBLIC_APP_URL`: the deployed public application origin used to build account links.
- `RESEND_API_KEY` and `EMAIL_FROM`: optional transactional email delivery settings.

The preview branch needs its own Preview-target versions of the Supabase URL and service-role key. Redeploy after changing environment variables.

## Create the first owner

1. Open `/initial-owner-setup`.
2. Enter the one-time setup code, owner name, email and a password of at least 12 characters.
3. The endpoint creates the first Owner user, staff profile and business membership. It refuses to create another owner.
4. Remove `BRANDON_RV_SETUP_SECRET` from Vercel after setup and redeploy.

Do not publish the setup code or leave it configured after the owner has been created.

## Customer account flows

- Customers register at `/portal/register` and sign in at `/portal/sign-in`.
- With Resend configured, registration requires email verification before sign-in.
- Without an email provider, registration activates the account immediately and clearly tells the customer that email verification and password-recovery email are unavailable. Customers should use an email address they can access.
- Password recovery is available at `/portal/forgot-password` and `/portal/reset-password` when email delivery is configured. Without email delivery, customers must contact Brandon RV for account recovery.
- Customer portal pages: Overview, Quotes, Bookings & Jobs, Vehicles, Documents, Invoices & Payments, and My Details.
- Customers can submit service enquiries, request appointments, manage their vehicle records, review issued quotes and accept or decline a quote. Appointment requests are not confirmed until Brandon RV approves the time.

## Staff and role flows

- Owners and administrators invite staff from `/admin/staff`.
- Staff roles are checked against the business permission groups. Custom roles can be created and assigned through `/admin/roles`.
- With email delivery configured, invitations are emailed. Without it, the admin screen displays the invitation URL so it can be shared manually. Invitation links expire after seven days.
- Staff activate their account at `/staff/accept-invitation` and choose a password.
- Staff and owners are routed to `/staff`; customers are routed to `/portal`.

## Security model

- Sessions use opaque random tokens stored as SHA-256 hashes in `user_sessions`, delivered in HttpOnly, SameSite=Lax cookies.
- Passwords use Argon2id hashes.
- Registration and login attempts are rate-limited using `login_attempts`.
- Password reset and email verification tokens are random, hashed at rest, single-use and time-limited.
- Customer APIs derive ownership from the authenticated server-side session; client-supplied customer or user IDs are not trusted.
