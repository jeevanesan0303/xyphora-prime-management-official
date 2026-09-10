MASTER DEVELOPMENT PROMPT
Xyphora Prime — Business OS

Build a complete, production-ready internal business management and financial management web application for Xyphora Prime.

The application must be a REAL WORKING SYSTEM, not a static UI prototype.

The visual design must follow the provided Xyphora Prime reference design:
- Premium
- Luxury
- Minimal
- Modern
- Executive
- Clean
- White-first interface
- Black navigation
- Premium purple accent
- Excellent whitespace
- Professional tables
- Refined typography
- Subtle animations
- High-end fintech/business software aesthetic

Do not redesign the visual identity into a generic admin dashboard.

==================================================
1. CORE PURPOSE
==================================================

This system is for Xyphora Prime's internal administration.

There is ONLY ONE ADMINISTRATOR.

There are NO employee login accounts.
There are NO client login accounts.
There are NO multiple roles.
There is NO public registration.

The administrator manages the complete business from one application.

The system must manage:

- Clients
- Projects
- Services
- Invoices
- Payments
- Income
- Expenses
- Recurring expenses
- Client subscriptions
- Employees
- Monthly salaries
- Documents
- Financial reports
- Calendar
- Company profile
- Admin profile
- Settings
- Activity history
- Data exports
- Invoice PDF generation

==================================================
2. TECHNOLOGY
==================================================

Use:

Frontend:
React
TypeScript
Vite

Styling:
Tailwind CSS

UI:
shadcn/ui or equivalent reusable component system

Icons:
Lucide React

Charts:
Recharts

Animation:
Framer Motion

Backend:
Supabase

Database:
PostgreSQL through Supabase

Authentication:
Supabase Auth

Storage:
Supabase Storage

PDF:
Use a reliable client/server PDF generation solution.

CSV:
Generate downloadable CSV files from database records.

Do not use fake localStorage data for the actual application.

Use Supabase as the real source of truth.

==================================================
3. APPLICATION ARCHITECTURE
==================================================

Structure the application cleanly.

Recommended structure:

src/
  components/
  layouts/
  pages/
  features/
    clients/
    projects/
    services/
    invoices/
    payments/
    income/
    expenses/
    subscriptions/
    employees/
    salaries/
    reports/
    documents/
  hooks/
  lib/
  services/
  types/
  utils/
  contexts/

Keep components reusable.

Do not place the entire application inside one huge component.

Separate business logic from presentation.

==================================================
4. AUTHENTICATION
==================================================

LOGIN IS THE FIRST AND MOST IMPORTANT SCREEN.

Create a premium administrator login.

There must be exactly one administrator account.

Login fields:

Email
Password

Features:

Show/hide password
Remember session
Forgot password
Loading state
Invalid credentials error
Successful login
Logout
Session persistence

Do not expose registration.

Do not show role selection.

Do not show employee login.

Do not show client login.

After successful authentication:

Admin → Dashboard

If unauthenticated:

Any protected route → Login

If authenticated:

Login route → Dashboard

Protect every application route.

==================================================
5. LOGIN DESIGN
==================================================

Use the provided reference design as the visual direction.

Create a split-screen luxury login.

LEFT SIDE:
Dark/black background.

Show:

XYPhora Prime logo

"One place to
run the business."

Supporting text:

"Financial clarity. Client management. Projects. Operations."

Add a subtle abstract purple light/curve effect.

Keep it sophisticated.

Do not use stock photography.

Do not use cartoon graphics.

Do not overload the background.

RIGHT SIDE:
White background.

Centered login form.

"Welcome back."

"Sign in to your administrator account."

Email

Password

Remember me

Forgot password?

Black "Sign In" button.

Purple should appear subtly on focus/hover.

Below:

"Protected administrator access"

The login page should feel like a private executive platform.

==================================================
6. BRAND COLORS
==================================================

Use only this primary design palette.

BLACK:
#080808

NEAR BLACK:
#111111

DARK:
#171717

WHITE:
#FFFFFF

OFF WHITE:
#FAFAFA

