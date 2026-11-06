# Brandon RV account system setup

The application owns customer identities, employee details and account access in the single \`public.users\` table. Supabase is database infrastructure only; application login does not use Supabase Auth.

## One user account for every person

Every person has one \`users\` row and one login. Every account permanently has \`primary_group = 'customer'\`. The user record contains first name, last name, date of birth, email, Argon2id password hash, phone, address, account status and profile details.

The \`user_role\` column is nullable:
- \`NULL\` means customer-only access.
- A role key such as \`apprentice\`, \`worker\`, \`manager\`, \`owner\` or \`website_developer\` is assigned to the user account itself.
- Owner and Website Developer are global administrators with unrestricted application access.

The global role catalogue is \`user_roles\`; its permission map is \`user_role_permissions\`. Role permissions are not scoped to a business membership.

## Optional employee addon

A person becomes an employee by activating employment details on their existing customer account. This does not create another user or login.

A null \`employment_status\` means the employee addon is not active. The addon stores employee number, job title, employment type, employment status, start and end dates, pay rate, pay frequency, payroll reference and notes, emergency contact details and employee notes.

Employee access requires an assigned user role and active employment. Leave, suspended and terminated employees do not retain ordinary employee access. Ending employment does not delete or suspend the customer account; the user's vehicles, quotes, bookings, work orders, history, invoices, payments and documents remain linked to the same user ID.

The \`customers\` and \`staff\` database views are compatibility views over \`users\`, not separate identity stores. Operational records remain separate records linked to the customer/user ID.

## Legacy role tables

Existing business_members.role values and named permission_groups are copied into the global role catalogue, and their role-level permissions are preserved. Member-specific extra permission-group assignments are deliberately not merged into shared roles because doing so could grant one employee's extra permissions to every employee with the same role. Review and reassign any such exceptional access using global user roles after migration. Runtime authentication and permission checks use users.user_role and user_role_permissions; legacy business-role tables are not used for runtime authorization and are retained only to avoid destructive changes to existing database dependencies.

## Required Vercel environment variables

- \`SUPABASE_URL\`: the Brandon RV Supabase project URL.
- \`SUPABASE_SERVICE_ROLE_KEY\`: the project service-role key. Server-side only.
- \`BRANDON_RV_SETUP_SECRET\`: one-time owner bootstrap protection.
- \`NEXT_PUBLIC_APP_URL\`: the deployed public application origin used to build account links.
- \`RESEND_API_KEY\` and \`EMAIL_FROM\`: optional transactional email delivery settings.

The preview branch needs its own Preview-target versions of the Supabase URL and service-role key. Redeploy after changing environment variables.

## First owner

The first owner is created as a normal customer identity with \`user_role = 'owner'\` and the employee addon fields attached to that same user row. The one-time bootstrap endpoint requires \`BRANDON_RV_SETUP_SECRET\` and refuses to create a second owner. The legacy initial-owner token page accepts owner setup tokens only; it rejects staff invitations.

Owner and Website Developer roles always receive unrestricted application permissions. Do not create a separate owner or developer account type.

## Customer account flows

- Customers register at \`/portal/register\` and sign in at \`/portal/sign-in\`.
- Registration creates one \`users\` row with \`primary_group = 'customer'\` and \`user_role = NULL\`.
- Registration collects name, date of birth, email, phone and password.
- Passwords are stored as Argon2id hashes. They cannot be decrypted or displayed.
- With Resend configured, registration requires email verification before sign-in.
- Without an email provider, registration activates the account immediately and clearly tells the customer that email verification and password-recovery email are unavailable.
- Password recovery is available at \`/portal/forgot-password\` and \`/portal/reset-password\` when email delivery is configured.
- Customer portal pages include Overview, Quotes, Bookings & Jobs, Vehicles, Documents, Invoices & Payments and My Details.

## Employee and role flows

- Open \`/admin/staff\` and select an existing customer account to hire.
- Add the employee's user role, job title, employee number, employment type and start date. Payroll and emergency-contact details can also be recorded.
- No staff invitation, staff registration or separate employee login exists.
- Employee details can be edited from the employee directory or the Employment section of the same customer profile.
- Assign global role permissions through \`/admin/roles\`. Custom roles are global user roles, not business membership roles.
- Owner and Website Developer retain unrestricted access, including access to all user profiles and records.
- Terminating employment removes ordinary employee permissions but preserves the customer's account and all customer records.

## Security model

- Sessions use opaque random tokens stored as SHA-256 hashes in \`user_sessions\`, delivered in HttpOnly, SameSite=Lax cookies.
- Passwords use Argon2id hashes.
- Registration and login attempts are rate-limited using \`login_attempts\`.
- Password reset and email verification tokens are random, hashed at rest, single-use and time-limited.
- Customer APIs derive ownership from the authenticated server-side session; client-supplied customer or user IDs are not trusted.
- The application accesses private customer and employee data through server-side Supabase service-role access only. Never expose the service key to the browser.
