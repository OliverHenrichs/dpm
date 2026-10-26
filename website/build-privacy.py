#!/usr/bin/env python3
"""Render PRIVACY_POLICY.md and TERMS_OF_USE.md (the single sources) into
website/privacy.html and website/terms.html.

Run after editing either:  python3 website/build-privacy.py
Needs the `markdown` package (pip install markdown). The Pages workflow runs this before
deploying, so the published pages cannot drift from the Markdown.
"""

from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
# Source, page, title, description.
PAGES = [
    (
        "PRIVACY_POLICY.md",
        "privacy.html",
        "Privacy policy",
        "Privacy policy for DPM (Dance Pattern Mapper).",
    ),
    (
        "TERMS_OF_USE.md",
        "terms.html",
        "Terms of use",
        "Terms of use for sharing with DPM (Dance Pattern Mapper).",
    ),
]

TEMPLATE = """<!doctype html>
<!-- Generated from {source} by website/build-privacy.py. Do not edit by hand. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Alpha: keep the site out of search results until launch (website/README.md). -->
    <meta name="robots" content="noindex" />
    <title>{title} · DPM</title>
    <meta name="description" content="{description}" />
    <link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png" />
    <link rel="apple-touch-icon" href="img/apple-touch-icon.png" />
    <link rel="stylesheet" href="styles.css" />
    <script src="site.js"></script>
  </head>
  <body>
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="./">
          <img src="img/logo.png" alt="" width="36" height="36" />
          DPM
        </a>
        <nav class="site-nav" aria-label="Usage">
          <span class="nav-label" aria-hidden="true">Usage</span>
          <a href="yourself.html">On your own</a>
          <a href="sharing.html">With classmates</a>
          <a href="teaching.html">As a teacher</a>
          <a href="students.html">As a student</a>
        </nav>
        <div class="style-switch" role="group" aria-label="Page style, as in the app" hidden>
          <button type="button" data-style-choice="after-hours" aria-pressed="true"><span class="ah-label">After Hours</span></button>
          <button type="button" data-style-choice="clipboard" aria-pressed="false"><span class="cb-label">Clipboard</span></button>
        </div>
      </div>
    </header>
    <main class="wrap prose">
{body}
    </main>
    <footer class="site-footer">
      <div class="wrap">
        <span>© 2026 Oliver Henrichs</span>
        <nav aria-label="Footer">
          <a href="./">Home</a>
          <a href="privacy.html">Privacy policy</a>
          <a href="terms.html">Terms of use</a>
          <a href="impressum.html">Impressum</a>
          <a href="mailto:dance-pattern-mapper@pm.me">Contact</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
"""


def main() -> None:
    for source, page, title, description in PAGES:
        body = markdown.markdown(
            (ROOT / source).read_text(encoding="utf-8"),
            extensions=["tables", "sane_lists"],
            output_format="html",
        )
        target = ROOT / "website" / page
        target.write_text(
            TEMPLATE.format(
                body=body, source=source, title=title, description=description
            ),
            encoding="utf-8",
        )
        print(f"wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
