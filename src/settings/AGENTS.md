# Settings & internationalisation — `src/settings/`

Also governs `src/i18n.ts` and `locales/*.json`, which sit outside this directory. The root
`AGENTS.md` carries the rule every feature needs (a new key goes in **all nine** `locales/*.json`,
`en` first, enforced by `__tests__/unit/i18n.test.ts`); this file is the machinery behind it.

## Where i18n is wired up

i18n is initialised once in `src/i18n.ts`, imported by `app/_layout.tsx`. It lives outside `app/`
because every file in there becomes a route. Available languages are listed in
`src/settings/types/Languages.ts`, each with its endonym (`label`) and its `englishName`.

## Language selection at startup

`restoreStoredLanguage()` in `src/i18n.ts` settles the language at startup: the stored choice if there is one, else the device's, else English. Four things about that are load-bearing:

- **An explicit choice outranks the device, permanently.** Someone whose phone is in Portuguese but who picked English meant it, and a stored code is never re-derived on a later launch.
- **Saving hangs off i18next's `languageChanged` event, not off the picker.** Any call site that changes the language is persisted without having to remember to, including ones that do not exist yet. i18next emits that event even when the code is already active, so re-picking the language the device happened to supply still counts as a choice.
- **Nothing derived ever reaches storage.** That is what lets a phone switched to another language still be followed next launch. Since the event cannot tell a choice from a restore, *two* things enforce it: the subscription is made only after the restore, and the restore sets an `applying` flag for the case where a listener is already live. Drop either and a fast refresh — which re-runs the effect — writes the derived code and freezes the app on whatever the device said that day.
- **A stored code is honoured only while that locale still ships.** Dropping a language otherwise strands whoever picked it on a resource bundle that is gone, with no way back but a reinstall. Read failures fall back to English for the same reason: a broken store must not stop the app starting.

Device matching is split in two on purpose. `resolveDeviceLanguage` (`src/settings/types/Languages.ts`) is pure — ordered preferences in, a shipped code or `null` out — and holds all the edge cases: region and script subtags fall back to the base language (`pt-BR` → `pt`, `zh-Hant-TW` → our Simplified `zh`), matching is case-insensitive, and the device's order of preference wins. `getDeviceLocales` (`src/settings/data/DeviceLocale.ts`) is the whole native surface, one `expo-localization` call wrapped so a missing or misbehaving module costs the device default and not the launch.

**That wrapper `require`s expo-localization inside the function instead of importing it at the top, and must keep doing so.** The package reads its native module at *module* scope (`export const getLocales = ExpoLocalization.getLocales`), so a static import throws while the bundle is still evaluating — before any `try`/`catch` in the function can run. On a build without the native module (an older dev client, or Expo Go) that took the whole app down, and it surfaces misleadingly: the visible symptom is `Route "./_layout.tsx" is missing the required default export`, because the layout never finished evaluating, with `Cannot find native module 'ExpoLocalization'` further up the log. `__tests__/unit/DeviceLocaleMissingNativeModule.test.ts` pins this by mocking the package into throwing on require; all three of its cases fail if the import is moved back to the top of the file. **Adding a native module also means rebuilding the dev client** — `npx expo run:android` / `run:ios`, or a new EAS dev build. Metro will happily serve JS that the installed client has no native side for. `__mocks__/expo-localization.ts` stands in for it everywhere, defaulting to a US-English device; call `setDeviceLocales` to test another one.

`app/_layout.tsx` holds the splash screen (`preventAutoHideAsync`, then `hideAsync` once the restore settles) so the English-to-stored-language swap happens behind it. It does **not** gate rendering on the restore: returning `null` until then hides the swap just as well on a device, but static rendering is on for web, and it silently turns every pre-rendered route into an empty shell — the exported `/settings` route drops from 29 KB to 18 KB. The `expo export` bundle job is what catches that.

## The language picker

The picker is `src/settings/components/LanguagePickerBottomSheet.tsx`, opened from a single row in `SettingsScreen`. Every row shows the endonym plus the English name — that gloss is the way back for someone who lands in a script they cannot read — except where the two are the same word. A row of one button per language does **not** scale past about four and was replaced for that reason.

## Untranslated by design

The four West Coast Swing type names (`push`, `pass`, `whip`, `tuck`) are deliberately left in English in every locale — they are the international technical vocabulary of the dance, and the same goes for the `Swing-Out` / `Cross-body` terms inside the template descriptions.
