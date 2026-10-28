# Founding Sales Workshop — notes for Claude Code

A Next.js app in which two founders learn B2B sales from Pete Kazanjy's *Founding Sales*:
each module has a Brief (distilled chapter), a Build (chat with an AI coach that writes a sales
artifact), a Drill (role-play with an AI buyer) and a Debrief (scored against a rubric).

## Where things are

- `content/founders.json` — company name and the two founders. The same slugs must exist in the
  `founders` table (`supabase/migrations/0001_init.sql`).
- `content/rules.md` — workshop rules injected into every system prompt. `{{company}}` is replaced at load time.
- `content/modules/0N.json` — brief, build spec and template, drill scenario, rubric. Shape in `lib/types.ts`.
  The briefs use Myda (the company this was built for) as the worked example; everything else says `{{company}}`.
- `personas/*.md` — buyer personas. First line is `# Name — role`.
- `my-company/company.md` — seeds the `company` artifact on first use; the app's artifact is the truth after that.
- `lib/prompts.ts` — coach, buyer, grader and pair-brief prompts. `lib/db.ts` — every Supabase query and the unlock rule.
- `app/api/*` — streaming routes; `maxDuration = 300` (Vercel fluid compute).

## Rules

- Never commit `book/*.pdf` or `.env.local` (both gitignored). The app does not read the PDF.
- Keep the Build phase one question at a time; keep the buyer in character; the grader scores substance, not recitation.
- Shared artifact keys are read from the module files at runtime; adding a module or persona needs no code change.
- Checks before pushing: `npx tsc --noEmit`, `npx eslint app lib components`, `npx next build`.
