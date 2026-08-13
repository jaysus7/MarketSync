# MarketSync Training Academy Master Plan

Status: curriculum and production plan  
Audience: MarketSync staff, dealership owners, managers, department staff, sales representatives, Facebook Solo users, and AI Dealer users  
Products covered: MarketSync OS, DealerOS, Facebook Marketplace, AI Dealer, and shared platform administration

## 1. Goal

Build one searchable Training Academy inside MarketSync that teaches every visible product feature in plain language. A new user should be able to complete a real task without previous software or industry knowledge. This is especially important for accounting: the course must explain what the numbers mean, what the user should do, what MarketSync does automatically, and when the user should stop and ask an accountant.

Training must match the user's:

- product and paid plan;
- workspace (MarketSync OS or DealerOS);
- dealership or dealer group;
- job role and permissions;
- enabled feature flags;
- preferred language;
- desktop or mobile context.

Platform owners can see the complete academy. Dealer users see only courses for products and permissions available to them.

## 2. Repository findings

The repository already contains two broad help pages:

- `marketplace-frontend/guide.html`: a 38-section DealerOS overview;
- `marketplace-frontend/marketsync-guide.html`: a short MarketSync owner playbook.

They are useful starting references, but they are not yet a complete training system. They combine multiple tasks in single sections, are not filtered by plan or role, do not track completion, do not provide consistent troubleshooting, and do not cover every backend workflow available in the application.

The current product surface includes:

- MarketSync HQ, customer pipeline, follow-ups, funnel, automation, employees, all accounts, affiliates, SaaS accounting, and settings;
- DealerOS daily briefing, CRM, appointments, tasks, inventory, appraisals, equity, deal desk, F&I, delivery, service, parts, recon, accounting, commissions, reports, marketing, website, automation, task board, operations, configuration, API keys, users, and security;
- Facebook inventory publishing, sales representatives, and posting leaderboard;
- AI Dealer overview, conversations, human replies, agents, knowledge, widget, leads, and settings;
- shared authentication, billing, MFA, passkeys, recovery codes, active sessions, groups, integrations, notifications, and audit controls.

This master plan splits those surfaces into short, outcome-based lessons.

## 3. Academy information architecture

Add a **Training** link to the main dashboard navigation and relevant page headers. The academy home should have:

1. **Continue learning** — resume the last lesson.
2. **Start here** — setup checklist for the user's product and role.
3. **My role** — a curated learning path for the signed-in user.
4. **Feature library** — all permitted lessons organized by department.
5. **Troubleshooting** — symptom-based fixes.
6. **What's new** — lessons added or changed by a release.
7. **MarketSync OS / DealerOS switch** — visible only to MarketSync platform users.

Recommended routes:

- `training.html` — academy home and search;
- `training.html?course=dealeros-accounting` — course page;
- `training.html?lesson=accounting-daily-reconciliation` — exact lesson;
- dashboard help links use the lesson URL for the feature currently on screen.

Recommended content model:

```text
training/
  catalog.json
  courses/
    marketsync-os/
    dealer-os/
    facebook/
    ai-dealer/
    administration/
  lessons/
    <lesson-id>.md
  transcripts/
    <lesson-id>.vtt
  thumbnails/
```

Each `catalog.json` lesson record should contain:

- lesson ID, title, summary, and search keywords;
- product, plan, workspace, department, and job roles;
- required permissions and feature flags;
- prerequisites and estimated time;
- article path, video URL, thumbnail, and caption path;
- staging verification date and application version;
- content owner and review status;
- related lessons and troubleshooting articles.

Future progress tables:

- `training_lessons` for published lesson metadata;
- `training_progress` for started/completed state by user;
- `training_assignments` for required courses by role;
- `training_quiz_attempts` for optional certification.

## 4. Standard for every lesson

Every feature becomes one or more task-level lessons. Do not publish a lesson called only “Accounting” or “Inventory.” Publish lessons such as “Approve an expense,” “Correct a reconciliation variance,” or “Add a vehicle manually.”

Every written lesson must use this template:

1. **What you will accomplish** — one specific result.
2. **Who can do this** — product, plan, role, and permission.
3. **Before you start** — information or records the user needs.
4. **Where to go** — exact navigation from the dashboard.
5. **Step by step** — numbered clicks and field entries.
6. **What success looks like** — the screen, status, or total expected.
7. **What MarketSync does automatically** — events, messages, ledger entries, or follow-ups.
8. **Common problems** — exact errors or symptoms and fixes.
9. **Safety and compliance** — permissions, customer consent, money, or irreversible actions.
10. **Next lesson** — the natural next workflow.

Each article also needs:

- a plain-language glossary box;
- screenshots with numbered callouts;
- a two-minute quick path and a detailed path where appropriate;
- desktop and mobile differences;
- keyboard/accessibility notes;
- “last verified” date and application release;
- a feedback link: **This did not match my screen**.

Every training video must use this script structure:

1. **0:00–0:15 — Outcome:** show the finished result first.
2. **0:15–0:30 — Prerequisites:** identify the role, plan, and required data.
3. **0:30–3:30 — Demonstration:** complete the task on staging with realistic sample data.
4. **3:30–4:15 — Explain:** describe what MarketSync did automatically.
5. **4:15–4:45 — Common mistake:** show one likely error and how to fix it.
6. **4:45–5:00 — Verify:** show how the user confirms success and name the next lesson.

Video production rules:

- record on the staging site, never production;
- use a dedicated training dealership and fictional customer data;
- use one consistent 1920×1080 browser size and at least 150% readable cursor emphasis;
- narrate field meanings, not just clicks;
- remove or mask email addresses, phone numbers, VINs, payment details, keys, and tokens;
- add human-reviewed captions and a transcript;
- keep most videos between two and six minutes;
- split workflows longer than eight minutes into a series;
- re-record a lesson when navigation, labels, permissions, or results materially change.

## 5. Course catalogue

The following inventory is the first complete production backlog. Each bullet is a separate article/video unless explicitly grouped.

### A. Platform foundations — all products

- PF-001 Create an account and verify the email address.
- PF-002 Choose the correct product, plan, currency, and billing cycle.
- PF-003 Sign in, sign out, and recover a password.
- PF-004 Understand the dashboard, left navigation, page header, and mobile menu.
- PF-005 Switch between MarketSync OS and DealerOS workspaces.
- PF-006 Update name, avatar, contact information, and email signature.
- PF-007 Read notifications and open the record that caused one.
- PF-008 Change language and understand translated versus dealership-entered content.
- PF-009 Set up MFA with an authenticator app.
- PF-010 Replace an existing MFA factor and fix “friendly name already exists.”
- PF-011 Create, store, and use recovery codes.
- PF-012 Add and remove a passkey.
- PF-013 Review active sessions, revoke a device, and log out everywhere.
- PF-014 Understand plans, invoices, payment status, upgrades, and cancellations.
- PF-015 Contact support and include the information needed for a fast answer.

### B. Dealership and team setup

- DS-001 Register a dealership and confirm its product subscription.
- DS-002 Complete the first-login setup checklist.
- DS-003 Add dealership name, address, timezone, currency, tax settings, and hours.
- DS-004 Add branding, logo, colours, contact details, and standard documents.
- DS-005 Configure dealer fees and disclosure text.
- DS-006 Invite a user and explain how the invitation works.
- DS-007 Assign a job role and explain what that role can see.
- DS-008 Edit, deactivate, reactivate, and remove a user safely.
- DS-009 Reset a user's access and troubleshoot a failed invitation.
- DS-010 Create and manage a dealer group.
- DS-011 Add or remove dealerships in a group.
- DS-012 Switch dealership context without mixing tenant data.
- DS-013 Enable or disable dealership features.
- DS-014 Understand Starter, Growth, Pro, Facebook, and AI Dealer navigation.
- DS-015 Configure notification and operational email recipients.

### C. Daily Briefing and dealership command centre