LIGHT GRAY:
#F3F3F3

BORDER:
#E5E5E5

MUTED:
#737373

PRIMARY PURPLE:
#7C3AED

DEEP PURPLE:
#5B21B6

SOFT PURPLE:
#8B5CF6

LIGHT PURPLE:
#F3E8FF

Use purple as an accent.

Do not turn the entire interface purple.

Do not introduce random blue, orange, green, cyan or pink.

Red may only be used for:
- Errors
- Destructive actions
- Overdue payments
- Critical warnings

==================================================
7. DESIGN SYSTEM
==================================================

The design must be consistent across the entire application.

Typography:
Inter or Geist.

Border radius:
8–12px.

Borders:
1px subtle gray.

Shadows:
Very subtle.

Avoid excessive shadows.

Avoid excessive rounded cards.

Avoid excessive glassmorphism.

Avoid excessive gradients.

Avoid giant decorative graphics.

Premium quality must come from:

- spacing
- typography
- contrast
- alignment
- whitespace
- hierarchy

==================================================
8. APPLICATION SHELL
==================================================

After login, use:

LEFT SIDEBAR
+
TOP NAVBAR
+
MAIN CONTENT

Sidebar:

XYPhora Prime logo

Dashboard

BUSINESS
Clients
Projects
Services

FINANCE
Invoices
Payments
Income
Expenses
Subscriptions

TEAM
Employees
Salaries

REPORTS
Financial Reports
Client Reports
Project Reports
Employee Reports

Calendar

Documents

Settings

Bottom:

Admin profile
Administrator
Logout

Sidebar:
240–260px wide.

White or near-black depending on chosen application mode.

Default application should follow the reference:
dark sidebar + light main content.

Active navigation:
Purple accent.

==================================================
9. TOP NAVIGATION
==================================================

Include:

Breadcrumb

Global search

Notification button

Admin avatar

Admin name

Dropdown

Dropdown:
Profile
Settings
Logout

Global search must search:

Clients
Projects
Invoices
Payments
Expenses
Employees
Subscriptions
Documents

==================================================
10. DASHBOARD
==================================================

Dashboard is the business command center.

Header:

"Good evening, Administrator."

"Here's what's happening across XYPhora Prime."

Date range selector.

Quick Create button.

Quick actions:

New Client
New Project
New Invoice
Add Payment
Add Expense
Add Employee

==================================================
11. DASHBOARD FINANCIAL METRICS
==================================================

Display:

Total Revenue

Total Expenses

Net Profit

Outstanding

Additional:

This Month Revenue
This Month Expenses
Expected Income
Upcoming Expenses

Do not use colorful cards.

Use clean metric blocks.

Revenue:
Black

Expenses:
Purple

Profit:
Black

Outstanding:
Purple

==================================================
12. DASHBOARD CHARTS
==================================================

Create:

Revenue vs Expenses

Monthly / Quarterly / Yearly filters.

Use:

Black = Revenue
Purple = Expenses

No additional colors.

Also create:

Cash Flow

Monthly Revenue

Revenue by Service

==================================================
13. DASHBOARD ALERTS
==================================================

Show:

Upcoming Payments

Overdue Payments

Upcoming Company Expenses

Upcoming Salaries

Project Deadlines

Subscription Renewals

Examples:

ABC Construction
Website Development
LKR 75,000
Due Sep 10

XYZ Restaurant
POS Maintenance
LKR 15,000
Due Sep 15

Overdue payments must be clearly visible.

==================================================
14. CLIENT MANAGEMENT
==================================================

Create full client CRUD.

Create:

Add
View
Edit
Delete
Search
Filter
Sort
Export

Client fields:

Client ID
Company Name
Contact Person
Phone
WhatsApp
Email
Address
Business Type
Website
Registration Number
Date Joined
Status
Notes

Statuses:

Lead
Active
Completed
Maintenance
Inactive

==================================================
15. CLIENT PROFILE
==================================================

Client profile must connect all related records.

Tabs:

Overview
Projects
Invoices
Payments
Subscriptions
Documents
Notes

Show:

