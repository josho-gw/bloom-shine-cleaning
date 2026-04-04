# Bloom & Shine Cleaning Services — Website

A dynamic single-page website for **Bloom & Shine Cleaning Services LLC**, a Christ-centered cleaning and organization company serving Hall & Jackson County, GA.

---

## Features

- **Interactive Estimator** — 4-step wizard calculates ballpark cleaning cost by service type, square footage, frequency, and add-ons
- **Digital Service Agreement** — Replaces paper contracts with signature capture, PDF generation, and automatic CRM logging
- **Admin Dashboard** — Multi-user role-based portal with contacts, estimates, contracts, invoicing, and user management
- **Invoice Generator** — Branded PDF invoices with dynamic Venmo/Cash App payment links
- **Contact Form** — Submissions logged to Google Sheets CRM with instant email notifications
- **Automated Digests** — Daily (7 AM) and weekly (Monday 8 AM) email summaries with follow-up reminders
- **Online Booking** — Cal.com embed for self-service scheduling
- **Payment Integration** — Venmo & Cash App QR codes and deep links
- **Service Checklists** — Interactive room-by-room checklists for Standard, Deep, and Move In/Out services
- **Policies & Terms** — Business policies in collapsible accordions and digital contract flow

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (single page + admin portal) |
| Styling | Tailwind CSS v4 (browser CDN) + custom CSS |
| Typography | Google Fonts (Great Vibes, Montserrat, Inter) |
| Backend | Google Apps Script (web app → Google Sheets CRM + email) |
| PDFs | jsPDF + jspdf-autotable (client-side) |
| Signatures | signature_pad (canvas-based) |
| Booking | Cal.com (free tier embed) |
| Hosting | GitHub Pages |

**Zero build tools. Zero monthly cost. Zero server maintenance.**

## File Structure

```
websiteCode/
├── index.html              # Public-facing single-page site
├── admin.html              # Admin dashboard (multi-user login)
├── css/custom.css           # Brand palette, fonts, components
├── js/
│   ├── app.js               # Core: nav, data loading, checklists, contact form
│   ├── estimator.js         # Pricing estimator wizard
│   ├── contract.js          # Digital agreement + signature + PDF
│   ├── invoice.js           # Invoice generator + PDF
│   ├── admin.js             # Admin: auth, roles, dashboard, user management
│   └── sheets.js            # Google Apps Script integration
├── data/
│   ├── services.json        # Service definitions + pricing ranges
│   ├── checklists.json      # Room-by-room checklists
│   └── policies.json        # Policy text
├── assets/                  # Logos, QR codes
├── google-apps-script/
│   └── Code.gs              # Full CRM backend (auto-setup)
└── README.md
```

## Setup Guide

### 1. GitHub Pages (Hosting)

Hosted on GitHub Pages. Pushes to `main` auto-deploy.

### 2. Google Apps Script (CRM Backend)

The script auto-builds the entire CRM when you run `setup()`:

1. Create a **blank** Google Sheet (no tabs or headers needed)
2. Go to **Extensions → Apps Script**
3. Delete the default code, paste the contents of `google-apps-script/Code.gs`
4. **Configure:** Set `notificationEmail` and `devEmail` in the `CONFIG` block at the top
5. In the toolbar, select `setup` from the function dropdown and click **Run**
6. Authorize when prompted — the script will:
   - Rename the spreadsheet
   - Create 6 tabs: Dashboard, Contacts, Estimates, Contracts, Invoices, Activity Log
   - Format all headers, column widths, dropdowns, and conditional formatting
   - Build a live Dashboard with summary formulas
   - Set up daily digest (7 AM) and weekly summary (Monday 8 AM) email triggers
   - Share the sheet with the developer account
6. Click **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the deployment URL

### 3. Admin Dashboard

The admin portal is at `admin.html` (linked in the site footer).

**Roles:**
- `developer` — Full access, protected account
- `owner` — Full business access including user management
- `staff` — Future employee access (stubbed)

**First login:** Configure `ADMIN_CONFIG` in `js/admin.js` with account emails and a temporary default password before deploying. All users are forced to change their password on first login.

**Features:**
- Overview with live stats from Google Sheets
- Contact, estimate, contract, and invoice data tables
- Invoice generator with PDF export and payment link generation
- User management (add/remove staff, reset passwords)
- Settings: Google Sheets connection and password management
- Forgot password: email-based reset code via Apps Script

The Apps Script URL is configured in the admin Settings tab (stored in browser localStorage).

### 4. Cal.com (Online Booking)

1. Create a free account at [cal.com](https://cal.com)
2. Set up event types (e.g., "Walk-Through", "Cleaning Appointment")
3. Replace the booking placeholder with the Cal.com embed code

## Common Maintenance

| Task | How |
|------|-----|
| Change pricing | Edit `data/services.json` — `basePer100SqFt` is `[low, high]` per 100 sq ft |
| Add a service | Add entry to `services` array in `data/services.json` |
| Update policies | Edit `data/policies.json` — updates site and contract terms |
| Update contact info | Search `index.html` for phone/email, update all instances |

---

## Acknowledgments

Developed by **Josh Ondo**.

Technical assistance provided by [Claude](https://claude.ai) (Anthropic).

---

*"Whatever you do, in word or deed, do everything in the name of the Lord Jesus." — Colossians 3:17*