- DB-001 Read today's numbers, warnings, and recommended actions.
- DB-002 Open a warning and find the record that needs attention.
- DB-003 Use Ask MarketSync for a plain-language operational answer.
- DB-004 Complete or dismiss a recommended action.
- DB-005 Understand dealership health, exceptions, and daily priorities.

### D. CRM, leads, appointments, and follow-up

- CRM-001 Add a customer manually.
- CRM-002 Scan a driver's licence and review imported data.
- CRM-003 Search, sort, and filter customers.
- CRM-004 Edit customer information and lifecycle status.
- CRM-005 Read the customer timeline and communication history.
- CRM-006 Add a note, attachment, and internal activity.
- CRM-007 Record and manage SMS, email, and marketing consent.
- CRM-008 Call, text, or email a customer and log the result.
- CRM-009 Create, assign, and prioritize a task.
- CRM-010 Complete, reschedule, or reassign a task.
- CRM-011 Create an appointment from a customer record.
- CRM-012 Reschedule, confirm, cancel, or complete an appointment.
- CRM-013 Connect Google or Microsoft Calendar.
- CRM-014 Create a lead manually or from an inventory record.
- CRM-015 Understand lead sources and source attribution.
- CRM-016 Assign, acknowledge, and transfer a lead.
- CRM-017 Work the new-lead queue and response-time warnings.
- CRM-018 Configure lead routing and ownership rules.
- CRM-019 Configure ADF/XML CRM delivery.
- CRM-020 Test, troubleshoot, and resend a failed lead delivery.
- CRM-021 Configure the AI lead autoresponder.
- CRM-022 Review an AI reply and take over the conversation.
- CRM-023 Create a bulk outreach list safely.
- CRM-024 Preview, schedule, send, and audit bulk outreach.
- CRM-025 Find lost customers and use equity-mining opportunities.
- CRM-026 Understand customer ownership and duplicate handling.

### E. Inventory, vehicle content, and syndication

- INV-001 Connect a dealership inventory feed or website source.
- INV-002 Run a sync and understand added, updated, sold, and failed units.
- INV-003 Troubleshoot a missing or stale synced vehicle.
- INV-004 Import inventory by CSV and correct rejected rows.
- INV-005 Add a vehicle manually.
- INV-006 Decode a VIN and verify decoded details.
- INV-007 Scan a licence plate to retrieve a VIN.
- INV-008 Edit price, mileage, status, colour, trim, and stock number.
- INV-009 Add, reorder, replace, and remove photos.
- INV-010 Apply photo overlays and prepare a consistent photo set.
- INV-011 Use AI Vision and background removal.
- INV-012 Generate, edit, translate, and approve an AI description.
- INV-013 Record acquisition, cost, and recon amounts.
- INV-014 Mark a vehicle reserved, sold, removed, or available.
- INV-015 Generate a window sticker.
- INV-016 Generate and download a vehicle brochure.
- INV-017 Request and read a vehicle history report.
- INV-018 Read lot health, aging, turn rate, and stale inventory.
- INV-019 Use repricing and stock recommendations.
- INV-020 Read a MarketCheck market comparison.
- INV-021 Configure competitor dealerships and pricing comparisons.
- INV-022 Configure a syndication feed.
- INV-023 Copy, test, pause, and troubleshoot the feed URL.
- INV-024 Export inventory without exposing restricted data.

### F. Facebook Marketplace products

- FB-001 Understand Facebook Solo versus Facebook Dealer.
- FB-002 Install and pin the MarketSync Chrome extension.
- FB-003 Sign the extension into the correct MarketSync account.
- FB-004 Add or sync inventory for Facebook posting.
- FB-005 Prepare a vehicle listing and required fields.
- FB-006 Post the first vehicle to Facebook Marketplace.
- FB-007 Safely continue a partially completed posting.
- FB-008 Update, repost, or remove a vehicle listing.
- FB-009 Read posting status, rest periods, and “safe to post.”
- FB-010 Configure posting guardrails and daily limits.
- FB-011 Add and manage Facebook Dealer sales representatives.
- FB-012 Read the Facebook posting leaderboard and badges.
- FB-013 Troubleshoot extension timeout, browser permissions, and Facebook form changes.
- FB-014 Troubleshoot session, wrong-account, duplicate, and missing-inventory problems.