Total Invoiced
Total Paid
Outstanding
Active Projects

Client profile relationships:

Client
→ Projects
→ Invoices
→ Payments
→ Subscriptions
→ Documents

==================================================
16. PROJECT MANAGEMENT
==================================================

Projects must belong to clients.

Project fields:

Project ID
Project Name
Client
Service
Description
Technology
Start Date
Expected Completion
Actual Completion
Project Value
Progress
Status
Notes

Project statuses:

Planning
Proposal
Approved
In Progress
Testing
Completed
Delivered
Maintenance
Cancelled

==================================================
17. PROJECT TYPES
==================================================

Services should include:

Static Website
Dynamic Website
E-commerce Website
POS System
ERP System
Mobile Application
UI/UX Design
Website Management
Website Maintenance
Cloud Solutions
API Integration
Custom Software
Other

Services must be stored in the database.

Do not hard-code service lists throughout the UI.

==================================================
18. PROJECT PAYMENTS
==================================================

A project can have multiple payment milestones.

Example:

Project:
Website Development
Total:
LKR 300,000

Payments:

Advance
LKR 100,000
Paid

Development Milestone
LKR 100,000
Pending

Final Payment
LKR 100,000
Upcoming

The system must calculate:

Project Total
Paid
Balance

Automatically.

==================================================
19. INVOICE SYSTEM
==================================================

Create a complete invoice system.

Invoice fields:

Invoice ID
Invoice Number
Client
Project
Invoice Date
Due Date
Payment Terms
Items
Subtotal
Discount
Tax
Total
Paid
Balance
Payment Type
Status
Notes
Terms

Statuses:

Draft
Sent
Partial
Paid
Pending
Overdue
Cancelled

==================================================
20. INVOICE NUMBERING
==================================================

Use automatic invoice numbering.

Example:

XP-INV-001
XP-INV-002
XP-INV-003

Do not allow accidental duplicate invoice numbers.

Make the prefix configurable from Settings.

==================================================
21. CREATE INVOICE
==================================================

Create an advanced invoice builder.

Left:
Form.

Right:
Live invoice preview.

Client selection.

Project selection.

Invoice date.

Due date.

Payment terms.

Items:

Description
Quantity
Unit Price
Discount
Tax
Total

Automatically calculate:

Subtotal
Discount
Tax
Grand Total
Paid
Balance

Payment type:

Advance
Partial
Milestone
Full
Final
Subscription
Renewal
Other

Actions:

Save Draft
Preview
Generate PDF
Save Invoice

==================================================
22. PROFESSIONAL PDF INVOICE
==================================================

Generate a real downloadable PDF.

A4 format.

Use XYPhora Prime branding.

Include:

Logo
Company information
Client information
Invoice number
Invoice date
Due date
Project
Items
Subtotal
Discount
Tax
Grand Total
Paid
Balance
Bank information
Payment terms
Notes
Terms and Conditions
Signature
Footer

The PDF must be professional enough to send directly to clients.

Do not create an HTML screenshot pretending to be a PDF.

Generate a real PDF file.

==================================================
23. PAYMENT MANAGEMENT
==================================================

Payment records must connect to:

Client
Invoice
Project

Fields:

Payment ID
Client
Invoice
Project
Amount
Payment Type
Payment Method
Payment Date
Reference Number
Notes

Payment types:

Advance
Partial
Milestone
Full
Final
Subscription
Renewal
Other

Payment methods:

Bank Transfer
Cash
Card
Online Payment
Other

==================================================
24. PAYMENT LOGIC
==================================================

When a payment is recorded:

Update invoice paid amount.

Update invoice balance.

Update invoice status.

Update client outstanding amount.

Update project balance.

Add company income.

Update dashboard.

Update reports.

Example:

Invoice:
LKR 100,000

Payment:
LKR 40,000

Invoice status:
Partial

Balance:
LKR 60,000

If another LKR 60,000 is paid:

Status:
Paid

Balance:
0

==================================================
25. INCOME
==================================================

Income must include:

Project Payments
Invoice Payments
Subscriptions
Maintenance
Hosting
Other

