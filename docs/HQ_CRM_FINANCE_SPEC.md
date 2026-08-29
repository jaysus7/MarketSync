# MARKETSYNC HQ — ADD-ON: CUSTOMER CRM + REVENUE, BUDGETING, EXPENSES & RECEIPT MANAGEMENT

Extend the MarketSync HQ implementation described in the previous specification.
Do NOT replace or restart the previous Website Control Plane / Discovery Engine / CMS work.
MarketSync HQ also needs to become the business operating system for MarketSync itself.
This is an additional permanent requirement.

The goal is that I should not need separate spreadsheets to understand how MarketSync is performing financially or where customers came from.

Two major systems need to be expanded:
1. Customers / CRM / Lead Attribution
2. Finance / Revenue / Budgets / Expenses / Receipts

---

## 1. ADD CUSTOMERS AS A PRIMARY HQ SECTION

This CRM belongs to MarketSync HQ. This is MarketSync’s internal CRM for selling MarketSync.
Do NOT confuse this with dealership CRM data inside DealerOS.

Include tabs:
├── Overview
├── Leads
├── Opportunities
├── Customers
├── Subscribers
├── Trials
├── Companies
├── Contacts
├── Activity
├── Sources
├── Campaign Attribution
├── Consent
└── Imports

---

## 2. CANONICAL CUSTOMER ARCHITECTURE

These objects can be linked but must NOT all be stored as the same thing. Separate these entities correctly:

- **Contact**: An individual person.
  * name
  * email
  * phone
  * job title

- **Company / Account**: The dealership or business they work for.
  * dealership name
  * dealer group
  * website
  * address
  * number of locations
  * account owner

- **Lead**: A potential sales relationship / inbound inquiry.
  * first-touch source
  * last-touch source
  * campaign
  * ad group
  * ad
  * keyword where available
  * landing page
  * referrer
  * UTM parameters

- **Opportunity**: A possible MarketSync sale with:
  * product
  * subscription plan
  * expected value
  * probability
  * expected close date
  * stage
  * salesperson
  * customer segment

- **Customer**: A paying MarketSync account.
  * authenticated user ID
  * primary contact
  * product
  * subscription status
  * account owner

- **Trial**: A trial user/account.
- **Subscriber**: Recurring subscription record.
- **User**: Authenticated user.

---

## 3. LEAD INGESTION & SOURCES

All inbound MarketSync leads should flow into this system.
Sources include:
* website contact forms
* pricing forms
* chatbot leads
* free trials
* demo requests
* Google Ads lead forms
* Facebook Lead Ads
* Instagram Lead Ads
* LinkedIn leads
* affiliate referrals
* n8n workflows
* manually entered leads
* imported CSV leads

Architecture:
Website / Forms / Ads / Chat / Trials
        ↓
Lead Ingestion Layer
        ↓
Duplicate Detection
        ↓
Identity Resolution
        ↓
Contact + Company + Lead
        ↓
Opportunity created
        ↓
Sales + Marketing + Automations

---

## 4. DEDUPLICATION & IDENTITY RESOLUTION

Do not create five customer records because the same person:
* filled out a form
* started a trial
* subscribed to email
* later became a customer

Maintain source history. Never lose the original attribution when records merge.

---

## 5. CUSTOMER 360 VIEW

Create a complete customer profile.
Example:
John Smith
General Manager
ABC Chevrolet
Account Status: Prospect

Timeline:
- First Touch: Google Ads
- Demo request submitted
- Demo booked
- Sales call logged
- Proposal sent
- Opportunity created
- Subscription started
- Payment received
- Subscription upgraded
- Support ticket opened
- Subscription cancelled

Every system should write activities into the canonical timeline where appropriate.

---

## 7. ATTRIBUTION & MARKETING ROI

Show revenue attribution. Do not calculate ROAS from leads alone — calculate from revenue.
Example:
Google Ads
- Spend: $1,200
- CAC: $537
- Revenue: $5,016
- ROAS: 4.18x

Break it down by:
* source
* campaign
* ad group
* ad
* landing page
* partner / affiliate

---

## 9. FINANCE OVERVIEW (COMMAND CENTER)

Create a financial command center.
The objective is operational financial management. It is NOT necessary to replace a professional accountant or certified accounting platform immediately.

Show:
- August Revenue
- Revenue YTD
- Expenses This Month
- Net Operating Income
- Projected Month End
- Projected Year End
- Budget Remaining
- Commission Liability
- Affiliate Liability

Break it down by:
* product (DealerOS Core $8,994, DealerOS Pro $14,994, DealerOS Complete $19,995, Marketing Suites $3,486, MarketSync Digital $5,391)
* New MRR / Downgrade MRR
* usage revenue
* one-time revenue (Do not count one-time revenue as MRR)
* discounts / refunds

---

## 10. REVENUE MANAGEMENT

Include tabs:
├── Overview
├── Invoices
├── Payments
├── Subscriptions
├── Forecast
├── Reports
└── Tax

Track:
* date
* customer
* product / price
* amount
* discounts
* refunds
* HST / tax
* forecast
* same month previous year where data exists

Do not duplicate payments if webhook retries occur.

---

## 12. EXPENSE MANAGEMENT & RECEIPT CAPTURE

Build proper expense tracking.
I need to be able to use my phone and upload or photograph a receipt directly into MarketSync HQ.

Each expense should support:
* date
* vendor (Create vendor profiles)
* amount
* category (Choose category)
* recurring vs one-time
* associated customer where relevant
* tax / HST
* receipt attachment (PDF, PNG, HEIC where practical)
* upload timestamp
* employee / staff member

Support recurring expenses such as:
* Render
* Supabase / database hosting
* n8n
* email providers (Postmark, SendGrid, Resend)
* advertising (Google, Meta)

Workflow:
Upload / Take Receipt Photo
        ↓
Extract / Enter metadata (vendor, amount, date, category, tax)
        ↓
Flag missing information
        ↓
Save / Approve
        ↓
Timeline / Expenses ledger

Budgeting:
Example:
Advertising | Budget: $6,000 | Spent: $4,820 | Remaining: $1,180
