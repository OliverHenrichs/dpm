# UI primitives — `src/common/ui/`

Screens compose these from `@/src/common/ui` rather than styling `TouchableOpacity` and `Text` by
hand. They carry what every hand-rolled touchable kept forgetting: pressed feedback (Material
ripple on Android, a fade elsewhere), a 44dp touch target, `accessibilityRole` /
`accessibilityState`, and haptics where they belong. Styling rules are in
`src/common/theme/AGENTS.md`.

| Primitive | Use |
|---|---|
| `Button` | `variant`: `primary` (the one main action), `secondary` (neutral outline, Cancel beside a primary), `outline`, `ghost` (quiet text action), `danger` (confirms a destructive step, with a haptic), `dangerOutline` (leads to one), `media` (over video or the camera); `size` `sm`/`md`; optional `icon`, `loading`. A footer pair is `secondary` + `primary`, each `flex: 1`, Cancel on the left. |
| `IconButton` | An icon with a **required** `accessibilityLabel`. The glyph keeps its size; `hitSlop` grows the target to 44dp, so dense headers keep their layout. |
| `Chip` | A selectable pill (filters, types, levels, one-of-several). Selection shows by colour _and_ a check; pressing gives a selection haptic. `swatch` adds a colour dot, `badge` a small uppercase tag (a modifier's position), `onRemove` + `removeLabel` a remove button inside the chip. |
| `Card` | A surface; with `onPress` the whole card is one button. |
| `ListRow` | Every row of a list, sheet, menu or drawer: `icon` or `leading`, `title` with `meta` and `subtitle`, separately pressable `trailing` controls. `selection="single"` is a radio (a language, the active list, a sort field), `"multiple"` a checkbox (lists to export); omitted, a button whose `selected` highlights the current entry (the drawer). `expanded` shows a chevron and announces the state. `variant="card"` for rows on the page, `plain` inside sheets. |
| `SegmentedControl` | Two to four exclusive options in one track, with optional counts. `kind="tabs"` switches the view below (Patterns / Modifiers); `kind="choice"` sets a value, announced as radios (import's Skip / Replace). |
| `AppText` | `variant` is a text style, `color` a colour role. |
| `Tappable` | The same press behaviour around content that is not text or an icon (the header's logo, a video thumbnail). `accessibilityLabel` required. Reach for the others first. |
| `Icon` | The one icon set; see the theme file. |

- `Button` and `Chip` default their `accessibilityLabel` to their visible text, which is what tests
  find them by.
- `style` on a primitive is for layout (flex, margins); the look comes from its props.
- Haptics go through `haptics.ts`: selection changes and destructive confirmations only, never
  every tap. Never make a haptic the only feedback; many phones have them off.
- A list's actions are never behind a long press alone: `PatternListSelector` shows a "more"
  button on each card, and the long press is a shortcut to the same sheet.

## Deliberately not primitives

- Rows that expand into details holding a native video player (`PatternListItem`,
  `ModifierListItem`) keep a plain `View` as the container and use `ListRow` only for the header;
  a pressable wrapper would swallow the player's touches (`src/common/AGENTS.md`, "Dismissal
  touches").
- The scrims that dismiss `BottomSheet` and `PatternDetailsModal` (siblings behind their cards).
- The video editor's tap-to-mark overlay, a canvas rather than a control.
- The type row's colour dot and swatches in `PatternListTemplateModal`: they show data colours and
  their tests pin the row's structure. They are labelled and announce their state.

## The design gallery

`DesignGallery.tsx`, route `/gallery`, linked from Settings in development builds only (release
builds redirect it home). It shows every token and primitive in the active theme and style with a
switch at the top: the fast loop for design work. Its strings are deliberately untranslated.
