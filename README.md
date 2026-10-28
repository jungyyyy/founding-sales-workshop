# Founding Sales Workshop

A self-hosted sales workshop for two founders, built on Pete Kazanjy's book *Founding Sales*.
You and your co-founder work through nine modules. In each one you read a short brief, build a real piece
of your sales kit with an AI coach, practise it against an AI buyer, and get scored.

We built it for ourselves at [Myda](https://appmyda.com) because sales workshops are expensive and most
founders have never been taught to sell. It is not affiliated with the author or the book. Buy the book:
it is the curriculum, and this tool is only a way to practise it.

## What a module looks like

1. **Brief.** A distilled version of the chapter, ten minutes of reading. No book text is reproduced.
2. **Build.** A chat with the coach on the left, your artifact growing on the right: the narrative, the
   pricing, the ICP, the outreach playbook, the pitch runbook, and so on. One question at a time; vague
   answers get pushed back. Shared artifacts are DRAFT until the other founder accepts them, or you build
   them together in a shared session where both of you type into the same chat.
3. **Drill.** A role-play with a buyer persona who is busy, mildly sceptical and never hands you the win.
   Or a pair drill: your co-founder plays the buyer from a brief with a hidden agenda, you run the call for
   real, and paste the transcript.
4. **Debrief.** Scored against the module's rubric with quoted lines, one thing to fix next time, a CRM row,
   and the next module unlocked. Any debriefed drill unlocks the next module; a low score is a recommendation
   to repeat, not a gate.

The nine modules follow the book's chapters 1 to 9: mindset, narrative and pricing, sales materials,
prospecting and ICP, outreach, inbound, pitching, negotiation and closing, customer success.

## What you need

- Node 20 or newer.
- A free [Supabase](https://supabase.com) project. It holds the login allowlist and everything you build.
- An [Anthropic API key](https://console.anthropic.com) with billing enabled. Every coach turn, buyer turn
  and debrief is a paid API call. Debriefs grade with Claude Opus at high effort and are the expensive part;
  expect each one to cost a noticeable fraction of a dollar, more for long transcripts.
- About twenty minutes for setup. [DEPLOY.md](DEPLOY.md) walks through every step, including hosting it on Vercel.

## Quick start

1. Click **Use this template** on GitHub (or fork), then clone your copy.
2. `npm install`
3. Edit `content/founders.json`: your company name and the two founders. Slugs are lowercase identifiers;
   names are what the coach calls you.
4. Edit `supabase/migrations/0001_init.sql`: the same two slugs and names in the `founders` insert, and the
   email addresses that may log in. Run the three migrations in the Supabase SQL editor, in order.
5. `cp .env.local.example .env.local` and fill in the Supabase URL, the anon key and your Anthropic key.
6. Fill in `my-company/company.md`. It seeds your `company` artifact the first time you open the app.
7. `npm run dev`, open http://localhost:3000, enter an allowlisted email, click the magic link.

## Make it yours

The code is generic; the curriculum content was written for our company, and you should expect to edit it.

- `content/rules.md` is injected into every prompt. Read it once and change what does not fit how you work.
- `personas/*.md` are the three buyers we sell to (an agency founder, a brand's head of e-commerce, a brand
  co-founder who came inbound). Rewrite them for your market: the first line is `# Name — role`, the rest is
  free text the buyer model stays in character with. The drill scenarios in each module file name these personas.
- `content/modules/0N.json` holds the brief, the build spec and starting template, the drill scenario and the
  rubric for module N. The briefs use Myda, a tool for TikTok Shop brands, as the worked example when they
  explain the book's ideas. The build specs, templates and rubrics refer to your company as `{{company}}`,
  which is filled in from `content/founders.json`. `lib/types.ts` has the shape.
- The build specs and drill scenarios also assume our market in places (TikTok Shop brands and agencies,
  creator videos, a small pre-revenue team). The coach follows your company file over the spec, but skim each
  module's spec before you build it and edit anything that is clearly not your world.
- Adding a persona is adding a file. Changing a module is editing its JSON. No code changes needed for either.

## Stack

Next.js (App Router), TypeScript, Tailwind, Supabase (magic-link auth, Postgres, Realtime for shared
sessions), Anthropic SDK (streaming). All user data lives in your Supabase project. The repo holds code and
curriculum only. Nothing calls Anthropic from the browser; the key exists only on the server.

| Path | What |
|---|---|
| `content/founders.json` | Company name and the two founders |
| `content/rules.md` | Workshop rules, injected into every system prompt |
| `content/modules/0N.json` | Brief, build spec, drill scenario and rubric per module |
| `personas/*.md` | Buyer personas, reused across modules so history accumulates in the CRM |
| `my-company/company.md` | Seeds the first `company` artifact |
| `lib/prompts.ts` | Coach, buyer, grader and pair-brief system prompts |
| `lib/db.ts` | Every Supabase query, the unlock rule, progress |
| `supabase/migrations/` | Schema, allowlist, row-level security |

## Working together

**Shared Build sessions.** From Module 2 on, the Build screen has *Start shared session*. The other founder
joins from the dashboard. Both see the same chat and the same live artifact, either can type, and the coach
addresses whoever typed. Saves from a shared session list both founders as authors and skip the DRAFT step.

**Pair drills.** From a module's Drill tab, *Pair drill* asks who sells and which persona the other plays,
then writes two briefs: the seller gets public context only, the buyer gets everything plus a hidden agenda.
Run the call yourselves, paste the transcript, and the seller is scored on the rubric while the buyer gets a
note on how true to the persona they were.

## License

MIT for the code and the curriculum files in this repository. *Founding Sales* is © Pete Kazanjy; the book is
not included and is not needed to run the app.
