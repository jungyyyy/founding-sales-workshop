# Deploying the Founding Sales Workshop

Two founders, one hosted URL on Vercel, one shared Supabase project. Do the Supabase part first;
the app cannot log anyone in without it. Running it only on your laptop works too: do sections 1 to 3 and skip 4.

## 1. Supabase (once)

1. Go to https://supabase.com → **New project**. Pick the region closest to you, set a database password
   and save it somewhere safe.
2. **Project Settings → API**. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Open `supabase/migrations/0001_init.sql` in an editor. Near the top, replace the two founders in the
   `founders` insert with the slugs and names from your `content/founders.json`, and replace `FOUNDER1_EMAIL`
   and `FOUNDER2_EMAIL` with the addresses that may log in (add a row per extra address).
4. **SQL Editor → New query**. Paste the whole of `0001_init.sql` and run it. Then run
   `0002_collaboration.sql` and `0003_artifacts_view_authors.sql` the same way, in that order.
   This creates the tables, the allowlist, a sign-up trigger that rejects every other email, row-level
   security, and opens Module 1 for both founders. Realtime needs no setup.
5. **Authentication → Providers → Email**: enabled. Leave "Confirm email" on (that is the magic link).
   You do not need to disable sign-ups: the trigger refuses any email not on the allowlist.
6. **Authentication → URL Configuration**:
   - Site URL: your production URL once you have one, e.g. `https://your-app.vercel.app`; `http://localhost:3000` until then.
   - Redirect URLs, one per line:
     ```
     http://localhost:3000/auth/callback
     https://your-app.vercel.app/auth/callback
     https://*-your-vercel-account.vercel.app/auth/callback
     ```
     The third line covers Vercel preview deployments.
7. Supabase's built-in mailer is capped at a few emails per hour, which is enough for two people. If you hit
   the cap, set up a custom SMTP sender under **Project Settings → Auth → SMTP**.

Allowed emails live only in the `founder_allowlist` table. You can also set `NEXT_PUBLIC_FOUNDER_EMAILS`
(comma-separated) so the login form rejects other emails before calling Supabase; the table is the real gate.

## 2. Anthropic

1. https://console.anthropic.com → **API Keys → Create Key**. Copy it → `ANTHROPIC_API_KEY`.
2. **Billing**: add a payment method or prepaid credits, or every request fails.

## 3. Run locally (each founder)

```bash
git clone <your repository>
cd founding-sales-workshop
npm install
cp .env.local.example .env.local   # fill in the three values from steps 1–2
npm run dev
```

Open http://localhost:3000, enter your email, click the link in your inbox. The app never reads the book;
`book/` exists only so you can keep your own copy next to the code, and `book/*.pdf` is gitignored.

## 4. Vercel

1. https://vercel.com → **Add New → Project** → import your repository.
   Framework preset: Next.js. Root directory: `/`. Build command and output: defaults.
2. **Environment Variables** (Production, Preview and Development):

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | from step 2 |
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 |
   | `ANTHROPIC_MODEL` | optional, default `claude-opus-5-5` |
   | `NEXT_PUBLIC_FOUNDER_EMAILS` | optional, comma-separated founder emails for the login form pre-check |

3. **Deploy**. Copy the production URL and make sure it matches the Site URL and Redirect URL you entered
   in Supabase (step 1.6). If you later add a custom domain, add `https://<domain>/auth/callback` there too.
4. Invite your co-founder to the Vercel project (Settings → Members), or just share the URL.

### Function timeouts

The API routes declare `maxDuration = 300`. That is the ceiling on Vercel Hobby with fluid compute, which is on by
default for new projects (Settings → Functions → Fluid compute). Without fluid compute Hobby caps functions at
60 s and the deploy fails with "maxDuration must be between 1 and 60": enable fluid compute rather than lowering
the value. A debrief grades with Claude Opus at high effort; a long transcript takes a few minutes. The debrief
routes stream a heartbeat while they grade so the browser connection stays open. On Vercel Pro you may raise
`maxDuration` to `800`.

### Streaming

Build and drill replies stream as newline-delimited JSON from the server routes. Nothing calls Anthropic from the
browser; the key only exists on the server.

## 5. Checklist after first deploy

- [ ] Both founders can log in with a magic link on the hosted URL.
- [ ] Dashboard shows Module 1 open for both, 2–9 locked.
- [ ] Module 1 Build streams and the artifact appears on the right after the first good answer.
- [ ] A solo drill streams replies; Debrief writes a score, a CRM row, and unlocks Module 2.
- [ ] The other founder sees a shared artifact as DRAFT and can Accept it.
