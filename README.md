# Bloom & Shine Cleaning Services — Website

A dynamic single-page website for **Bloom & Shine Cleaning Services LLC**, a Christ-centered cleaning and organization company serving Hall & Jackson County, GA.

---

## Features

- **Interactive Estimator** — 4-step wizard calculates ballpark cleaning cost by service type, square footage, frequency, and add-ons
- **Digital Service Agreement** — Replaces paper contracts with signature capture, PDF generation, and automatic logging
- **Invoice Generator** — Creates branded PDF invoices with dynamic Venmo/Cash App payment links
- **Contact Form** — Sends inquiries to Google Sheets (CRM) and emails the owner
- **Online Booking** — Cal.com embed for self-service scheduling (placeholder until account is created)
- **Payment Integration** — Venmo & Cash App QR codes and deep links
- **Service Checklists** — Interactive room-by-room checklists for Standard, Deep, and Move In/Out services
- **Policies & Terms** — All business policies in collapsible accordions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (single page) |
| Styling | Tailwind CSS v4 (browser CDN) + custom CSS |
| Typography | Google Fonts (Great Vibes, Montserrat, Inter) |
| Backend | Google Apps Script (web app → Google Sheets + email) |
| PDFs | jsPDF + jspdf-autotable (client-side) |
| Signatures | signature_pad (canvas-based) |
| Booking | Cal.com (free tier embed) |
| Hosting | GitHub Pages |

**Zero build tools. Zero monthly cost. Zero server maintenance.**

## File Structure

```
websiteCode/
├── index.html              # Public-facing single-page site
├── admin.html              # Admin dashboard (passcode-protected)
├── css/custom.css           # Brand palette, fonts, components
├── js/
│   ├── app.js               # Core: nav, data loading, checklists, contact form
│   ├── estimator.js         # Pricing estimator wizard
│   ├── contract.js          # Digital agreement + signature + PDF
│   ├── invoice.js           # Invoice generator + PDF
│   ├── admin.js             # Admin dashboard: login, tabs, data views
│   └── sheets.js            # Google Apps Script integration
├── data/
│   ├── services.json        # Service definitions + pricing ranges
│   ├── checklists.json      # Room-by-room checklists
│   └── policies.json        # Policy text
├── assets/                  # Logos, QR codes
├── google-apps-script/
│   └── Code.gs              # Apps Script source (deployed separately)
└── README.md
```

## Setup Guide

### 1. GitHub Pages (Hosting)

The site is hosted on GitHub Pages. Any push to the `main` branch auto-deploys.

### 2. Google Apps Script (CRM Backend)

To connect the contact form, estimator, and contract system:

1. Create a new Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Create three tabs: **Contacts**, **Estimates**, **Contracts**
3. Go to **Extensions → Apps Script**
4. Delete the default code and paste the contents of `google-apps-script/Code.gs`
5. Click **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL
7. Open `js/sheets.js` and set:
   - `scriptUrl` to your deployment URL
   - `enabled` to `true`
8. Commit and push

### 3. Admin Dashboard

The admin portal is at `admin.html` (linked in the footer). Default passcode is `bloom2025` — change it immediately on first login via Settings.

The admin dashboard provides:
- Overview with stats from Google Sheets
- Contact, estimate, and contract data tables
- Invoice generator with PDF export and payment link generation
- Settings for Google Sheets connection and passcode management

The Apps Script URL is configured in the admin Settings tab (stored in `localStorage`).

### 4. Cal.com (Online Booking)

1. Create a free account at [cal.com](https://cal.com)
2. Set up event types: "Walk-Through (15 min)" and "Cleaning Appointment"
3. Replace the placeholder in the Booking section with the Cal.com embed code

## Common Maintenance Tasks

### Change pricing
Edit `data/services.json`. The `basePer100SqFt` array is `[low, high]` — the price range per 100 square feet.

### Add a new service
Add a new entry to the `services` array in `data/services.json`. Add a corresponding checklist in `data/checklists.json` if needed.

### Update policies
Edit `data/policies.json`. Changes appear immediately on the site and in the contract terms.

### Update contact info
Search `index.html` for the phone number or email and update all instances.

---

## Acknowledgments

Developed by **Josh Ondo**.

Technical assistance provided by [Claude](https://claude.ai) (Anthropic).

---

*"Whatever you do, in word or deed, do everything in the name of the Lord Jesus." — Colossians 3:17*