Do not duplicate the same payment as multiple income records.

Income should be derived from valid company payment transactions.

Show:

Daily
Monthly
Yearly
Custom Date Range

==================================================
26. EXPENSE MANAGEMENT
==================================================

Create complete expense CRUD.

Fields:

Expense ID
Date
Category
Description
Amount
Payment Method
Recurring
Frequency
Vendor
Receipt
Notes

Categories:

Salary
Hosting
Domain
Software
SaaS
Marketing
Advertising
Office
Internet
Transportation
Equipment
Client Expense
Development
Other

==================================================
27. RECURRING EXPENSES
==================================================

Support:

Monthly
Quarterly
Yearly
Custom

Fields:

Expense
Amount
Frequency
Last Paid
Next Payment
Status

When marked paid:

Automatically calculate next payment date.

==================================================
28. CLIENT SUBSCRIPTIONS
==================================================

Create a recurring revenue system.

Fields:

Subscription ID
Client
Service
Amount
Billing Cycle
Start Date
Last Payment
Next Payment
Status
Notes

Billing:

Monthly
Quarterly
Yearly
Custom

Statuses:

Active
Due Soon
Overdue
Cancelled

When payment is recorded:

Automatically update:

Last Payment
Next Payment
Status
Client income
Dashboard
Reports

==================================================
29. EMPLOYEE MANAGEMENT
==================================================

Employees are records only.

Employees do NOT login.

Fields:

Employee ID
Full Name
Role
Phone
WhatsApp
Email
Address
Joining Date
Status
Bank Information
Notes

Statuses:

Active
Inactive

==================================================
30. EMPLOYEE SALARY
==================================================

Do NOT use only a basic salary.

Each month should have an independent salary record.

Fields:

Employee
Month
Base Amount
Allowances
Bonus
Commission
Overtime
Deductions
Other Adjustments
Net Salary
Payment Date
Payment Method
Status
Notes

Automatically calculate:

Net Salary =
Base
+ Allowances
+ Bonus
+ Commission
+ Overtime
+ Other
- Deductions

Previous months must NEVER be overwritten.

==================================================
31. SALARY HISTORY
==================================================

Each employee should have:

January
February
March
...
December

Show:

Base
Allowances
Bonus
Commission
Overtime
Deductions
Net Salary
Payment Date
Status

Allow:

View
Edit
PDF
CSV

==================================================
32. DOCUMENT MANAGEMENT
==================================================

Use Supabase Storage.

Documents can belong to:

Client
Project
Invoice
Expense
Employee
Company

Support:

Upload
Preview
Download
Delete
Search
Filter

Store:

File name
File type
File size
Storage path
Related record
Upload date

==================================================
33. CALENDAR
==================================================

Create a business calendar.

Events:

Client Payment
Invoice Due
Subscription Renewal
Company Expense
Salary
Project Deadline
Domain Renewal
Hosting Payment

Clicking an event should open the related record.

==================================================
34. REPORTS
==================================================

Create Reports Center.

Reports:

Profit & Loss
Income Report
Expense Report
Cash Flow
Revenue Analysis
Expense Analysis
Outstanding Payments
Upcoming Payments
Monthly Financial Report
Yearly Financial Report
Client Report
Project Report
Employee Report
Invoice Report
Subscription Report

Every major report must support:

PDF
CSV

==================================================
35. PROFIT & LOSS
==================================================

Calculate:

TOTAL REVENUE

minus

TOTAL EXPENSES

equals

NET PROFIT

Revenue:

Project Revenue
Subscription Revenue
Other Income

Expenses:

Salaries
Hosting
Software
Marketing
Office
Transportation
Equipment
Other

Allow:

Monthly
Quarterly
Yearly
Custom

==================================================
36. CASH FLOW
==================================================

Show:

Opening Balance
Money In
Money Out
Net Cash Flow
Closing Balance

Do not fake opening/closing balances.

If starting balance is required, create a configurable company opening balance in Financial Settings.

==================================================
37. REVENUE ANALYTICS
==================================================

Show:

