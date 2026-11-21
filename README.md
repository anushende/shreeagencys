# SHREE AGENCY Billing v3.12

Windows local Node.js/Express billing application.

## v3.4 updates
- Refreshed footer Address, Email and Contact icons with modern colored icon tiles.
- Applied DD/MM/YYYY formatting to all dates rendered in tables, invoice previews, reports, printed bills and shared PDFs. Native date pickers are tagged with the en-GB locale hint; their visual presentation can still follow the device/browser locale.
- Saved Invoice → Edit → Add Product opens the Choose Quantity dialog. The selected quantity is added to the edited invoice before it is saved; zero quantity is rejected.
- Removed the separate Category and Company filter dropdowns from Customer Panel. Products are grouped using expandable Category and Company dropdown-arrow sections, matching Admin Billing.
- Share now creates the PDF from the same complete invoice markup used for printing, including Subtotal, Discount, GST/Tax, Bill Total, Previous Pending and Grand Total according to Agency Settings. Customer Saved Bills also has a Share action.
- Profit Report now displays Date, Month, Product Name, MRP, Qty, Selling Rate, Sales Amount, Profit and Invoice together.
- Improved mobile layouts and touch targets for iPhone, Android and laptop/desktop screens.

## Start
1. Open CMD in this folder.
2. Run:
   ```bash
   npm install
   npm start
   ```
3. Open http://localhost:3000

## Important data note
Back up your existing `data.json` before updating. This release ZIP does not include or replace `data.json`; keep your existing file in the project folder so saved products, customers, invoices and settings remain available.

## Notes
- Enter the owner/agency email and contact details in Admin → Agency Settings, then save.
- Printed/shared bill totals follow the visibility options in Agency Settings.


## Version 3.5 updates
- Consistent DD/MM/YYYY date display; native date pickers use the en-GB locale where supported.
- P (purchase price) is muted on admin/retail product cards and remains hidden from customer billing.
- Customer, admin and retail product lists show all products by default with scrollable product panels and top Cart shortcuts.
- Admin bill cart includes a totals row including P total; retail bill cart includes per-column totals.
- Edit Saved Invoice > Add Product opens the Choose Quantity dialog before inserting the product.
- Customer profile bill list can be searched by invoice date.
- Shared/printed invoice includes complete customer details, invoice metadata, item-column totals and final totals.
- Agency settings control global welcome text/colours, invoice colours, and optional terms/signature.

### Preserve existing data
When updating an existing installation, keep your current `data.json` file. This release ZIP intentionally does not replace it.


## Version 3.6 updates
- Changed the agency's default name to SHREE AGENCY and made it editable; the name updates in the website header, welcome page, customer bill preview, footer, reports and final invoices.
- Added a manual agency-name text colour picker with black as the default. Text-colour settings now default to black unless changed by the admin.
- Added a Show Logo on Final Bill setting; uploaded agency logo appears on printed and shared bills when enabled.
- Reworked final invoice layout: customer name/mobile/address/GSTIN are grouped on the left, while invoice number/date/due date are grouped on the right. Item totals appear below their respective columns.
- Enforced the View Cart → Save Bill flow for customer, admin and retail billing. The cart page supports multiple products and quantity edits.
- Removed the repeated retail Total MRP / Discount / GST / Bill Total summary strip; totals remain in the item table's totals row.
- Edit Saved Invoice item table now shows Product, MRP, Rate, P, MFG, EXP, Qty and related fields without Category or Company in the cart.
- Added Deleted Bills archive. Deleting an invoice moves it to the archive and restores stock; the Deleted Bills panel provides a separate permanent-delete action.
- Improved shared PDF rendering to use the complete final invoice layout and wait for bill images before creating the PDF. On supported phones the PDF can be shared through the system share sheet (including WhatsApp); otherwise the PDF downloads for manual attachment.
- Print windows close after the print dialog finishes, returning the user to the invoice page.
- Date displays use DD/MM/YYYY and date inputs request the en-GB locale where supported.

## Data safety
This ZIP does not include `data.json`. Keep the existing `data.json` file in the new project root. Back it up before replacing or redeploying the project.


## Version 3.7 updates
- Removed the unused extra Admin Billing summary output; retained the actual invoice totals and per-column cart totals needed for billing. The repeated Retail Total MRP / Discount / GST / Bill Total summary strip remains removed; its item-table totals are retained.
- Repositioned Invoice No., Invoice Date and Due Date to the left/front of customer details in both the live bill preview and final printed/shared invoice. Customer Name and Mobile are shown together on the first customer line.
- Added a one-click **Set Black** option beside every Agency Settings colour picker.
- Admin Billing now has a dedicated vertical scrollbar for the bill cart, with a sticky table header. View Cart content also scrolls when the cart contains many products.
- In Admin Billing, entering a customer name that does not match a saved customer clears the previously auto-filled address, mobile number and GSTIN.
- Edit Saved Invoice product search/cart no longer shows Category or Company filters; the item table sequence is Product, MRP, Rate, P, MFG, EXP, followed by quantity and other editing columns.
- Improved PDF page-break handling. The WhatsApp/system-share PDF is generated from the same complete bill HTML used by Print, including customer details, invoice dates, product rows, totals, terms and signature according to settings.
- Confirmed DD/MM/YYYY formatting for rendered stock dates, invoice lists, customer profile bill dates, reports and printed/shared bills. Native date inputs request en-GB display; the browser/device may still control the visual date-picker presentation.
- Preserved Agency Settings features: gallery logo, show/hide logo, gallery welcome background, welcome colours/quote, and show/hide final bill Subtotal, Discount, GST/Tax, Bill Total, Previous Pending and Grand Total.
- Customer Profile → Bills date search remains available and matches DD/MM/YYYY as well as stored ISO dates.

## Updating safely
1. Back up your existing `data.json`.
2. Replace the application files with this release, but keep your existing `data.json` in the project root.
3. Run `npm install` and `npm start` locally, or push the updated files to your existing Render GitHub repository.

This ZIP intentionally does not contain `data.json`, so it will not overwrite your saved products, customers, invoices or settings.


## v3.13 data storage and backup

- Local Windows/Laptop: by default the app reads and writes `data.json` beside `server.js`. Keep this file when replacing website code.
- Render with a paid Web Service + Persistent Disk: attach a disk mounted at `/var/data` and set environment variable `DATA_DIR=/var/data`. The app then stores `/var/data/data.json`, which survives deploys/restarts.
- Render Free Web Services do not support Persistent Disks. On Free, filesystem JSON changes can be lost on restart/redeploy; use the in-app Download data.json Backup regularly and restore it when needed, or move to a persistent managed database.
- Admin > Agency Settings now has Download data.json Backup and Restore Backup. Restore overwrites the current dataset. Export files contain customer information and password hashes; store them privately and never commit them to a public GitHub repository.
- Laptop and Render do not automatically sync. Download a backup from the source, then log in as Admin on the destination and use Restore Backup. Take a backup of the destination first.
