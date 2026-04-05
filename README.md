# Bloom & Shine Cleaning Services — Website

A dynamic single-page website for **Bloom & Shine Cleaning Services LLC**, a Christ-centered cleaning and organization company serving Hall, Jackson & Gwinnett County, GA.

---

## Features

**Public Site:**
- **Unified Booking Flow** — Agreement → Payment → Schedule in a single multi-step modal
- **Interactive Estimator** — 4-step wizard (service → sq ft → frequency → add-ons → ballpark range). Service cards auto-open with pre-selection.
- **Digital Service Agreement** — Signature capture, PDF generation, auto-logged to CRM
- **Contact Auto-Capture** — Client data saved to CRM as soon as booking modal step 1 completes
- **Payment Modal** — Venmo/Cash App QR codes + deep links (standalone for returning clients)
- **FAQ** — Concise Q&A replacing full policy accordion
- **Terms of Use & Privacy Policy** — Georgia-compliant, tabbed modal (UETA/ESIGN, OCGA liability, Hall County jurisdiction)
- **Service Checklists** — Room-by-room interactive checklists
- **Scroll Animations** — Reveal-on-scroll, staggered card animations

**Admin Dashboard:**
- **Overview** — CRM stats, recent activity feed, financial summary (MTD/YTD)
- **Data Tables** — Contacts, Estimates, Contracts, Invoices with per-table search + sortable columns
- **Contact Detail Modal** — Unified timeline (contracts + invoices), status indicators, add notes, log lost contracts
- **Invoice Management** — Oldest-first list, status filters (All/Unpaid/30+ Days/Paid), row highlighting, archive-only (no delete)
- **Finance & Accounting** — General ledger, expense tracking, YTD/MTD summaries, auto-ledger from invoice payments
- **User Management** — Role-based (developer/owner/staff), add/remove users, password resets
- **Server-Side Auth** — Salted SHA-256, session tokens, forced password change, forgot password via email

**Backend (Google Apps Script):**
- Three separate workbooks: CRM, Admin, Financials
- Full CRUD API with role-based access control
- Daily digest (7 AM) and weekly summary (Monday 8 AM) emails
- Activity logging + security audit trail
- Hourly session cleanup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (single page + admin portal) |
| Styling | Tailwind CSS v4 (browser CDN) + custom CSS |
| Typography | Google Fonts (Great Vibes, Montserrat, Inter) |
| Backend | Google Apps Script → 3 Google Sheets workbooks |
| PDFs | jsPDF + jspdf-autotable (client-side) |
| Signatures | signature_pad (canvas-based) |
| Booking | Cal.com free tier (placeholder — to be integrated) |
| Hosting | GitHub Pages |

**Zero build tools. Zero monthly cost. Zero server maintenance.**

## File Structure

```
websiteCode/
├── index.html              # Public site — Hero, About, Services, Estimator, FAQ, Book, Contact
├── admin.html              # Admin dashboard (multi-user, role-gated)
├── css/custom.css           # Brand palette, animations, responsive (480px + 768px breakpoints)
├── js/
│   ├── app.js               # Nav, data loading, checklists, contact form, scroll reveal, modals
│   ├── estimator.js         # Pricing wizard + service card auto-select
│   ├── contract.js          # Booking flow: agreement → payment → schedule → complete
│   ├── invoice.js           # Invoice PDF generator + payment links
│   ├── admin.js             # Auth, CRUD tables, search, sort, contact detail, finance, users
│   └── sheets.js            # API integration (auto-loads URL from admin settings)
├── data/
│   ├── services.json        # Service definitions + pricing ranges
│   ├── checklists.json      # Room-by-room cleaning checklists
│   └── policies.json        # Policy text (used in contract terms review)
├── assets/                  # Transparent logos, QR codes
├── google-apps-script/
│   ├── LiveSite.gs          # API: auth, CRUD, notifications, digests, auto-ledger
│   └── Admin.gs             # Setup, provisioning, config management, user admin
└── README.md
```

## Setup Guide

### 1. GitHub Pages

Pushes to `main` auto-deploy.

### 2. Google Apps Script

`Admin.gs` provisions the system. `LiveSite.gs` runs the API.

Setup creates three workbooks:
- **CRM** — Dashboard, Contacts, Estimates, Contracts, Invoices, Activity Log
- **Admin** — _Users, _Sessions, _Settings, _Audit (protected)
- **Financials** — Ledger, Categories (chart of accounts), Financial Dashboard

Steps:
1. Create a blank Google Sheet → Extensions → Apps Script
2. Add two script files: `LiveSite` and `Admin`
3. Run `setup()` — prompts for owner email, dev email, temp password
4. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone)
5. Copy URL → admin dashboard Settings tab

All secrets stored in Script Properties. No credentials in code.

### 3. Admin Dashboard

Access at `admin.html`. Roles: `developer` (protected), `owner` (full business access), `staff` (stubbed).

### 4. Cal.com (Pending)

Online scheduling integration — placeholder in booking flow step 5. To be connected when owner creates Cal.com account.

## Maintenance

| Task | How |
|------|-----|
| Change pricing | Edit `data/services.json` |
| Add a service | Add to `services` array in `data/services.json` |
| Update policies | Edit `data/policies.json` |
| Update contact info | Search `index.html` for phone/email |
| Deploy backend changes | `npx @google/clasp push --force && npx @google/clasp deploy -i <ID> -d "description"` |
| Deploy frontend changes | `git push` (auto-deploys via GitHub Pages) |

---

## Acknowledgments

Developed by **Josh Ondo**.

Technical assistance provided by [Claude](https://claude.ai) (Anthropic).

---

*"Whatever you do, in word or deed, do everything in the name of the Lord Jesus." — Colossians 3:17*
