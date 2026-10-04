# Name and description suggestions — `src/suggest/`

A suggested pattern name and description, drafted on the phone by a small language model
(`llama.rn`) from a video's transcript and the list's vocabulary. Offered in the transcript sheet
(`components/SuggestionPanel.tsx`). Design history, the model comparison and the prompt's evolution:
`AGENT_TASKS.md` L4, "Suggestions". Unqualified paths are relative to `src/suggest/`.

## Rules

- **The user decides.** Nothing is filled in until *Use suggestion*; even then the name is set only
  when it is empty, and the description gets a paragraph of its own after what is there.
- **Gate on `canSuggest()`** (`suggestPattern.ts`): Android, the native hash check
  (`isAudioExtractAvailable`), and at least `MIN_DEVICE_MEMORY_BYTES` (6 GB). The app peaks around
  3.4 GB with the model loaded; on a 4 GB phone Android would kill it.
- **Never beside another model.** Callers use `suggestPattern`, which waits its turn through
  `jobStore.runExclusive` and reports `"waiting"` meanwhile. Only a transcription job asked to go on
  and suggest calls `runSuggestion` directly, inside its own turn.
- **Loaded per answer, released after**: holding ~3.4 GB between rare uses is not worth the few
  seconds a load takes.
- `llama.ts` is the one importer of `llama.rn`; `llama.web.ts` stubs it for web.

## The model and the prompt

- `models.ts`: Qwen3.5 2B instruct, Q4_K_M (~1.3 GB, Apache-2.0), pinned to one Hugging Face
  commit and SHA-256 checked, downloaded through `src/transcribe/modelStore.ts` with its size shown
  first.
- `suggestPrompt.ts` is pure: the system prompt, a JSON schema, and tolerant parsing. **`teaches`
  comes first**, so the model commits to whether anything is taught before naming it; `teaches:
  false` empties the answer ("nothing to suggest"). The vocabulary is for spelling only, and the
  description must be in the model's own words. An earlier prompt without `teaches` invented a
  pattern for a water break. **The prompt mattered more than the model size**; change it with the
  tests in `__tests__/unit/suggestPrompt.test.ts` and re-check on a device.
- `SuggestionUnreadableError` (retry offered) and `SuggestionModelMissingError` are distinct.

## Testing

`llama.rn` is mocked globally: `setLlamaAnswer` sets what the model says (an `Error` rejects),
`llamaCalls` records inits, completions and releases. Answer quality, speed and memory are device
checks, on real teacher footage in more than one language.