Monthly Revenue
Yearly Revenue
Revenue by Client
Revenue by Service
Revenue by Project

Use:

Black
Purple
Gray

No rainbow charts.

==================================================
38. EXPENSE ANALYTICS
==================================================

Show:

Monthly Expenses
Yearly Expenses
Expenses by Category
Recurring Expenses
Salary Expense
Operational Expense

==================================================
39. OUTSTANDING PAYMENTS
==================================================

Calculate:

Invoice Total
minus
Paid

Show:

Client
Invoice
Project
Total
Paid
Balance
Due Date
Days Overdue

Actions:

View
Record Payment

==================================================
40. UPCOMING PAYMENTS
==================================================

Show expected client payments.

Filters:

This Week
This Month
Next Month
Custom

Include:

Client
Project
Invoice
Amount
Due Date
Status

==================================================
41. UPCOMING COMPANY EXPENSES
==================================================

Show:

Salary
Hosting
Software
Domain
Marketing
Recurring Expenses

Calculate expected outgoing money.

==================================================
42. COMPANY FINANCIAL SUMMARY
==================================================

Dashboard must show:

Total Revenue
Total Expenses
Net Profit
Outstanding
Expected Income
Expected Expenses
Monthly Recurring Revenue
Annual Recurring Revenue

==================================================
43. ADMIN PROFILE
==================================================

Create:

Profile

Personal Information

Full Name
Email
Phone
WhatsApp
Profile Photo

Company Information

Company Name
Registration Number
Address
Phone
Email
Website
VAT Information

Security

Change Password
2FA
Last Login
Login History

Preferences

Currency
Timezone
Date Format
Language

==================================================
44. SETTINGS
==================================================

Create:

General
Company Profile
Invoice Settings
Payment Settings
Tax & VAT
Financial Settings
Notifications
Security
Appearance
Backup & Data

==================================================
45. COMPANY SETTINGS
==================================================

Store:

Company Name
Logo
Registration Number
Address
Phone
Email
Website
LinkedIn
Social Links
VAT Information
Bank Information

Upload:

Company Logo
Invoice Logo
Signature

These settings must automatically appear on invoices and reports.

==================================================
46. INVOICE SETTINGS
==================================================

Configure:

Invoice Prefix
Starting Number
Default Payment Terms
Default Notes
Terms & Conditions
Bank Details
Invoice Footer
Invoice Logo
Signature

==================================================
47. PAYMENT SETTINGS
==================================================

Configure:

Payment Methods
Default Payment Method
Reminder Timing
Overdue Threshold

==================================================
48. TAX SETTINGS
==================================================

Configure:

VAT Enabled
VAT Number
Default VAT Rate
Tax Inclusive/Exclusive

==================================================
49. FINANCIAL SETTINGS
==================================================

Configure:

Financial Year
Currency
Opening Balance
Income Categories
Expense Categories
Payment Categories

==================================================
50. NOTIFICATION SETTINGS
==================================================

Admin can configure:

Payment Due
Overdue Payment
Subscription Renewal
Salary Reminder
Expense Reminder
Project Deadline
Invoice Reminder

Notification timing:

7 days
3 days
1 day
Same day

==================================================
51. SECURITY
==================================================

Implement:

Protected routes
Secure authentication
Session handling
Password change
Optional 2FA
Logout
Logout all sessions
Last login
Activity log

Never expose Supabase service-role keys to the frontend.

Use environment variables.

==================================================
52. ACTIVITY LOG
==================================================

Record important administrator actions.

Examples:

Client created
Client updated
Project created
Invoice created
Invoice edited
Payment recorded
Expense added
Subscription created
Employee created
Salary recorded
Settings changed
Document uploaded

Show:

Action
Description
Date
Time

==================================================
53. SEARCH
==================================================

Global search must search:

Clients
Projects
Invoices
Payments
Expenses
Employees
Subscriptions
Documents

Group results.

Example:

ABC

Clients
ABC Construction

Projects
ABC Website

Invoices
XP-INV-001

Payments
ABC Payment

==================================================
54. DATA VALIDATION
==================================================

