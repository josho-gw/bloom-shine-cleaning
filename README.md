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
│   ├── Code.gs              # CRM API backend (auth, CRUD, notifications, digests)
│   └── Setup.gs             # One-time provisioning + admin property management
└── README.md
```

## Setup Guide

### 1. GitHub Pages (Hosting)

Hosted on GitHub Pages. Pushes to `main` auto-deploy.

### 2. Google Apps Script (CRM Backend)

Two script files work together. `Setup.gs` provisions the system; `Code.gs` runs it.

1. Create a **blank** Google Sheet
2. Go to **Extensions → Apps Script**
3. Create two script files in the editor:
   - Rename the default `Code.gs` and paste the contents of `google-apps-script/Code.gs`
   - Click **+** to add a new file, name it `Setup`, paste `google-apps-script/Setup.gs`
4. In the toolbar, select `setup` from the function dropdown and click **Run**
5. The script will prompt you for owner email, developer email, and a temporary password
6. It then automatically builds:
   - **CRM tabs:** Dashboard, Contacts, Estimates, Contracts, Invoices, Activity Log
   - **Admin tabs:** _Users, _Sessions, _Settings, _Audit (protected)
   - Formatted headers, dropdowns, conditional formatting, live dashboard formulas
   - Daily digest (7 AM) and weekly summary (Monday 8 AM) email triggers
   - Hourly session cleanup
   - Shares the sheet with the developer account
7. All sensitive config (emails, passwords, encryption salt) stored in **Script Properties** — never in code
8. Click **Deploy → New deployment → Web app** (Execute as: Me, Access: Anyone)
9. Copy the deployment URL

**Admin utilities** (run from the Apps Script editor):
- `viewConfig()` — view current configuration
- `updateConfig()` — modify a config property
- `rotateSecrets()` — rotate encryption salt + session secret (invalidates all sessions/passwords)
- `addUser()` — add a new admin user
- `resetPassword()` — reset a user's password

### 3. Admin Dashboard

The admin portal is at `admin.html` (linked in the site footer).

**Architecture:** All auth is server-side. The client holds only a session token. User accounts, passwords (salted SHA-256), and sessions are stored in protected Google Sheets tabs. Script Properties hold encryption secrets.

**Roles:**
- `developer` — Full access, protected account, cannot be modified by non-developers
- `owner` — Full business access including user management for future employees
- `staff` — Future employee access (stubbed)

**First login:** Enter the Apps Script URL, then sign in with the credentials set during setup. All new users are forced to change their password on first login.

**Features:**
- Overview with live stats and recent activity feed
- Contact, estimate, contract, and invoice data tables (all editable inline)
- Contact detail modal: click a name to see full history (contracts, invoices, notes)
- Invoice list with payment status highlighting + create invoice form + PDF export
- Invoices are never deleted — only archived (Void status) for audit trail
- User management: add/remove staff, reset passwords (developer + owner only)
- Forgot password: email-based 6-character reset code with expiry and attempt limits
- Settings: API connection, password management

The Apps Script URL is stored in browser localStorage (set once on first login).

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