### G. Appraisals, deal desk, F&I, and delivery

- DEAL-001 Start a trade appraisal from a customer or vehicle.
- DEAL-002 Record condition, photos, market evidence, and appraisal value.
- DEAL-003 Approve, decline, and attach an appraisal to a deal.
- DEAL-004 Start a deal from a customer and inventory vehicle.
- DEAL-005 Build the first payment estimate or pencil.
- DEAL-006 Enter selling price, discount, trade, taxes, and dealer fees.
- DEAL-007 Compare cash, finance, and lease scenarios.
- DEAL-008 Save, revise, share, and explain a deal proposal.
- DEAL-009 Submit a credit application securely.
- DEAL-010 Review application status without exposing sensitive data.
- DEAL-011 Configure lenders and submit an application.
- DEAL-012 Record approvals, conditions, declines, and chosen lender.
- DEAL-013 Add reserve, warranties, GAP, and F&I products.
- DEAL-014 Record product acceptance or decline and disclosures.
- DEAL-015 Create and send an e-signature request.
- DEAL-016 Track, remind, cancel, and download signed documents.
- DEAL-017 Verify customer identity and handle a failed check.
- DEAL-018 Request and record a deposit through the configured processor.
- DEAL-019 Refund, cancel, or reconcile a deposit safely.
- DEAL-020 Request approval, approve, finalize, and unwind a deal.
- DEAL-021 Run the delivery checklist.
- DEAL-022 Complete delivery and trigger customer follow-up.
- DEAL-023 Read the F&I pipeline and profitability reports.

### H. Service, parts, and recon

- SRV-001 Configure service hours, booking rules, labour rates, and reminders.
- SRV-002 Book, confirm, reschedule, and cancel a service appointment.
- SRV-003 Create a repair order from an appointment or customer.
- SRV-004 Add customer concerns, labour operations, and technician notes.
- SRV-005 Add parts and calculate estimates.
- SRV-006 Assign a technician and update repair status.
- SRV-007 Complete an inspection and attach photos or video.
- SRV-008 Request and record customer approval.
- SRV-009 Complete, invoice, and close a repair order.
- SRV-010 Create maintenance reminders and follow-up.
- PART-001 Add a part and set cost, retail, location, and reorder level.
- PART-002 Receive, adjust, issue, return, and transfer parts.
- PART-003 Read low-stock warnings and inventory valuation.
- RECON-001 Add a vehicle to the recon board.
- RECON-002 Move a vehicle through cleanup and recon stages.
- RECON-003 Assign work, add a blocker, and resolve overdue work.
- RECON-004 Complete recon and verify the vehicle is retail-ready.

### I. Automation, workflows, operations, and task board

- AUTO-001 Understand a trigger, condition, step, run, and action.
- AUTO-002 Enable a standard new-lead follow-up.
- AUTO-003 Enable delivery, anniversary, service, or holiday follow-up.
- AUTO-004 Build a custom email or SMS sequence.
- AUTO-005 Add, edit, reorder, delay, and remove steps.
- AUTO-006 Preview, test, activate, pause, clone, and delete a sequence.
- AUTO-007 Enrol and remove a customer safely.
- AUTO-008 Read a workflow run and retry a failed action.
- AUTO-009 Configure email sending health and send a test.
- AUTO-010 Create a campaign, audience segment, and template.
- AUTO-011 Preview, schedule, send, and measure a campaign.
- OPS-001 Read operational exceptions and assign an owner.
- OPS-002 Resolve, dismiss, or reopen an exception.
- TASK-001 Create a task-board card and assign department, owner, and due date.
- TASK-002 Add dependencies, change status, and complete a card.

### J. Website, marketing, and digital presence

