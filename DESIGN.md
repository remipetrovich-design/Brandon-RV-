# Brandon RV — Design System

## Product context
A mobile caravan and motorhome interior repair business based in Tamworth, NSW. The public website earns trust and gathers accurate vehicle/job information. The authenticated workspace moves repair work through assessment, quotation, booking, technician execution, approvals and final customer handover.

## Visual direction
Use a practical workshop-office language: precise, calm, technical and approachable. Navy is the structural colour; blue marks primary actions and active navigation. White surfaces and cool neutral backgrounds keep records legible. Avoid oversized cards, decorative gradients in operational screens, oversized controls and inconsistent spacing.

## Tokens
- Navy: `#10283F` — navigation, headings, strong surfaces.
- Blue: `#1767AD` — primary actions, links and active states.
- Pale blue: `#EAF3FA` — selected states and low-emphasis callouts.
- Page neutral: `#F5F7F8` — workspace background.
- Surface: `#FFFFFF` — cards, forms and documents.
- Border: `#DBE4EC` — separators and control outlines.
- Muted: `#65788B` — secondary information.
- Danger: use a clear red semantic token for destructive or blocked actions; never rely on colour alone.

## Typography and density
- Primary family: Segoe UI, Arial, sans-serif.
- Headings: 600–800 weight, tight tracking, compact line-height.
- Body: 12–14px for dense operational content; 14–16px for customer-facing explanations.
- Labels and metadata: 10–11px, readable contrast.
- Admin controls: 36px standard height; primary touch actions may be taller where required.
- Spacing: 4px base rhythm; 8/12/16/20/24px common increments.
- Radius: 6–10px for controls and operational panels.

## Layout
- Admin navigation is persistent and narrow enough to preserve workspace width.
- Admin content uses a clear page title, one primary action, then compact filters and records.
- Long forms remain natural-height and document-scrollable.
- Data lists use stable rows, clear status text and direct record actions.
- Customer documents are printable and use a calmer, wider reading layout than staff forms.

## Interaction contract
- Every action is a real button; every navigation is a link.
- Buttons state the actual outcome: Save quote, Assign technician, Submit workcard, Approve completion.
- Save actions preserve input after errors and prevent duplicate submission.
- Internal notes are never customer-visible.
- A scope or price variation requires explicit customer approval before additional work begins.
- Worker completion and senior review are separate sign-offs.
- Customer approval is recorded against the exact final jobcard/invoice revision.
- Do not make a preferred appointment request look like a confirmed booking.
- Do not advertise conditional, deferred or excluded service categories as bookable.
