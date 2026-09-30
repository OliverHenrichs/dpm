# DPM website

The public introduction to DPM: what the app is and what it does, plus its privacy policy. It is
plain static HTML and CSS, with no build step, no JavaScript, no web fonts and no third-party
requests. That keeps it cheap to host anywhere and free of cookie banners.

| File | What it is |
|---|---|
| `index.html` | The landing page. The illustrations are inline SVG drawn with the site's colour variables, so they follow light and dark mode |
| `styles.css` | All styling. The colours mirror `src/common/theme/tokens.ts` and the pattern-type colours in `PatternType.ts` |
| `privacy.html` | **Generated** from `/PRIVACY_POLICY.md` by `build-privacy.py`. Edit the Markdown, not the HTML |
| `404.html` | Not-found page, with absolute paths (see "Moving the site" below) |
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
touches it. To enable it, go to **Settings → Pages → Source: GitHub Actions**. The site is then
served at `https://oliverhenrichs.github.io/dance-pattern-mapper/`.

### Moving the site

These addresses are hard-coded and must change together when the site gets its own domain:

- `index.html`: `canonical`, `og:url`, `og:image`
- `404.html`: the `/dance-pattern-mapper/` prefix (becomes `/` on a root domain)

## Before launch

- **Store badges.** When the listings go live, replace the "In active development" line in the
  hero with the official Google Play and App Store badges.
- **Screenshots.** The illustrations are drawn and don't show the real UI. Real device screenshots
  (graph, pattern details, transcript) would be more convincing.
- **Privacy policy.** `PRIVACY_POLICY.md` still lists the website as "N/A". It also predates the
  on-device models: downloading them from Hugging Face exposes the device's IP address to that
  host, which the policy should mention.
- **Impressum.** A site run from Germany may need an Impressum (§ 5 DDG), depending on whether it
  counts as commercial. That is a legal judgement, so it isn't included here.
