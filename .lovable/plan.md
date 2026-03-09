

## Ship Readiness Audit — What's Missing

After reviewing the full codebase, here's what needs to be done before Gold Rush is production-ready:

### Critical — Must Fix Before Ship

**1. Payments are not wired up**
The Buy Credits page (`/buy-credits`) has buttons that do nothing. No Stripe integration exists. Users cannot actually purchase credits. This needs Stripe Checkout sessions created via an edge function, with a webhook to credit the user's account.

**2. Email verification is skipped**
The Auth page signs users in immediately after signup with no email confirmation. This means anyone can create accounts with fake emails. Need to either enable email verification or explicitly confirm this is intentional.

**3. Credit deduction is not atomic / race-condition prone**
Credits are deducted client-side by reading the current value, subtracting 1, and writing back. Two simultaneous requests could both read "2" and write "1". This should be a server-side atomic decrement (e.g., a Postgres function `deduct_credit(user_id)`).

**4. Profile creation on signup is missing**
There's no trigger or code to insert a row into `profiles` when a user signs up. The `profiles` table has no INSERT RLS policy either. New users likely have no profile row, which would break credit checks.

### Important — Should Fix

**5. No error/empty states on Dashboard**
If the analysis pipeline fails, the user sees "failed" badge but no explanation or retry option.

**6. Buy Credits page has no auth guard**
Unauthenticated users can visit `/buy-credits` — minor since buttons do nothing, but should redirect to auth.

**7. Watchlist link missing from Dashboard nav**
Dashboard nav has Live and Admin links but no Watchlist link. Users can only reach Watchlist from the Report page.

**8. No loading/skeleton states**
Dashboard, Watchlist, and Report pages show nothing while data loads (just blank screen or `return null`).

**9. Mobile responsiveness gaps**
Dashboard nav items overflow on small screens. No hamburger menu or responsive nav pattern.

**10. No password reset flow**
Auth page has no "Forgot password?" link or flow.

### Nice to Have

**11. SEO / meta tags** — No page titles, descriptions, or OG tags.

**12. Rate limiting** — No protection against API abuse on edge functions (all have `verify_jwt = false`).

**13. Admin email seeding** — No admin email has been inserted into `admin_emails`, so nobody can access the admin panel yet.

---

### Recommended Ship Order

| Priority | Task | Effort |
|----------|------|--------|
| 1 | Create `profiles` insert trigger on signup | Small |
| 2 | Atomic credit deduction (DB function) | Small |
| 3 | Stripe integration for Buy Credits | Medium |
| 4 | Add your email to `admin_emails` | Tiny |
| 5 | Password reset flow | Small |
| 6 | Auth guards on all protected pages | Small |
| 7 | Loading skeletons & error states | Small |
| 8 | Watchlist link in Dashboard nav | Tiny |
| 9 | Mobile nav improvements | Medium |
| 10 | Edge function JWT verification | Small |

Want me to start implementing these in order?

