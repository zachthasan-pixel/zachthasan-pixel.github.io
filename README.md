# Dr. Zahir Hasan — author website

Live at **https://drzahirhasan.com** (GitHub Pages, plain HTML, no build step on the server).

## How the site is put together

- `catalog/catalog.json` — the list of every book. **This is a copy of the shared catalogue
  kept in the `maple-and-pine-website` repository.** Both sites are built from the same file,
  so a new book is added there, not here.
- `css/site.css` — the stylesheet, built on the same design as mapleandpinepress.com (green accent instead of brick red). `css/styles.css` is the older stylesheet, still used by the inner content of the apps page, the two series pages and the games.
- `scripts/build-site.mjs` — turns the catalogue into the home page, the four book-list pages
  (`fiction.html`, `childrens-books.html`, `political-science.html`, `education.html`), one page
  per book in `books/`, and `sitemap.xml`. It also refreshes the header and footer of the
  hand-written pages. Run it with `node scripts/build-site.mjs`.
- `scripts/make-thumbs.py` — makes the small cover images used in the grids
  (`images/covers/thumbs/`). Run it after adding a cover.
- `.github/workflows/sync-catalog.yml` — does both of the above every night from the shared
  catalogue and commits the result, so the site stays in step with Maple & Pine automatically.

Hand-written pages, edited directly: `about.html`, `contact.html`, `apps.html`,
`whispering-realms.html`, `elk-kingdom.html`, and the browser games in their own folders
(`lootgoblin/`, `magneticchaos/`, `earthfall/`, `cinch/`, `lineburst/`).

## Adding a book

1. Add it to `catalog/catalog.json` in the Maple & Pine repository, with its cover.
2. Wait for the nightly run, or open the **Actions** tab here and run
   "Sync catalogue and rebuild book pages" by hand.

## Newsletter

Signup forms post to the Kit account (form "Dr Zahir Hasan author site"). Subscribers,
signup counts and sending all live in Kit.

## Custom domain

`drzahirhasan.com` is registered at Cloudflare and points at GitHub Pages; the `CNAME` file
in this repository holds the domain. `www` redirects to the bare domain.
