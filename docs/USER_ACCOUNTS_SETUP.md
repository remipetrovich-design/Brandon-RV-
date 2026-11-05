# Brandon RV account system setup

The application now owns customer and staff identities in the `public.users` table. Supabase is used as database infrastructure only; the account flow does not use Supabase Auth.

## Required Vercel environment variables

Set these for the Brandon RV application:

- `SUPABASE_URL`: the Brandon RV Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the project service-role key. Server-side only; never expose it as a `NEXT_PUBLIC_` variable.
- `BRANDON_RV_SETUP_SECRET`: a long random one-time secret used to create the first owner.
- `NEXT_PUBLIC_APP_URL`: the deployed public application URL, used in staff invitation links.

Redeploy after setting the variables.

## Create the first owner

Before opening customer registration, make one POST request to `/api/auth/bootstrap-owner` with the setup secret in the `x-setup-secret` header and JSON containing `fullName`, `email`, and a password of at least 12 characters. This endpoint refuses to create a second owner. After successful setup, remove `BRANDON_RV_SETUP_SECRET` from Vercel and redeploy.

## Basic account flows

- Customers register at `/portal/register`, then sign in at `/portal/sign-in`.
- Staff invitations are created from `/admin/staff` by an active owner or administrator. The invitation link is shown once and expires after seven days.
- Staff activate their account at `/staff/accept-invitation`, choose a password, and are assigned their business role.
- Staff and owners land in `/staff`; customers land in `/portal`.
- Sessions use opaque random tokens stored as SHA-256 hashes in `user_sessions`, delivered in HttpOnly cookies. Passwords use Argon2id hashes.
- Customer and staff account tables are protected by RLS and are only accessed by the server using the private service key. The browser never receives that key.

## Current scope

Customer registration, login, logout, session checks, owner bootstrap, staff invitations and staff activation are implemented. Password-reset token storage exists, but password-reset email delivery and the reset UI are not yet connected. Email verification and outbound invitation email are also not connected; invitations must currently be shared using the one-time link shown by the admin screen.
