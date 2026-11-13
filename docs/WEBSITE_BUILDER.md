# Brandon RV website editor

## Open the editor

Sign in to the staff/admin panel and open **Website pages**. Open the page you want to change. The visual editor uses Puck, an MIT-licensed drag-and-drop React editor.

## Editable page blocks

- Hero, headings, text, images and spacing
- FAQ lists and gallery grids
- Request-a-quote call-to-action
- Published services feed
- Published service-areas feed

Use the content blocks to change layout and presentation. Image blocks currently accept an image URL.

## Connected features are protected

The builder does not expose the operational forms or their schemas. The request-a-quote call-to-action always links to the existing `/request-quote` flow. It does not create a second form or alter enquiry submission.

The services and service-areas blocks read from the existing published database records. They are display-only in the builder. Create, approve, activate and publish service records through the Services admin page. Create and publish service-area records through the Service Areas admin page.

Bookings, quotes, customer records, enquiries, workcards and their API workflows remain in the existing admin panel. They are not editable page-builder components.

## Saving and publishing

Use **Save draft** in the visual editor to store draft content. It does not change the live page. When the page is ready, use the existing page publication control in the admin page list. Publishing copies the saved draft into the public page content and refreshes the public-site cache.

Draft saves, publishing and unpublishing are recorded in the business audit history.