- WEB-001 Claim the dealership site URL and publish the first site.
- WEB-002 Choose a template and configure brand, logo, colours, and typography.
- WEB-003 Set contact information, hours, map, and social links.
- WEB-004 Add, reorder, hide, and publish pages and menu items.
- WEB-005 Add and configure page sections and widgets.
- WEB-006 Configure inventory search and vehicle detail pages.
- WEB-007 Create forms and confirm that leads arrive in CRM.
- WEB-008 Add staff, reviews, specials, and payment calculator content.
- WEB-009 Connect and verify a custom domain.
- WEB-010 Configure SEO titles, descriptions, indexing, and connections.
- WEB-011 Install and verify the AI chat widget.
- MKT-001 Connect advertising accounts.
- MKT-002 Import and verify ad spend.
- MKT-003 Read campaign ROI, leads, sales, and cost per result.
- MKT-004 Troubleshoot disconnected or stale ad data.

### K. AI Dealer and AI tools

- AI-001 Understand AI Dealer versus Ask MarketSync and AI Boost.
- AI-002 Read AI Dealer overview metrics and lead outcomes.
- AI-003 Search and filter AI conversations.
- AI-004 Open a conversation and read its customer and vehicle context.
- AI-005 Reply as a human and return control to AI.
- AI-006 Mark, assign, escalate, archive, and reopen a conversation.
- AI-007 Create and configure an AI agent persona.
- AI-008 Set hours, escalation rules, allowed actions, and response style.
- AI-009 Add dealership facts, FAQs, financing rules, and specials to knowledge.
- AI-010 Upload, replace, and remove a knowledge document.
- AI-011 Test an answer and correct the knowledge source.
- AI-012 Configure lead capture, appointment booking, and human handoff.
- AI-013 Install the AI widget on a MarketSync or external website.
- AI-014 Verify the widget, leads, replies, and appointment flow.
- AI-015 Review usage, limits, AI costs, and plan status.
- AI-016 Use AI listing copy, AI summaries, AI Vision, and pricing tools responsibly.
- AI-017 Troubleshoot no reply, wrong answer, missing vehicle, or missing conversation.

### L. Reports, insights, and leaderboard

- RPT-001 Read the dealership performance dashboard.
- RPT-002 Read sales, gross, F&I, and salesperson performance.
- RPT-003 Read leads, response time, source, and conversion.
- RPT-004 Read inventory, aging, turn, and appraisal reports.
- RPT-005 Read customer, appointment, activity, and e-signature reports.
- RPT-006 Read service and parts performance.
- RPT-007 Read marketing and advertising ROI.
- RPT-008 Build, save, rerun, and delete a custom report.
- RPT-009 Export a report and understand export auditing.
- RPT-010 Read the correct leaderboard for Facebook or dealership performance.

### M. Accounting for non-accountants

The course begins with concepts, then follows daily, weekly, monthly, and exception routines. Each screen must explain the business meaning before the button.

- ACC-001 How money flows from a delivered deal, deposit, expense, and service order into MarketSync.
- ACC-002 Assets, liabilities, equity, income, expense, debit, and credit in plain English.
- ACC-003 Configure accounting recipients, tolerance, automation, tax, and reconciliation.
- ACC-004 Review, add, edit, and deactivate chart-of-account entries.
- ACC-005 Read the accounting Insights page and know what requires action.
- ACC-006 Complete the five-minute daily accounting routine.
- ACC-007 Add income or an expense directly to the ledger.
- ACC-008 Correct an entry by reversal instead of deleting history.
- ACC-009 Upload a receipt and create an expense.
- ACC-010 Review, edit, approve, reject, and reimburse an expense.
- ACC-011 Create and manage a recurring expense.
- ACC-012 Prepare checks and export an expense report.
- ACC-013 Run daily reconciliation.
- ACC-014 Find and correct a reconciliation variance.
- ACC-015 Review reconciliation history and reopen the source record.
- ACC-016 Connect and read the bank account feed.
- ACC-017 Match, categorize, and review bank transactions.
- ACC-018 Set a budget and compare actual versus budget.
- ACC-019 Read the forecast and identify a cash or expense risk.
- ACC-020 Understand tax collected, paid, and owing.
- ACC-021 Record a tax payment and verify the new balance.
- ACC-022 Read a profit-and-loss statement.
- ACC-023 Read a balance sheet.
- ACC-024 Read a trial balance and recognize an out-of-balance warning.
- ACC-025 Run department, deal, expense, tax, and commission reports.
- ACC-026 Export reports safely for an outside accountant.
- ACC-027 Review accounting events and replay a failed posting.
- ACC-028 Advance, lock, and correct an accounting period.
- ACC-029 Complete the month-end checklist.
- ACC-030 Configure QuickBooks or Xero export/integration where enabled.
- COMM-001 Create a commission plan in plain language.
- COMM-002 Assign a plan to a salesperson.
- COMM-003 Add an adjustment, funded status, payment, or clawback.
- COMM-004 Open and review a pay period.
- COMM-005 Resolve exceptions, approve, lock, and mark a pay period paid.
- COMM-006 Export payroll and produce salesperson statements.
- COMM-007 Acknowledge or dispute a commission statement.