Validate every form.

Required fields.

Correct numeric values.

Correct dates.

No negative invoice totals.

No duplicate invoice numbers.

No payment greater than remaining invoice balance unless explicitly allowing overpayment.

No invalid salary calculations.

No invalid recurring dates.

Show clear validation messages.

==================================================
55. DATABASE
==================================================

Create normalized PostgreSQL tables.

Recommended:

admin_profile

company_settings

clients

services

projects

project_milestones

invoices

invoice_items

payments

income_transactions

expense_categories

expenses

recurring_expenses

subscriptions

employees

salary_records

documents

activity_logs

notification_settings

financial_settings

invoice_settings

payment_settings

tax_settings

app_settings

Do not store unrelated information in one giant table.

Use foreign keys.

Use timestamps.

Use proper indexes.

Use constraints where appropriate.

==================================================
56. DATABASE RELATIONSHIPS
==================================================

Client:

clients
↓
projects
↓
project_milestones

Client:

clients
↓
invoices
↓
invoice_items

Client:

clients
↓
payments

Client:

clients
↓
subscriptions

Employee:

employees
↓
salary_records

Company:

income_transactions
+
expenses
↓
financial reports

==================================================
57. SUPABASE SECURITY
==================================================

Use Supabase Row Level Security.

Because this is one-admin software:

Only the authenticated administrator should access business data.

Users who are not authenticated must have no access.

Do not expose financial data publicly.

Storage files must also be protected.

==================================================
58. REAL DATA
==================================================

Do not leave the application dependent on mock data.

You may use temporary seed/demo data during development.

But the final system must use Supabase.

Every:

Create
Read
Update
Delete

must work with the database.

==================================================
59. LOADING STATES
==================================================

Every database operation needs:

Loading

Success

Error

Empty state

Do not freeze the interface.

Use skeleton loaders where appropriate.

==================================================
60. TOAST SYSTEM
==================================================

Use clean notifications.

Examples:

"Client created successfully."

"Invoice saved."

"Payment recorded."

"Expense added."

"Salary saved."

"PDF generated."

"Settings updated."

==================================================
61. ERROR HANDLING
==================================================

Handle:

Authentication errors
Database errors
Network errors
PDF generation errors
File upload errors
Validation errors

Never expose technical stack traces to the user.

==================================================
62. RESPONSIVE DESIGN
==================================================

Desktop-first.

Support:

1440px
1280px
1024px
768px
Mobile

On mobile:

Sidebar becomes drawer.

Tables become responsive.

Forms become single-column.

Dashboard metrics stack.

Invoice builder becomes single-column.

==================================================
63. ANIMATION
==================================================

Use Framer Motion subtly.

Page transition:
fade + slight movement

Cards:
small hover

Modal:
fade + scale

Sidebar:
smooth transition

Charts:
subtle entry animation

Duration:

150–250ms.

Do not use excessive animation.

==================================================
64. PDF EXPORT
==================================================

Implement real PDF exports.

Invoice PDF

Financial Report PDF

Client Report PDF

Project Report PDF

Employee Report PDF

Expense Report PDF

Payment Report PDF

PDF should contain:

XYPhora Prime branding
Report title
Date range
Generated date
Data
Totals
Footer

==================================================
65. CSV EXPORT
==================================================

Implement real CSV downloads.

Support:

Clients
Projects
Invoices
Payments
Income
Expenses
Subscriptions
Employees
Salaries
Reports

Ensure CSV values are properly escaped.

==================================================
66. ADMIN PROFILE MENU
==================================================

Top-right menu:

Profile
Settings
Logout

Admin avatar.

Show last login inside profile/security area.

==================================================
67. QUICK CREATE
==================================================

Global "+ Create" menu:

New Client
New Project
New Invoice
Add Payment
Add Expense
Add Employee
Add Subscription

Each action should navigate to the appropriate functional form.

==================================================
68. INVOICE PAYMENT WORKFLOW
==================================================

Example:

Create invoice:

LKR 300,000

Status:
Pending

Record:

Advance:
LKR 100,000

System:

Paid:
100,000

Balance:
200,000

Status:
Partial

Record:

Final:
200,000

System:

Paid:
300,000

Balance:
0

Status:
Paid

Dashboard and reports must update automatically.

==================================================
69. SUBSCRIPTION WORKFLOW
==================================================

Example:

Client:
ABC

Service:
Website Management

Amount:
LKR 15,000

Billing:
Monthly

Next payment:
10 Sep

When payment recorded:

Last payment:
10 Sep

Next payment:
10 Oct

Status:
Active

==================================================
70. RECURRING EXPENSE WORKFLOW
==================================================

Example:

Cloud Hosting

LKR 18,500

Monthly

Next:
10 Sep

After payment:

Last:
10 Sep

Next:
10 Oct

==================================================
71. FINANCIAL ACCURACY
==================================================

Do not manually hard-code financial totals.

Calculate totals from transaction records.

Revenue:
sum of valid income/payment transactions.

Expenses:
sum of valid expense transactions.

Profit:
Revenue - Expenses.

Outstanding:
Invoice total - payments applied.

Recurring revenue:
sum active recurring subscriptions.

Recurring expenses:
sum active recurring company expenses.

==================================================
72. DASHBOARD PERFORMANCE
==================================================

Do not make dozens of unnecessary database requests.

Use efficient queries.

Use aggregated queries/views where appropriate.

Cache static settings where reasonable.

Keep dashboard fast.

==================================================
73. ACCESSIBILITY
==================================================

Use:

Proper labels

Keyboard navigation

Visible focus states

Accessible buttons

Readable contrast

ARIA labels where needed

Do not sacrifice accessibility for visual appearance.

==================================================
74. DARK MODE
==================================================

Provide dark mode.

Dark:

#080808 background
#111111 surface
#171717 secondary
#FFFFFF text
#A3A3A3 muted
#262626 border
#8B5CF6 purple

The dark mode should feel premium and cinematic.

==================================================
75. LIGHT MODE
==================================================

Default mode:

White/off-white main content.

Dark sidebar.

Purple accent.

This should closely match the reference design.

==================================================
76. DESIGN RULE
==================================================

Do not redesign each page independently.

Create ONE design system.

Every page must look like it belongs to the same XYPhora Prime product.

Use the same:

Typography
Spacing
Buttons
Tables
Forms
Badges
Icons
Cards
Modals
Charts
Navigation

==================================================
77. ICONS
==================================================

Use Lucide React icons.

Icons must be:

Minimal
Elegant
Consistent
Thin/medium stroke
Professional

Do not use emojis as UI icons.

Do not use random icon libraries.

Use icons appropriate to each function.

Examples:

Dashboard → LayoutDashboard
Clients → Users
Projects → Briefcase
Invoices → FileText
Payments → CreditCard
Expenses → Receipt
Employees → UserRound
Reports → ChartNoAxesCombined
Settings → Settings
Calendar → CalendarDays
Documents → FolderOpen

==================================================
78. TABLE QUALITY
==================================================

Tables must support:

Search
Filter
Sort
Pagination
Actions
Export

Use:

Thin borders
Compact spacing
Clear typography
Hover states

Do not create oversized tables with huge row heights.

==================================================
79. FORM QUALITY
==================================================

Forms should be logically grouped.

Use sections.

Example:

Client Information

Contact Information

Business Information

Additional Information

Use proper validation.

Do not create giant forms without grouping.

==================================================
80. EMPTY STATES
==================================================

Example:

"No clients yet."

"Add your first client to start managing your business."

Button:

"Add Client"

Keep empty states minimal and premium.

==================================================
81. FINAL PAGE ROUTES
==================================================

Create these routes:

/login

/dashboard

/clients

/clients/new

/clients/:id

/projects

/projects/new

/projects/:id

/services

/invoices

/invoices/new

/invoices/:id

/payments

/income

/expenses

/expenses/new

/subscriptions

/subscriptions/new

/employees

/employees/new

/employees/:id

/salaries

/salaries/new

/calendar

/documents

/reports

/reports/profit-loss

/reports/income

