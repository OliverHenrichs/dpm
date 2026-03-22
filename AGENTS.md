# AGENTS.md — DancePatternMapper

Expo/React Native (TypeScript) app for mapping partner-dance prerequisite graphs.

## Architecture overview

```
app/index.tsx          ← single Expo Router entry point
  ThemeProvider        ← global light/dark theme
    DrawerNavigator    ← 4 routes: PatternLists | Patterns | PatternGraph | Settings
      ActivePatternListProvider  ← global state: active list + its patterns
```

All screens share state through `ActivePatternListContext` (`src/pattern/components/context/ActivePatternListContext.tsx`). Every screen reads `activeList` and `patterns` from `useActivePatternList()` — never loads storage directly.

## Core data model

| Type | Id type | Key detail |
|---|---|---|
| `IPatternList` | `string` (UUID) | Owns its own `PatternType[]` — types are **per-list**, not global |
| `PatternType` | `string` (UUID) | `slug` = display name; `color` = hex; referenced from patterns via `typeId` |
| `IPattern` | `number` (integer) | `prerequisites: number[]` drives both graph views; `typeId` is a UUID string |

Key files: `src/pattern/types/IPatternList.ts`, `src/pattern/types/PatternType.ts`, `src/pattern/types/PatternLevel.ts`.

## Persistence (AsyncStorage)

Storage keys in `src/pattern/data/PatternListStorage.ts`:
- `@patternLists` — serialised `IPatternList[]` (no patterns)
- `@patterns_{listId}` — serialised `IPattern[]` for a given list
- `@activeListId` — UUID of the currently active list

Patterns and lists are stored under **separate keys**. Always use the helpers in `PatternListStorage.ts` — never call `AsyncStorage` directly from UI code.

## Theming

Every component that needs colours does:
```tsx
const { colorScheme } = useThemeContext();       // "light" | "dark"
const palette = getPalette(colorScheme);          // → LightPalette or DarkPalette
// then: palette[PaletteColor.Background], etc.
```
Styles are created inline per-render (no shared static stylesheets). `PaletteColor` enum and both palettes live in `src/common/utils/ColorPalette.ts`.

## Internationalisation

All user-facing strings use `const { t } = useTranslation()`. Translation keys must be added to **both** `locales/en.json` and `locales/de.json`. i18n is initialised once in `app/i18n.ts` (imported at entry point).

## Graph views

`src/pattern/graph/` contains two switchable views driven by `IPattern.prerequisites[]`:
- **Timeline** — swimlane by `PatternType`, left-to-right by depth (`TimelineGraphUtils.ts`)
- **Network** — force-free hierarchical layout (`NetworkGraphUtils.ts`)

Shared graph utilities: `GenericGraphUtils.ts` (depth map, circular-dependency detection), `GraphUtils.ts` (edge generation, SVG path helpers).

## Default list templates

`src/pattern/data/DefaultPatternLists.ts` exposes factory functions (`createWestCoastSwingList`, `createSalsaList`, …). Each returns a fresh `IPatternList` with UUID-stamped `PatternType`s. The companion `TemplatePattern` type uses `typeSlug` (not `typeId`) so templates stay stable across renames.

## Export / Import format

Version `"2.0.0"` JSON (`IPatternListExportData` in `src/pattern/data/types/IExportData.ts`). Local videos are base64-embedded under the `videos` map keyed by original path. Import decodes them back to the local filesystem via `expo-file-system`.

## Path alias

`@/` resolves to the **project root** (not `src/`). Use `@/src/...` for source imports and `@/utils/...` for test utilities.

## Developer workflows

```bash
npm install              # install deps
npx expo start           # dev server (LAN)
npm test                 # Jest (node env, no device needed)
npm run test:watch       # watch mode
npm run test:coverage    # coverage for src/pattern/data/** + src/pattern/graph/utils/**
npm run lint             # ESLint via expo lint
```

## Testing conventions

- All tests live in `__tests__/` (not co-located). Test environment is `node`.
- Coverage is scoped to `src/pattern/data/**` and `src/pattern/graph/utils/**`.
- Use factory helpers from `utils/testFactories.ts` (`createTestPattern`, `createTestPatternList`, `createTestPatternType`) — do not inline raw object literals in tests.
- `IPattern.id` in tests should be a plain integer; `PatternType.id` / `IPatternList.id` should use `generateUUID()`.