### N. Security, integrations, APIs, and compliance

- SEC-001 Understand permissions, least access, and protected actions.
- SEC-002 Review the user/role matrix and correct a permission problem.
- SEC-003 Review security and activity events.
- SEC-004 Export customer or financial data with a documented reason.
- SEC-005 Manage consent, privacy requests, and sensitive customer data.
- INT-001 Connect Google or Microsoft Calendar.
- INT-002 Configure Twilio SMS and send a test.
- INT-003 Configure Stripe, Square, or bank/deposit integrations.
- INT-004 Connect advertising, accounting, and CRM/DMS integrations.
- API-001 Create an API key with the minimum scopes needed.
- API-002 Copy and store a new key safely; understand why it is shown once.
- API-003 Review usage, expire, rotate, and revoke a key.
- API-004 Configure a webhook endpoint and signing secret.
- API-005 Verify signatures and protect against duplicate delivery.
- API-006 Read webhook delivery history, inspect an error, and retry.

### O. MarketSync OS — platform team only

- MS-001 Enter MarketSync OS and switch safely to DealerOS.
- MS-002 Read MRR, ARR, trials, conversion, churn risk, and system health.
- MS-003 Work the customer pipeline by stage, health, and next action.
- MS-004 Open a customer account and read its people, products, billing, and timeline.
- MS-005 Create, assign, complete, reschedule, and audit a follow-up.
- MS-006 Read funnel metrics and find a conversion leak.
- MS-007 Review and recover an abandoned checkout.
- MS-008 Create and manage MarketSync automation sequences.
- MS-009 Create segments, templates, campaigns, and enrolments.
- MS-010 Test email health and troubleshoot a failed send.
- MS-011 Add an employee and assign a MarketSync role.
- MS-012 Review all accounts and find the correct user or dealership.
- MS-013 Activate, change, or remove account products and engines.
- MS-014 Correct plan or billing status without granting the wrong product.
- MS-015 Review dealership usage, activity, health, and support history.
- MS-016 Approve and manage an affiliate.
- MS-017 Configure affiliate commission rates and review referrals.
- MS-018 Approve, pay, reverse, and audit an affiliate commission.
- MS-019 Read MarketSync SaaS accounting revenue, cost, and affiliate totals.
- MS-020 Use the public MarketSync chatbot, lead capture, and booking flow.
- MS-021 Remove sample leads and maintain demonstration accounts safely.
- MS-022 Handle customer access, billing, outage, and escalation support.
- MS-023 Use the platform audit trail before and after an administrative change.
- MS-024 Run the daily, weekly, and monthly MarketSync operating checklists.

## 6. Example finished lesson: daily accounting reconciliation

### What you will accomplish

Confirm that the money MarketSync expected for one day agrees with the recorded activity, then resolve or assign any difference.

### Who can do this

DealerOS users whose role includes Accounting access. A manager may be able to review results but should not change accounting settings unless permitted.

### Before you start

