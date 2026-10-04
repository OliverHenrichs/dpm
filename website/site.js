// The style switcher. The site comes in the app's two styles, After Hours (the default) and
// Clipboard; this script applies the visitor's choice and remembers it in this browser's
// localStorage, which never leaves the browser. Loaded in <head> without defer, so a returning
// visitor's style is set before the first paint. Without it the page is simply After Hours.
(function () {
  const KEY = "dpm-style";
  const STYLES = ["after-hours", "clipboard"];
  const THEME_COLORS = {
    "after-hours": { light: "#f6f2f7", dark: "#15121d" },
    clipboard: { light: "#eef1ee", dark: "#111513" },
  };
  const root = document.documentElement;

  function stored() {
    try {
      const value = localStorage.getItem(KEY);
      return STYLES.indexOf(value) >= 0 ? value : null;
    } catch {
      return null;
    }
  }

  function apply(style) {
    if (style === "clipboard") root.setAttribute("data-style", "clipboard");
    else root.removeAttribute("data-style");
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    for (let i = 0; i < metas.length; i++) {
      const dark = (metas[i].getAttribute("media") || "").indexOf("dark") >= 0;
      metas[i].setAttribute(
        "content",
        THEME_COLORS[style][dark ? "dark" : "light"],
      );
    }
    const buttons = document.querySelectorAll("[data-style-choice]");
    for (let j = 0; j < buttons.length; j++) {
      const on = buttons[j].getAttribute("data-style-choice") === style;
      buttons[j].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  let current = stored() || "after-hours";
  apply(current);

  document.addEventListener("DOMContentLoaded", function () {
    apply(current);
    const switches = document.querySelectorAll(".style-switch");
    for (let i = 0; i < switches.length; i++) switches[i].hidden = false;
    document.addEventListener("click", function (event) {
      const button =
        event.target.closest && event.target.closest("[data-style-choice]");
      if (!button) return;
      current = button.getAttribute("data-style-choice");
      apply(current);
      try {
        localStorage.setItem(KEY, current);
      } catch {
        // Private mode or storage blocked: the choice holds for this page only.
      }
    });
  });
})();
