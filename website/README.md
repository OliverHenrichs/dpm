# DPM website

The public introduction to DPM: what the app is and what it does, plus its privacy policy. It is
plain static HTML and CSS, with no build step, no JavaScript, no web fonts and no third-party
requests. That keeps it cheap to host anywhere and free of cookie banners.

| File | What it is |
|---|---|
| `index.html` | The landing page. Graph, filter and modifier examples are real app screenshots (`img/shots/`); the sharing and video-tool illustrations are inline SVG drawn with the site's colour variables. Both follow light and dark mode |
| `styles.css` | All styling. The colours mirror `src/common/theme/tokens.ts` and the pattern-type colours in `PatternType.ts` |
| `privacy.html` | **Generated** from `/PRIVACY_POLICY.md` by `build-privacy.py`. Edit the Markdown, not the HTML |
| `404.html` | Not-found page, with absolute paths (see "Moving the site" below) |
| `img/shots/` | App screenshots, a light and a dark take of each (`name.webp`, `name-dark.webp`), 600 px wide |
| `img/` | Logo, favicons and the social preview image, derived from `assets/images/app-icon.png` and `store-assets/play-store-feature-graphic.png` |
| `.nojekyll`, `robots.txt` | Hosting housekeeping |

## Preview locally

```bash
python3 -m http.server 8765 --directory website   # → http://localhost:8765
```

After you edit `PRIVACY_POLICY.md`, regenerate the page with `python3 website/build-privacy.py`
(requires `pip install markdown`). The deploy workflow runs the same script, so the published copy
can't go stale.

## Deploying

`.github/workflows/pages.yml` publishes this folder to GitHub Pages on every push to `master` that
touches it (repository Settings → Pages → Source is set to **GitHub Actions**). The site is
served at `https://oliverhenrichs.github.io/dpm/`.

### Moving the site

These addresses are hard-coded and must change together when the site gets its own domain:

- `index.html`: `canonical`, `og:url`, `og:image`
- `404.html`: the `/dpm/` prefix (becomes `/` on a root domain)

## Before launch

- **Store badges.** When the listings go live, replace the "In active development" line in the
  hero with the official Google Play and App Store badges.
- **Screenshots.** The screenshots come from the app's web build at phone size (412 × 870), with a
  West Coast Swing course list ("WCS Beginners · Autumn 2026", tagged by course week) seeded into
  storage. Sharing and the video tools can't be shot there (no Firebase, Android-only), so those two
  are still drawn; replace them with device screenshots when a phone is at hand.
- **Privacy policy.** Keep `PRIVACY_POLICY.md` in step with the app: a new network connection,
  permission or kind of stored data belongs in it before it ships.
- **Impressum.** A site run from Germany may need an Impressum (§ 5 DDG), depending on whether it
  counts as commercial. That is a legal judgement, so it isn't included here.
