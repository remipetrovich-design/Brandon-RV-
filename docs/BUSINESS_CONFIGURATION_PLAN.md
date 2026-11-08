# Brandon RV — Business Configuration Plan

## Purpose

Give Chris a straightforward place to manage the Brandon RV website and business information. The system manages the business; it does not attempt to document Chris's qualifications or generate a service catalogue on his behalf.

## Navigation

The admin navigation groups these tools under **Business Configuration**:

- Website editor
- Services
- Service areas
- Settings
- Email templates

## Phase 1 — Website editor

- Edit the seeded example website pages and their content fields.
- Edit page titles and SEO metadata.
- Preview unsaved draft content inside the admin editor.
- Save content without publishing it automatically.
- Publish or unpublish separately using the page publication control.
- Keep the public website connected to published database content.

Acceptance: Chris can edit a page, preview the draft, save it, and decide separately when it becomes public.

## Phase 2 — Services and service areas

### Services

- Create, edit and delete service entries.
- Manage service name, category, customer description and additional details.
- Set an optional starting price and customer-facing pricing note.
- Set display order.
- Activate/deactivate and publish/unpublish independently.
- Only active, published services appear on the public service catalogue and customer service selector.
- The initial live catalogue is empty. Chris adds the services Brandon RV actually offers.

### Service areas

- Create, edit and delete service-area entries.
- Manage area name, description, radius, suburbs, postcodes and travel fee.
- Set display order and publish/unpublish.
- Only published areas appear publicly.

Acceptance: edits to published services and service areas appear on the website and relevant customer-facing service selection. Draft entries remain private.

## Phase 3 — Consolidated Settings

Bring Business Profile and Business Settings into one Settings page.

- Public business name, brand line, phone, email and location.
- Enquiry availability.
- Minimum appointment notice.
- Operating hours and customer-facing business message.
- Shortcuts to Website Editor, Services, Service Areas and Email Templates.

The enquiry availability switch is enforced by the enquiry API. The appointment notice value is enforced when customers request an appointment. Existing email templates and integrations remain separate working features; this phase does not duplicate them.

## Data and rollout

- Preserve existing business, customer and operational records.
- Keep website page seed content as editable draft examples.
- Remove only the old unpublished service-plan seed rows so the live catalogue starts empty.
- Add optional service pricing and service-area suburb/postcode fields with a forward-only migration.
- Apply the migration through the existing Supabase migration workflow after the pull request is merged.
- Deploy through the existing Vercel production connection.

## Completion checks

- Admin pages load for users with the existing business-settings permission.
- Services can be created, edited, published, unpublished and deleted.
- Service areas can be created, edited, published, unpublished and deleted.
- Public pages show only published catalogue data.
- Draft website content is previewable and does not become public until published.
- Enquiry and appointment settings affect their respective customer APIs.
- Existing customer and operational records remain intact.
