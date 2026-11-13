# Deploying Polymath

The site runs on Vercel. The database and sign-in are on Supabase. Do these steps in order. You need the Supabase project from step 0 of `docs/CURSOR_GUIDE.md` and the GitHub repository `Abhi2748/polymath`.

## 1. Prepare Supabase (once)

Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).

1. **Create your user.** Authentication → Users → Add user → Create new user. Enter the address you put in `ALLOWED_EMAIL`, type any password (it is never used) and tick **Auto Confirm User**.
2. **Close sign-ups.** Authentication → Sign In / Providers. Turn off **Allow new users to sign up**. Leave the **Email** provider on. The app also refuses every address except `ALLOWED_EMAIL`, but with sign-ups closed nobody else can even get an account.
3. **Set the email.** Authentication → Emails → Templates → **Magic Link**. Set the subject to `Sign in to Polymath` and replace the body with:

   ```html
   <h2>Sign in to Polymath</h2>
   <p><a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
   <p>Or type this code: {{ .Token }}</p>
   ```

   Save. The link signs you in in whichever browser opens it. The code is for when the link opens in the wrong place (see step 5).
4. **Apply the migrations** from your computer, in the project folder:

   ```
   pnpm db:migrate
   ```

   This includes `drizzle/0001_rls.sql`, which turns on row-level security for every table. The app connects as the table owner, so it is unaffected. The public anon key can no longer read or write your data through Supabase's REST API.

## 2. Create the Vercel project (once)

1. Commit and push your work: `git push`.
2. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub and import `Abhi2748/polymath`. Vercel detects Next.js. Leave the build settings as they are.
3. Before clicking Deploy, open **Environment Variables** and add these five, for the Production and Preview environments:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | The same value as in your `.env.local`: Supabase → Connect → **Session pooler** connection string, with your database password filled in |
   | `NEXT_PUBLIC_SUPABASE_URL` | Same as `.env.local`: Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `.env.local`: Supabase → Project Settings → API → `anon` `public` key |
   | `ALLOWED_EMAIL` | Your address, exactly as in `.env.local` |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1`, so Vercel uses the pnpm version named in `package.json` |

   The two `NEXT_PUBLIC_` values are baked in when the site is built. If you change them later, redeploy.
4. Click **Deploy**. When it finishes, note the address, for example `https://polymath-abhi.vercel.app`.

## 3. Tell Supabase the address (once)

Authentication → URL Configuration:

- **Site URL**: your Vercel address, for example `https://polymath-abhi.vercel.app`.
- **Redirect URLs**: add your Vercel address and `http://localhost:3000`, so links work for the deployed site and for `pnpm dev`.

If an address is missing here, Supabase sends the link to the Site URL instead.

## 4. Sign in

1. Open your Vercel address. You land on the sign-in page.
2. Enter your address and tap **Email me a sign-in link**.
3. Open the email and tap **Sign in**, or type the code into the page.

The first sign-in creates your settings row: 30-minute sessions, 2 new lessons a day, no fields switched off. The time zone is guessed from your connection, or from the browser if you used the code. You can change it in Settings once that screen exists.

## 5. Put it on your phone

- **iPhone (Safari).** Open the address, tap Share → **Add to Home Screen**. Then open Polymath from the home screen and sign in there. An app added to the home screen keeps its own sign-in, separate from Safari. Email links open in Safari, so inside the installed app use the **code** from the email.
- **Android (Chrome).** Open the address, sign in, then menu → **Install app** (or Add to Home screen). It shares Chrome's sign-in.

The icon is the teal ring. The bar at the top follows the phone's light or dark setting.

## Later deploys

Every push to the main branch deploys to production. If a change adds a migration under `drizzle/`, run `pnpm db:migrate` before pushing.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| The email says "Signups not allowed for otp" or never arrives | The user from step 1.1 is missing, or the address differs from `ALLOWED_EMAIL`. Supabase's built-in email sender allows only a few emails an hour, so wait and try once more |
| The link opens the sign-in page saying it expired | Some mail apps open links to scan them, which uses them up. Type the code instead |
| The link goes to the wrong site | Add the address to Redirect URLs (step 3) |
| Every page shows "This site is private" | `ALLOWED_EMAIL` on Vercel does not match the address you signed in with. Fix it and redeploy |
| The build fails on `DATABASE_URL` or the Supabase variables | One of the environment variables in step 2.3 is missing for that environment |
