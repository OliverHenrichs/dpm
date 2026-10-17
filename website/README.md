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
| `index.html` | The landing page: what DPM is, and a card for each of the four pages below |
| `yourself.html` | **Yourself**: keeping track of your own progress. List, Map and Reels, filtering, modifiers, the video tools |
| `sharing.html` | **Sharing**: classmates or friends following one list that one of them keeps. Publishing, suggestions, _Put online_, passing a file round |
| `teaching.html` | **Teaching**: a course list under the teacher's control. Members only, suggestion limits, video hosts with limited public access |
| `students.html` | **Students**: what a subscriber gets, and how to subscribe |
| (all pages) | The screenshots are real app screenshots (`img/shots/`) and follow the style and light or dark. Every page carries the same header (the four pages, `aria-current` on the one shown, and the style switcher) and footer, written out in each file: a change to either goes in all of them, and in `build-privacy.py` |
| `styles.css` | All styling. Both styles' colours, fonts and radii mirror `src/common/theme/tokens.ts` (`palettes`, `nativeFonts`, `radii`); the pattern-type colours are from `PatternType.ts`. A token changed in the app should change here too |
| `site.js` | The style switcher, loaded in every page's `<head>` so a returning visitor's style is set before the first paint |
| `fonts/` | DM Serif Display, Manrope, IBM Plex Sans Condensed and IBM Plex Mono as WOFF2, subset to Latin from `assets/fonts/`, with their OFL licences |
| `privacy.html` | **Generated** from `/PRIVACY_POLICY.md` by `build-privacy.py`. Edit the Markdown, not the HTML |
| `alpha.html` | Notes for the closed-test (alpha) testers: what the build does, its known limitations, where to send feedback. Hand-written; keep it in step with the release |
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

- `index.html`, `yourself.html`, `sharing.html`, `teaching.html`, `students.html`: `canonical`,
  `og:url`, `og:image`
- `404.html`: the `/dpm/` prefix (becomes `/` on a root domain)

## Before launch

- **Store badges.** When the listings go live, replace the "In development" line in the
  landing page's hero, and "On Android for now" on the Students page, with the official Google
  Play and App Store badges.
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
  blurred.
- **Sharing screenshots.** The share sheet (`share-*`) and the suggestion shots (`suggest-*`) come
  from the web build like the list shots, seeded with the same list marked as published (or, for
  the subscriber's form, subscribed). The web build has no Firebase, so for the shots only, a local
  patch turned `firebaseAvailable` on and had `PatternSuggestionService` hand back fixed
  suggestions (Mia's Reverse Whip and Jonas's Throwout) and two left today; nothing was published.
- **Privacy policy.** Keep `PRIVACY_POLICY.md` in step with the app: a new network connection,
  permission or kind of stored data belongs in it before it ships.
- **Impressum.** A site run from Germany may need an Impressum (§ 5 DDG), depending on whether it
  counts as commercial. That is a legal judgement, so it isn't included here.
