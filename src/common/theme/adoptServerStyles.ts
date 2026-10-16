/**
 * Web's static render puts the Unistyles CSS in a `<style id="unistyles-web">`
 * inside `#root`, and Unistyles adopts that tag as the one it writes to. But
 * React replaces `#root`'s children whenever it renders the root from scratch:
 * always in development, which never hydrates, and in production after a
 * hydration mismatch. The tag goes with them, Unistyles keeps writing into the
 * detached copy, and the page loses every style. Moving it into `<head>` first
 * keeps it out of React's reach. This must run before `react-native-unistyles`
 * is imported, which is when Unistyles looks the tag up.
 */
if (typeof document !== "undefined") {
  const tag = document.getElementById("unistyles-web");
  if (tag && tag.parentElement !== document.head)
    document.head.appendChild(tag);
}
