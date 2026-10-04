# DPM website

The public introduction to DPM: what the app is and what it does, plus its privacy policy. It is
plain static HTML and CSS with no build step and no third-party requests: the fonts are the app's
own, served from this folder, and the one script is the style switcher. That keeps it cheap to
host anywhere and free of cookie banners.

The site comes in the app's two styles, **After Hours** (the default) and **Clipboard**, each in
light and dark. The switcher in the header sets `data-style="clipboard"` on `<html>` and remembers
the choice in the browser's `localStorage` (the privacy policy says so); light and dark follow the
system. Without JavaScript the switcher stays hidden and the page is After Hours.

| File | What it is |
|---|---|
| `index.html` | The landing page. The list, map, filter, modifier, Reels and video-tool examples are real app screenshots (`img/shots/`); the sharing illustration is inline SVG drawn with the site's colour variables. The screenshots and the SVG follow the style and light or dark |
| `styles.css` | All styling. Both styles' colours, fonts and radii mirror `src/common/theme/tokens.ts` (`palettes`, `nativeFonts`, `radii`); the pattern-type colours are from `PatternType.ts`. A token changed in the app should change here too |
| `site.js` | The style switcher, loaded in every page's `<head>` so a returning visitor's style is set before the first paint |
| `fonts/` | DM Serif Display, Manrope, IBM Plex Sans Condensed and IBM Plex Mono as WOFF2, subset to Latin from `assets/fonts/`, with their OFL licences |
| `privacy.html` | **Generated** from `/PRIVACY_POLICY.md` by `build-privacy.py`. Edit the Markdown, not the HTML |
| `404.html` | Not-found page, with absolute paths (see "Moving the site" below) |
| `img/shots/` | App screenshots, 600 px wide. Each shot comes four times: `name-ah.webp`, `name-ah-dark.webp` (After Hours) and `name-cb.webp`, `name-cb-dark.webp` (Clipboard); the page shows the copy for the current style (`.for-ah`, `.for-cb`) |
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
- **Screenshots.** The list, map, filter and modifier shots come from the app's web build at
  phone size (412 × 870, saved 600 px wide), with a West Coast Swing group list ("WCS · Thursday
  group", tagged by course and festival, with a rhythm on each figure and a manual network layout)
  seeded into storage, once per style and theme. The web build has no embedded fonts, so the shots
  load the app's font files and point `webFonts` at them; graph labels are set in a Roboto-like
  sans, as on Android.
- **Device screenshots.** The Reels (`reels*`) and video-tool (`video-*`) shots were taken on a
  Pixel with the dev build, in each style and theme: `adb exec-out screencap -p`, status bar
  cropped off, scaled to 600 px wide, WebP at quality 82. The class video in them is a recording
  whose dancers haven't consented, so every frame of the original footage is under a strong
  Gaussian blur (the tap markers are pasted back on top); the anonymized silhouettes are not
  blurred. Sharing can't be shot on the web build (no Firebase) and is still drawn; replace it
  with a device screenshot when a phone is at hand.
- **Privacy policy.** Keep `PRIVACY_POLICY.md` in step with the app: a new network connection,
  permission or kind of stored data belongs in it before it ships.
- **Impressum.** A site run from Germany may need an Impressum (§ 5 DDG), depending on whether it
  counts as commercial. That is a legal judgement, so it isn't included here.
