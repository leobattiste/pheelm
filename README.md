# Pheelm

A global directory of films by Black directors: features, documentaries, shorts and animation, with cast and crew, awards, trailers and where to watch.
Built with Next.js, hosted on Vercel, with accounts and the database on Supabase. It shares its design and setup with Covvvvvers.

- **Films**: browse and filter by type, decade, country, language and genre.
- **Directors**: biographies, countries, careers and filmographies.
- **Collections**: curated selections by movement, theme, country, decade or genre.
- **Journal**: stories behind films, interviews, essays and film history.
- **Members** sign in with an email link to keep a watchlist, mark films as seen and submit films.
- **Admins** add and edit everything at `/admin`, review submissions and import film data from TMDB.

The site starts with 74 films by 54 directors in 13 collections. It runs straight away without Supabase, reading `data/catalog.json`, so you can deploy and look around before setting anything up.

## Launch it

### 1. Set up Supabase (about 5 minutes)

1. Create a project at [supabase.com](https://supabase.com). The free plan is enough.
2. Open **SQL Editor** and run these files in order, each in a new query:
   1. `supabase/schema.sql`: tables and permissions
   2. `supabase/storage.sql`: a public `images` bucket for posters and portraits
   3. `supabase/seed.sql`: the starter catalog
3. Go to **Project Settings > API** and copy the **Project URL** and the **anon / publishable key**.

All three files are safe to run again. Re-running `seed.sql` refreshes the starter facts but keeps posters, trailers and viewing links you've added since.

### 2. Deploy on Vercel

1. At [vercel.com/new](https://vercel.com/new), import this repository.
2. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon or publishable key
   - `NEXT_PUBLIC_SITE_URL`: your site's address, e.g. `https://pheelm.vercel.app`
3. Click **Deploy**.

### 3. Connect sign-in to your address

In Supabase, go to **Authentication > URL Configuration**:

- **Site URL**: your Vercel address
- **Redirect URLs**: add `https://YOUR-ADDRESS/auth/callback` (and `http://localhost:3000/auth/callback` to run it on your computer)

For members' collections, following directors, people's TMDB details, and the newsletter and contact inbox, also run `supabase/member-collections.sql`, `supabase/follows.sql`, `supabase/people-details.sql` and `supabase/platform.sql` (all are included in `schema.sql` too).

To show your contact email, Instagram and Threads in the footer and on the Contact page, add `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_INSTAGRAM_URL` and `NEXT_PUBLIC_THREADS_URL` in Vercel and redeploy. Newsletter sign-ups and messages appear in `/admin/inbox`, where the list can be downloaded as a CSV for your email service.

Then paste the two sign-in email templates from `supabase/email-templates.md` into **Authentication → Emails → Templates**. They make sign-in links work on phones and add a 6-digit code people can type instead.

### 4. Make yourself the admin

Sign in on the live site once, then run this in the Supabase SQL Editor with your email:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Open `/admin`.

## Posters and film data

Every film shows a designed placeholder poster until it has a real one. There are two ways to add them:

- **By hand**: in `/admin/films`, open a film and paste a poster link or upload an image.
- **From TMDB (recommended)**: get a free API key at [themoviedb.org](https://www.themoviedb.org/settings/api), add it in Vercel as `TMDB_API_KEY` and redeploy. In `/admin`, press **Import from TMDB** to fill every film missing a poster, or use the button in any film's editor.

The import fills only empty fields, so anything you've written stays. It adds posters, backdrops, synopses, runtimes, genres, languages, missing cast and crew, YouTube trailers, director portraits and birth years, and streaming, rental and purchase options for the US (set `TMDB_WATCH_REGIONS` to another country code, like `GB`, to use that country instead). Viewing options come from JustWatch through TMDB and are refreshed every time you import. Each service button on a film page opens a search for the film on that service; services the site can't search are left out. Awards aren't in TMDB, so add them in each film's editor.

TMDB's free tier is for non-commercial sites. The footer credit it requires appears automatically once the key is set.

## Editing the catalog

Everything is editable in `/admin`:

- **Films**: details, synopsis, cast and crew (one line per person, like `director: Spike Lee` or `cast: Danny Aiello as Sal`), poster, trailer, awards (`Cannes Film Festival | Grand Prix | won | 2019`), where to watch (`Criterion Channel | https://… | stream | US`) and collections. New films start as drafts.
- **Directors & people**: bios, countries, birth years and portraits. People are created from film credits.
- **Collections**: pick films with checkboxes; featured collections appear on the home page.
- **Journal**: write in simple Markdown with a live preview, attach films, publish when ready.
- **Submissions**: approving one creates a draft film (imported from TMDB when it's on) and opens it for checking.

To change the starter catalog before going live, edit `data/starter.mjs` and run `npm run seed`, which rebuilds `data/catalog.json` and `supabase/seed.sql`.

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # optional: fill in your keys
npm run dev
```

Change the name and tagline in `lib/site.ts`.

## Design

Pheelm is dark by default (visitors can switch to light in the footer). Everything is set in one typeface, Nacelle by Dotcolon (SIL Open Font License), served from the site itself. Each film page takes its colour from the film's poster: the TMDB import measures it automatically, and you can override it in the film's editor. Until a film has a poster, it gets a title card in a colour picked from its name.

The home page's film of the week rotates through films marked "Feature on the home page", preferring those with a still. Search opens with ⌘K, Ctrl+K or "/".
