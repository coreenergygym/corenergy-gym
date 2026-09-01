# CoreEnergy The Gym — Member Record System

**Phase 1** built the foundation: public site, secure admin login,
one-time setup, database design, and the dashboard.

**Phase 2** (this update) adds:

- **Add New Member** — personal details, camera photo capture / upload
  (auto-compressed before it's stored), initial membership, and an
  optional first payment, all saved together
- **Members list** — search by name/mobile/Member ID, filters (Active,
  Expired, Expiring Soon, Paid, Unpaid, Recently Joined), photo thumbnails
- **Member Profile** — full personal + membership details, editable
  info, complete membership history, complete payment history
- **Renew Membership** — creates a new membership record without ever
  touching or deleting the old one; smart default start date so early
  renewals don't lose remaining paid days
- **Manual payments** — add a payment against the current membership,
  edit or delete any past payment (with a confirmation before deleting);
  due amounts and totals are calculated live from real payment records,
  so a correction anywhere is reflected everywhere automatically
- **WhatsApp buttons** — five separate pre-filled messages (Welcome,
  Payment Confirmation, Renewal, Expiry Reminder, Membership Details),
  each built from the member's real data

**Phase 3** (this update) completes the application:

- **Payments page** — a gym-wide view of every payment recorded across
  all members. Search by name/mobile/Member ID, filter by date range
  and payment method, add a payment against any member (with a quick
  member search), or edit/correct and delete a payment — all with the
  same live due-amount recalculation used on the Member Profile page
- **Statistics page** — Monthly view (New Members, Active Members,
  Memberships Expired, Renewals, Revenue, Total Payments Recorded,
  current Total Due, plan breakdown) and Yearly view (yearly totals,
  a month-by-month table, and simple bar charts for Monthly Revenue,
  New Members by Month, Active vs Expired, and Plan Distribution) —
  all calculated live from real data, never hand-entered
- **Settings page** — edit gym name, contact number, WhatsApp number,
  address, and the "Expiring Soon" day threshold; change the admin
  password (re-confirms the current password first)

The application is now feature-complete per the project specification.
No placeholder or "coming soon" pages remain.

No coding experience needed to follow this guide — just go step by step.

---

## Step 1 — Create your Supabase project (the database)

1. Go to https://supabase.com and sign up / log in.
2. Click **New Project**. Give it any name, set a database password
   (save it somewhere safe), and choose a region close to your gym.
3. Wait a minute or two for the project to finish setting up.

## Step 2 — Create the database tables

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open the file `supabase/schema.sql` from this project, copy
   **everything** in it, and paste it into the SQL Editor.
4. Click **Run**. You should see "Success. No rows returned."

This creates all the tables (members, memberships, payments, settings)
and locks them down so only a logged-in admin can read or write them.

### Step 2b — Run the Phase 2 addition

Open `supabase/schema-phase2.sql`, copy all of it, paste into a **new**
SQL Editor query, and click **Run**. This adds the safe, automatic
Member ID generator (CE-0001, CE-0002, …) used by the Add Member page.
If you already ran Phase 1's schema, just run this one file on top —
no need to redo Step 2.

## Step 3 — Get your project's connection details

1. In Supabase, click the **⚙️ Project Settings** icon, then **API**.
2. Copy the **Project URL**.
3. Copy the **anon public** key (NOT the "service_role" key — never use
   that one in this app).

## Step 4 — Configure the app

1. In this project folder, make a copy of `.env.example` and rename the
   copy to `.env`.
2. Open `.env` and paste in your values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. Save the file. Never share this file or commit it to a public GitHub repo
   (`.gitignore` already excludes it for you).

## Step 5 — Run it on your computer

You'll need [Node.js](https://nodejs.org) installed (download the "LTS" version).

Open a terminal in this project folder and run:

```
npm install
npm run dev
```

Open the link it shows (usually `http://localhost:5173`) in your browser.

## Step 6 — Create your admin account (one time only)

1. On the site, click **🔐 Admin Login**.
2. Since no admin exists yet, it will automatically send you to the
   **setup page** instead.
3. Enter the email and password you want to use as the gym owner/admin,
   and submit.
4. You'll be logged straight into the Dashboard. This setup page is now
   permanently disabled — visiting it again just says "Setup already
   complete."

### Important extra lock (recommended)

For a second layer of protection, go to Supabase → **Authentication** →
**Providers** → **Email**, and turn **off** "Allow new users to sign up."
This makes it impossible for anyone to create another account through
the app, even if they somehow found the setup page again.

### Password recovery configuration

The **Forgot password?** link on the login page calls Supabase's
built-in password reset email. For it to actually deliver emails:

1. In Supabase, go to **Authentication → Emails**, and confirm the
   "Reset Password" template is enabled (it is by default).
2. For real production use (not just testing), go to **Project
   Settings → Authentication → SMTP Settings** and connect your own
   SMTP provider — Supabase's default built-in email sender is rate
   limited and meant for development/testing only.
3. In **Authentication → URL Configuration**, make sure your site's
   real URL (e.g. `https://your-gym.netlify.app`) is added under
   **Redirect URLs**, so the reset link sends the owner back to the
   correct login page instead of `localhost`.

You can also change the admin password any time while logged in, from
**Settings → Admin Password** — no email required for that.

### WhatsApp message configuration

Nothing needs to be configured in `.env` for WhatsApp — each button
uses the **member's own saved mobile number** to build a `wa.me`
pre-filled link, so it always opens a chat with that specific member.
The **gym's own WhatsApp number** (shown on the public website's
contact section) is set from inside the app itself: **Settings →
WhatsApp Number**, saved to the database, not to an environment
variable.

