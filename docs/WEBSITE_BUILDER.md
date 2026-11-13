# Brandon RV website editor

## Open the editor

Sign in to the staff/admin panel and open **Website pages**. Open the page you want to change. The visual editor uses Puck, an MIT-licensed drag-and-drop React editor.

## Editable page blocks

- Hero, headings, text, images and spacing
- FAQ lists, process steps and gallery grids
- Request-a-quote call-to-action
- Published services feed
- Published service-areas feed

Use these blocks to change layout and presentation. Image blocks currently accept an image URL.

## Protected, movable business components

Chris can drag these components into a page and move them up or down without changing how they work:

- **Request a Quote form** — the real existing quote-request form, including vehicle details, saved customer vehicles, attachments, guest access, and the current enquiry-to-quote workflow.
- **General Enquiry form** — the real existing general-enquiry form, including customer profile prefill when signed in.
- **Services feed** — reads active, approved and published service records from the existing service catalogue.
- **Service Areas feed** — reads published service-area records from the existing service-area manager.
- **Request a Quote button** — links to the existing `/request-quote` page.

The form components have no editable field definitions in the page builder. In the editor preview, their submit buttons are disabled so testing layout cannot create real enquiries. The published page uses the normal live form behaviour. Their field names, validation, API calls, submission types, database records, permissions and admin workflows stay in the existing application code. Chris can position a form block, but cannot redesign its schema or redirect its submission flow from the builder.

Create, approve, activate and publish service records through the Services admin page. Create and publish service-area records through the Service Areas admin page. The builder only displays published records; it cannot create or change them.

Bookings, quotes, customer records, enquiries, workcards and their API workflows remain in the existing admin panel. They are not editable page-builder components.

## Saving and publishing

Use **Save draft** in the visual editor to store draft content. It does not change the live page. When the page is ready, use the existing page publication control in the admin page list. Publishing copies the saved draft fields into the live page content and refreshes the public-site cache.

Draft saves, publishing and unpublishing are recorded in the business audit history.
