# ❄ Winter Arc Tracker

**92 days. 7 goals. 2 minutes a night.**

A web app for running a 92-day self-improvement "Winter Arc" (Oct 1 – Dec 31, 2026). It started as an Excel tracker and is now a multi-user app with cloud sync.

## Features

- **Nightly log**: tap Y/N for College, Internship, Gym, Diet and Assignments, then enter skill-study minutes, bed and wake times, and weight. The daily score updates as you type.
- **Automatic calculations**: sleep hours, sleep-on-target, skill-target-met (30 min on weekdays, 120 on Sunday), daily score, and your streak of good days (≥ 80%).
- **Dashboard**: progress ring, current phase, streaks, a hit-rate bar for each goal with a status, the weakest goal, a "never miss twice" warning, an arc calendar heatmap, a score chart, and weight vs. on-pace plan.
- **Assignments**: due-date flags (OVERDUE / DUE SOON / On track) and filters.
- **Weekly Review**: stats are pulled from the log each week, and you write your biggest win and one fix.
- **Plan**: 4-phase timeline, daily schedule, PPL gym split, Indian diet plan with macros, 80 → 60 kg weight projection, and an automations checklist.
- **Settings**: every target is editable, and the whole app recalculates when you change one.
- **Your data**: JSON backup and restore, CSV export (opens in Excel), and an erase-all option.
- **Accounts**: email/password login through Supabase. Row Level Security keeps each user's data private.
- **Demo mode**: try the app without an account. Data is saved in your browser.

## Tech

Plain HTML, CSS and JavaScript (ES modules) with no build step. Supabase provides Postgres and auth, Chart.js draws the charts, and GitHub Pages hosts the site.

```
index.html          app shell
css/styles.css      winter dark theme
js/app.js           views, routing, UI
js/calc.js          calculation engine (ports the Excel formulas)
js/store.js         Supabase + local storage adapters
js/data.js          plan content (gym, diet, schedule, phases)
js/config.js        ← your Supabase URL + anon key go here
supabase/schema.sql database tables + security policies
```

## Setup

### 1. Supabase (database + login)
1. Go to <https://supabase.com>, sign up, and click **New project** (free tier). Pick any name and a DB password, and wait about 2 minutes.
2. Open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `js/config.js`.
4. Open **Authentication → URL Configuration**. Set **Site URL** to your GitHub Pages URL (from step 2 below), e.g. `https://YOUR-USERNAME.github.io/winter-arc/`.
   - *Optional:* Authentication → Providers → Email → turn off "Confirm email" if you want sign-ups to work instantly.

### Optional: Apple, Google and phone sign-in
The app checks Supabase on load and only shows the buttons for methods that are switched on (Authentication → Sign In / Providers).
- **Google** (free): create an OAuth client in Google Cloud Console, add the Supabase callback URL `https://<project>.supabase.co/auth/v1/callback`, and paste the Client ID and secret into the Google provider.
- **Apple** (needs the $99/yr Apple Developer Program): create a Services ID and a Sign in with Apple key. Register the same callback URL and your site's domain, then paste the Services ID and generated secret into the Apple provider. The secret expires every 6 months.
- **Phone** (needs an SMS provider such as Twilio or MessageBird): enable the Phone provider and enter the SMS provider's credentials. Indian numbers typed without `+91` get it added automatically.

Also add your site to **Authentication → URL Configuration → Redirect URLs** so Apple/Google can send users back.

### 2. GitHub (no Git install needed)
1. Go to <https://github.com/new>. Name the repo `winter-arc`, make it **Public**, and click **Create repository**.
2. Click **uploading an existing file**. Drag in **everything inside** the `winter-arc` folder (index.html, README.md, manifest.webmanifest, and the folders css, js, assets, supabase), then click **Commit changes**.
3. Open **Settings → Pages**. Under Source, choose **Deploy from a branch**, then branch `main`, folder `/ (root)`, and click **Save**.
4. After about 1 minute the app is live at `https://YOUR-USERNAME.github.io/winter-arc/`.

To update the app later, open the file on GitHub, click ✏️ (edit) or "Add file → Upload files", and commit.

## Run locally
```bash
python -m http.server 5173
```
Then open <http://localhost:5173>.
