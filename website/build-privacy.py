#!/usr/bin/env python3
"""Render PRIVACY_POLICY.md (the single source) into website/privacy.html.

Run after editing the policy:  python3 website/build-privacy.py
Needs the `markdown` package (pip install markdown). The Pages workflow runs this before
deploying, so the published page cannot drift from the Markdown.
"""

from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "PRIVACY_POLICY.md"
TARGET = ROOT / "website" / "privacy.html"

TEMPLATE = """<!doctype html>
<!-- Generated from PRIVACY_POLICY.md by website/build-privacy.py. Do not edit by hand. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Privacy policy · DPM</title>
    <meta name="description" content="Privacy policy for DPM (Dance Pattern Mapper)." />
    <link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png" />
    <link rel="apple-touch-icon" href="img/apple-touch-icon.png" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="./">
          <img src="img/logo.png" alt="" width="36" height="36" />
          DPM
        </a>
        <nav class="site-nav" aria-label="Main">
          <a href="./">Home</a>
          <a href="https://github.com/OliverHenrichs/dance-pattern-mapper">GitHub</a>
        </nav>
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
          <a href="mailto:dance-pattern-mapper@pm.me">Contact</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
"""


def main() -> None:
    body = markdown.markdown(
        SOURCE.read_text(encoding="utf-8"),
        extensions=["tables", "sane_lists"],
        output_format="html",
    )
    TARGET.write_text(TEMPLATE.format(body=body), encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