## Step 7 — Put it online (Netlify)

1. Push this project to a GitHub repository (private is fine).
2. Go to https://netlify.com, sign up/log in, click **Add new site →
   Import an existing project**, and pick your repository.
3. Netlify will detect the build settings automatically from
   `netlify.toml`. Before deploying, click **Add environment variables**
   and add the two values from your `.env` file
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Click **Deploy**. After a minute, your site will be live at a
   `*.netlify.app` address (you can add your own domain later in
   Netlify's Domain settings).

### Updating the site later

Whenever you (or a developer) push a new commit to the connected GitHub
repository, Netlify automatically rebuilds and redeploys the site —
there's nothing extra to do. To trigger a rebuild without a code change
(e.g. after changing an environment variable), go to your site in
Netlify → **Deploys** → **Trigger deploy** → **Deploy site**.

---

## How the security works (in plain terms)

- Logging in is handled entirely by Supabase Auth — passwords are never
  stored or seen by this app's own code.
- Even if someone tried to read member data directly from the database
  without logging in, Supabase's **Row Level Security** rules (set up in
  `supabase/schema.sql`) refuse the request. Protection happens at the
  database itself, not just by hiding buttons on the screen.
- Member photos are stored in a **private** storage bucket — never a
  public one — so photo links can't be guessed or shared publicly.

## Project structure

```
src/
  pages/         one file per screen (Dashboard, AdminLogin, etc.)
  components/    shared pieces (sidebar layout, route protection)
  hooks/         useAuth — tracks whether an admin is logged in
  lib/           the Supabase connection
  styles/        global.css — all colors, fonts, spacing in one place
supabase/
  schema.sql     the entire database design — run this once in Supabase
```

## Project status

All planned features are built:
1. ~~Members page (search, filters, list)~~ ✅ done
2. ~~Add Member form (with camera photo capture)~~ ✅ done
3. ~~Member profile + membership renewal~~ ✅ done
4. ~~Payments (recording, editing, history)~~ ✅ done (from the profile page)
5. ~~WhatsApp message buttons~~ ✅ done
6. ~~Payments page — a gym-wide view across all members~~ ✅ done
7. ~~Statistics (monthly + yearly)~~ ✅ done
8. ~~Settings page~~ ✅ done

## Before you consider this production-ready

This code has been reviewed carefully, but it has **not been run
against a live Supabase project** in this environment. Before real
members' data goes into it, walk through the full test list from the
project specification against your own deployed copy — in particular:

- Create a fresh Supabase project, run `schema.sql` then
  `schema-phase2.sql`, and complete first-time admin setup.
- Add a member with a partial payment, add a second payment, and
  confirm the amount paid / due / status update correctly on the
  Member Profile, the Payments page, and the Dashboard.
- Renew a membership and confirm the old membership and its payments
  remain visible in Membership History.
- Check the Statistics page's Monthly and Yearly numbers against what
  you'd expect from the data you entered.
- Log out and confirm every `/admin/...` page redirects to Login, and
  that member/payment data cannot be fetched from the Supabase REST
  API without being logged in (RLS check).
- Test Add Member, camera capture, and all WhatsApp buttons on an
  actual phone.

## Basic troubleshooting

**Blank page / "Missing Supabase environment variables" in the console**
— your `.env` file is missing or the values weren't picked up. Confirm
`.env` exists (copied from `.env.example`), restart `npm run dev`, and
on Netlify confirm the environment variables are set under **Site
configuration → Environment variables** and redeploy.

**"Admin Login" sends you to Setup every time, even after creating an account**
— the `system_config` row's `setup_completed` value didn't get set to
`true`. Check **Table Editor → system_config** in Supabase; it should
have exactly one row with `setup_completed = true`.

**Camera capture doesn't open on a phone**
— camera capture requires **HTTPS** (Netlify provides this
automatically) and browser permission. It will not work over plain
`http://` except on `localhost`.

**Photo doesn't load / shows broken image**
— private photo URLs are short-lived signed links (1 hour). If you
left a page open for a long time, just refresh it. If it still fails,
confirm the `member-photos` storage bucket exists and is **not**
marked public.

**WhatsApp button does nothing**
— the member has no mobile number saved, or it's not a valid number.
Edit the member's info and add/correct their mobile number.

**Numbers on the Dashboard/Statistics look wrong**
— remember Revenue only counts payments you've actually recorded (see
"Important revenue rule" in the project spec). Check the Payments page
for the member/date range in question to see exactly what was recorded.

## Security hardening update (required before production use)

The Phase 3 source includes `supabase/security-hardening.sql` for existing projects.
Run it once in the Supabase SQL Editor before production testing.

This update:

- Makes the first Supabase Auth user the singleton gym admin using a database trigger.
- Locks setup in the database, even when email confirmation is enabled and the browser has no immediate session.
- Replaces broad `authenticated` access with admin-only RLS checks.
- Restricts private member-photo storage to the authorized gym admin.

### Important

For an existing project with multiple Auth users but no `admin_users` row yet, the migration safely assigns the oldest existing Auth user as the admin. Review your Auth users before running the migration if that is not the intended account.