- Finish posting the day's delivered deals, deposits, refunds, and approved expenses.
- Have the payment processor or bank total for the day available.
- Do not create a fake entry only to make a difference disappear.

### Plain-English glossary

- **Expected total:** what MarketSync calculates from operational records.
- **Recorded total:** what the ledger, processor, or bank data shows.
- **Variance:** the difference between expected and recorded totals.
- **Tolerance:** the largest difference allowed before MarketSync flags the day.
- **Reversal:** a traceable correction that cancels a wrong entry without erasing history.

### Step by step

1. Sign in to the correct dealership.
2. In the left navigation, open **Accounting** and choose **Reconciliation**.
3. Confirm that the displayed date is the business day you intend to close.
4. Review the totals for delivered deals, deposits, refunds, expenses, and any manual entries.
5. Compare the MarketSync total with the bank or payment-processor total.
6. Select **Run reconciliation**.
7. If the result is within tolerance, review the summary and confirm the reconciliation.
8. If there is a variance, do not confirm it blindly. Open the mismatched category.
9. Check for a missing deposit, duplicate expense, refunded payment, wrong date, or deal that was delivered but not finalized.
10. Open the source record and correct the source. Use a reversal for an incorrect ledger entry; do not delete accounting history.
11. Return to **Accounting → Reconciliation** and run it again.
12. When the variance is zero or legitimately within the dealership's approved tolerance, confirm the day.
13. Add a note explaining any accepted non-zero variance and who approved it.
14. Open **Reconciliation history** and confirm that the date, status, totals, and user are recorded.

### What success looks like

The day appears in reconciliation history with a reconciled status. The totals, variance, user, and timestamp are visible, and any accepted difference has a note.

### What MarketSync does automatically

MarketSync recalculates expected totals, records the reconciliation event, preserves who performed it, and keeps source accounting history. Depending on dealership settings, it can notify accounting or management when a variance exceeds tolerance.

### Common problems

- **A delivered deal is missing:** confirm it was finalized and that automatic accounting posting is enabled.
- **A deposit appears twice:** review the processor record and manual ledger entries; reverse the duplicate rather than deleting history.
- **The amount belongs to tomorrow:** correct the source transaction date, then rerun reconciliation.
- **The button is unavailable:** verify the user's Accounting permission and whether the period is locked.
- **The day will not balance:** save the variance and assign it for investigation; do not invent an offsetting transaction.

### Safety boundary

MarketSync training can teach bookkeeping workflow and how to use the software. Tax treatment, statutory filings, unusual journal entries, and formal financial advice must be reviewed by a qualified accountant for the dealership's jurisdiction.

## 7. Role-based learning paths

### Platform owner

PF → MarketSync OS → security → SaaS accounting → automation → DealerOS overview → support runbooks.

### Dealer group owner / dealer owner / general manager

PF → dealership setup → Daily Briefing → CRM overview → inventory overview → deals → reports → approvals → accounting insights → security.

### Sales manager

PF → CRM/leads → appointments/tasks → inventory → appraisals → deal desk → delivery → reports → team leaderboard.

### Salesperson

PF → customer and consent → lead response → tasks/appointments → inventory → appraisal → deal proposal → delivery follow-up.

### BDC

PF → leads → AI replies and takeover → communication → appointments → follow-up → campaigns → reporting.

### F&I manager

PF → deal desk → credit application → lenders → products → e-sign → deposits → compliance → F&I reports.

### Service manager / technician / parts

PF → service appointments → repair orders → approvals → technician workflow → parts → reminders → reports.

### Accounting

PF → accounting concepts → setup → daily routine → expenses → reconciliation → bank → tax → reports → month end → commissions.

### Facebook Solo / Facebook Dealer

PF → Facebook setup → inventory → extension → posting → guardrails → troubleshooting → applicable leaderboard/team lessons.

### AI Dealer user

PF → AI overview → conversations → reply/takeover → agents → knowledge → widget → leads/appointments → troubleshooting.

## 8. Production workflow

Use this process for every lesson:

1. Pick one lesson ID from this catalogue.
2. Confirm the feature is visible to the intended plan and role on staging.
3. Record the exact route, labels, buttons, fields, permissions, automatic effects, and error states.
4. Create or reset fictional staging data for a repeatable demonstration.
5. Write the article from the standard template.
6. Have a person unfamiliar with the feature follow the article without coaching.
7. Correct every unclear or missing step.
8. Record the video using the verified article as the script.
9. Create captions, transcript, thumbnail, keywords, and related links.
10. Review for privacy, security, accounting, and customer-consent risks.
11. Publish the lesson to the academy catalogue as a draft.
12. Test the lesson link as every relevant plan/role combination.
13. Mark it published and record the staging release/verification date.
14. Add a release checklist item whenever code changes a trained page.

Definition of done for one lesson:

- article complete and tested by a new user;
- video complete with captions and transcript;
- no real customer or credential data;
- correct plan, role, and permission gates;
- exact navigation and success result verified on staging;
- common errors documented;
- related feature links work;
- content owner and review date recorded.

## 9. Rollout plan

### Phase 1 — Academy foundation and first-login success

Build the academy shell, structured catalogue, search, role/plan filtering, contextual **Help for this page** links, and content status labels. Publish PF, DS, Facebook, AI Dealer, and core CRM/inventory setup lessons first.

### Phase 2 — Revenue and daily dealership work

Publish lead handling, appointments, inventory, Facebook posting, AI conversations, appraisals, deal desk, F&I, delivery, and manager reporting.

### Phase 3 — Accounting and departmental certification

Publish the complete non-accountant accounting path, commissions, service, parts, recon, website, marketing, operations, and automation. Add short quizzes and role certifications only after the lessons work reliably.

### Phase 4 — MarketSync OS operations

Publish the internal HQ curriculum, customer support runbooks, product/billing administration, affiliates, SaaS accounting, automation, incident handling, and platform audit procedures.

### Phase 5 — Maintenance and measurement

Track searches with no result, lesson exits, support tickets linked to lessons, completion by role, and “did not match my screen” reports. Review high-risk accounting/security lessons quarterly and all other lessons at least every six months.

## 10. Recommended first recording batch

The first batch should prove the academy works for each distinct product while covering the most common support needs:

1. Sign in and navigate MarketSync.
2. Complete dealership setup.
3. Invite a user and assign the correct role.
4. Set up MFA and recover from an existing factor.
5. Connect and sync inventory.
6. Add a vehicle manually.
7. Install the Facebook extension and post the first vehicle.
8. Open an AI conversation and reply as a human.
9. Add a customer and create an appointment.
10. Respond to and assign a lead.
11. Complete the five-minute daily accounting routine.
12. Upload, approve, and reimburse an expense.
13. Run daily reconciliation and fix a variance.
14. Read a profit-and-loss statement in plain language.
15. Read MarketSync OS customer pipeline and create a follow-up.

## 11. Content governance

- Product owner: approves whether instructions match intended behaviour.
- Department reviewer: validates accounting, F&I, service, compliance, or sales meaning.
- Training editor: keeps language simple and consistent.
- Release owner: identifies lessons affected by each deployment.
- Support team: tags recurring questions to missing or unclear lessons.

No lesson should promise access based only on a plan name. The application must evaluate the same product entitlements, engine flags, user role, and permission checks used by the dashboard.

## 12. Completion checklist

- [x] Repository-wide product and workflow inventory.
- [x] Existing guide gap assessment.
- [x] MarketSync OS and DealerOS course separation.
- [x] Plan-, role-, permission-, and feature-aware academy design.
- [x] Complete first-pass lesson catalogue.
- [x] Plain-language accounting curriculum.
- [x] Standard article, video, verification, and maintenance process.
- [x] Role-based learning paths.
- [x] Phased rollout and first recording batch.
- [ ] Implement the Training Academy page and structured content registry.
- [ ] Write and verify the first 15 lesson articles on staging.
- [ ] Record, caption, review, and publish the first 15 videos.
- [ ] Add lesson completion, assignments, feedback, and reporting.