/reports/expenses

/reports/cash-flow

/reports/clients

/reports/projects

/reports/employees

/activity

/profile

/settings

/settings/company

/settings/invoices

/settings/payments

/settings/tax

/settings/financial

/settings/notifications

/settings/security

/settings/appearance

/settings/backup

==================================================
82. IMPLEMENTATION PRIORITY
==================================================

Build in this order.

PHASE 1 — AUTHENTICATION

1. Login
2. Supabase authentication
3. Protected routes
4. Session handling
5. Logout
6. Forgot password

PHASE 2 — CORE BUSINESS

7. Application shell
8. Dashboard
9. Clients
10. Client profiles
11. Services
12. Projects

PHASE 3 — MONEY

13. Invoices
14. Invoice builder
15. Invoice preview
16. PDF generation
17. Payments
18. Income
19. Expenses

PHASE 4 — RECURRING

20. Client subscriptions
21. Recurring expenses
22. Upcoming payments
23. Financial calendar

PHASE 5 — TEAM

24. Employees
25. Employee profiles
26. Salary records
27. Salary history

PHASE 6 — REPORTING

28. Financial reports
29. P&L
30. Cash flow
31. Client reports
32. Project reports
33. Employee reports
34. PDF/CSV exports

PHASE 7 — ADMIN

35. Profile
36. Settings
37. Security
38. Notifications
39. Backup
40. Activity log

==================================================
83. IMPORTANT DEVELOPMENT RULE
==================================================

Do NOT attempt to build a fake finished dashboard first.

Build the actual system layer by layer.

The login must work first.

Then database.

Then clients.

Then projects.

Then invoices.

Then payments.

Then finance.

Then reports.

The UI must always be connected to real functionality.

==================================================
84. FINAL QUALITY CHECK
==================================================

Before considering the application complete, verify:

LOGIN
✓ Admin can log in
✓ Invalid credentials handled
✓ Logout works
✓ Protected routes work
✓ Session persists

CLIENTS
✓ Create
✓ Edit
✓ Delete
✓ Search
✓ Filter
✓ View profile

PROJECTS
✓ Create
✓ Edit
✓ Status
✓ Progress
✓ Payment milestones

INVOICES
✓ Create
✓ Edit
✓ Preview
✓ Automatic number
✓ Calculate totals
✓ PDF
✓ Status

PAYMENTS
✓ Record
✓ Advance
✓ Partial
✓ Full
✓ Balance calculation
✓ Invoice updates

EXPENSES
✓ Create
✓ Edit
✓ Delete
✓ Recurring expenses

SUBSCRIPTIONS
✓ Monthly
✓ Yearly
✓ Next payment
✓ Payment history

EMPLOYEES
✓ Create
✓ Edit
✓ Profile

SALARIES
✓ Monthly records
✓ Flexible salary components
✓ History
✓ PDF/CSV

REPORTS
✓ Revenue
✓ Expenses
✓ Profit
✓ Cash flow
✓ Outstanding
✓ Upcoming

SETTINGS
✓ Company
✓ Invoice
✓ Payment
✓ Tax
✓ Financial
✓ Notifications
✓ Security
✓ Appearance
✓ Backup

EXPORT
✓ PDF
✓ CSV

==================================================
85. FINAL VISUAL REQUIREMENT
==================================================

The application must visually match the provided XYPhora Prime reference design.

Use:

BLACK
WHITE
PREMIUM PURPLE

The interface should feel:

Luxury
Premium
Minimal
Executive
Modern
Professional

The application must look like a product built specifically for XYPhora Prime.

Do not make it look like:

A generic admin template
A school project
A basic accounting application
A colorful CRM
A template marketplace UI

The final experience should feel like:

"XYPhora Prime Business OS"

A private executive system where the administrator can understand and manage the entire company from one place.

The most important visual principle:

BLACK = authority
WHITE = clarity
PURPLE = XYPhora Prime identity

Use whitespace confidently.

Keep the interface clean.

Keep information hierarchy strong.

Do not add unnecessary elements.

Build the real system, not just the appearance.