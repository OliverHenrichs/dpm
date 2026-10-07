# Dance glossaries

Standard terms of each dance, one file per dance (`wcs`, `lindy`, `salsa`, `bachata`, `tango`).
Transcription puts them into Whisper's prompt so it spells "anchor step" and "dile que no"
correctly, after the video's own pattern and the list's names. Only as many as fit go in
(`MAX_PROMPT_CHARS` in `../vocabulary.ts`), so **order matters: most commonly said first**.

```json
{
  "terms": [
    "anchor step",
    { "term": "underarm turn", "es": "<how Spanish-speaking teachers say it>" }
  ]
}
```

- A plain string is said the same in every language: most dance terms travel as loanwords.
- An object gives the default spelling (`term`) and, keyed by ISO 639-1 code (`de`, `es`, `fr`,
  …), the spelling teachers use in that language. Transcription picks the language the user
  chose, else the one most of the list's transcripts are in.
- Add only established terms, spelt as teachers and festivals spell them. A wrong word in the
  prompt is a word Whisper leans toward.

`__tests__/unit/glossary.test.ts` checks every file: non-empty terms, valid language codes, no
term twice.
