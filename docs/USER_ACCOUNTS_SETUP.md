# Brandon RV account system setup

The application owns all customer and staff identities in the single `public.users` table. Supabase is database infrastructure only; customer and staff login do not use Supabase Auth.

## Unified account database

Every person has one `users` row and one login. The row stores identity, email, password hash, contact details, customer address, employee details, profile image, account status, and two account-group columns:

- `primary_group`: `customer` or `staff`.
- `secondary_group`: optional `customer` or `staff`, allowing one person to hold both groups with the same login.

Permission roles such as Owner, Administrator, Manager, Technician, Office and Accounts remain in `business_members` and the permission-group tables. They are access-control roles, not separate accounts or account groups.

Customer and employee profile details are stored on `users`. The old `customers`, `staff` and `profiles` names are compatibility views over `users`, not separate identity tables. Customer and staff foreign keys now point to the same user ID. The business workflow tables remain separate records, including vehicles, enquiries, quotes, appointments, jobs, invoices, payments and documents.

The app also uses `user_sessions`, `login_attempts`, `email_verification_tokens`, `password_reset_tokens`, `user_invitations`, `business_members`, `permissions`, `permission_groups`, `permission_group_permissions` and `member_permission_groups`.

The Owner permission role has all 34 configured permissions; the other roles have their own permission sets. Owners can create custom roles and adjust permission assignments in `/admin/roles`.

The database uses RLS. The application accesses private customer and staff data through server-side Supabase service-role access only. Do not expose the service key to the browser.

## Required Vercel environment variables

- `SUPABASE_URL`: the Brandon RV Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the project service-role key. Server-side only.
- `BRANDON_RV_SETUP_SECRET`: optional legacy bootstrap protection. The current initial-owner flow uses a single-use, hashed invitation token stored in the database.
- `NEXT_PUBLIC_APP_URL`: the deployed public application origin used to build account links.
- `RESEND_API_KEY` and `EMAIL_FROM`: optional transactional email delivery settings.

The preview branch needs its own Preview-target versions of the Supabase URL and service-role key. Redeploy after changing environment variables.

## Create the first owner

A deployment operator creates one `user_invitations` row with `account_type='owner'`, `role='owner'`, a SHA-256 token hash and a short expiry. Share the resulting private `/initial-owner-setup?token=...` link with the intended owner. The page collects the owner's name, email and password; the API consumes the invitation once, creates the owner user and business membership, and starts the owner session. The owner's primary account group is `staff`; Owner authority is assigned through the business membership role. It refuses to create a second owner.

The invitation token is stored as a hash, expires after seven days and must not be published or reused. If the link is lost or expires, issue a new invitation through a trusted database operation.

## Customer account flows

- Customers register at `/portal/register` and sign in at `/portal/sign-in`.
- Customer registration creates one `users` row with primary group `customer`.
- With Resend configured, registration requires email verification before sign-in.
- Without an email provider, registration activates the account immediately and clearly tells the customer that email verification and password-recovery email are unavailable. Customers should use an email address they can access.
- Password recovery is available at `/portal/forgot-password` and `/portal/reset-password` when email delivery is configured. Without email delivery, customers must contact Brandon RV for account recovery.
- Customer portal pages: Overview, Quotes, Bookings & Jobs, Vehicles, Documents, Invoices & Payments, and My Details.
- Customers can submit service enquiries, request appointments, manage their vehicle records, review issued quotes and accept or decline a quote. Appointment requests are not confirmed until Brandon RV approves the time.

## Staff and role flows

- Owners and administrators invite staff from `/admin/staff`.
- A staff invitation can be accepted against an existing customer account. It adds the `staff` group to that same `users` row; it does not create another login or replace the customer's password.
- New staff accounts are created with primary group `staff`.
- Staff roles are checked against the business permission groups. Custom roles can be created and assigned through `/admin/roles`.
- With email delivery configured, invitations are emailed. Without it, the admin screen displays the invitation URL so it can be shared manually. Invitation links expire after seven days.
- Staff activate a new account at `/staff/accept-invitation`. Existing customers keep their existing password when staff access is added.
- Staff access is determined by the active business membership and permissions, not by the account-group columns alone. A dual-group user can access both the staff workspace and customer portal.

## Security model

- Sessions use opaque random tokens stored as SHA-256 hashes in `user_sessions`, delivered in HttpOnly, SameSite=Lax cookies.
- Passwords use Argon2id hashes.
- Registration and login attempts are rate-limited using `login_attempts`.
- Password reset and email verification tokens are random, hashed at rest, single-use and time-limited.
- Customer APIs derive ownership from the authenticated server-side session; client-supplied customer or user IDs are not trusted.
