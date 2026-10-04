/**
 * What the importer has to say, as data rather than English.
 *
 * `validateExportData` and `importPatternLists` are plain functions with no
 * access to the active language, so they report each problem as an i18n key
 * plus its parameters, and the screen that shows them translates with
 * `formatImportMessages`. The same split as `jobStore`'s `errorKey`.
 *
 * Every key the importer can produce is listed here, so a test can check each
 * one against every locale: the keys are picked at runtime, which the static
 * scan in `__tests__/unit/i18n.test.ts` cannot see.
 */
export const IMPORT_MESSAGE_KEYS = [
  // Fatal: the whole file is refused.
  "importErrorNotAnExport",
  "importErrorTooNew",
  "importErrorTooOld",
  "importErrorNoLists",
  "importErrorListNotObject",
  "importErrorListNoId",
  "importErrorDuplicateListId",
  "importErrorPatternsNotList",
  "importErrorPatternNoId",
  "importErrorDuplicatePatternId",
  "importFailed",
  // Repaired: the import goes ahead.
  "importWarnVideosNotList",
  "importWarnMalformedVideo",
  "importWarnMalformedProvenance",
  "importWarnMalformedTranscript",
  "importWarnMalformedTranscriptLines",
  "importWarnTypesMissing",
  "importWarnTypeNoId",
  "importWarnDuplicateType",
  "importWarnModifiersNotList",
  "importWarnModifierNoId",
  "importWarnDuplicateModifier",
  "importWarnModifierRefsNotList",
  "importWarnModifierRefNoId",
  "importWarnModifierRefUnknown",
  "importWarnDuplicateModifierRef",
  "importWarnUnknownType",
  "importWarnPrerequisiteNotNumber",
  "importWarnPrerequisitesMissing",
  "importWarnPrerequisiteNotInFile",
  "importWarnVideoDataUnreadable",
  "importWarnVideoEntryUnreadable",
  "importWarnVideoRestoreFailed",
  "importWarnVideoDataMissing",
] as const;

export type ImportMessageKey = (typeof IMPORT_MESSAGE_KEYS)[number];

/** Where in the file a problem is: always a list, sometimes a pattern or modifier in it. */
export interface ImportMessageContext {
  list: string;
  pattern?: string;
  modifier?: string;
}

export interface ImportMessage {
  key: ImportMessageKey;
  params?: Record<string, string | number>;
  context?: ImportMessageContext;
}

/** The slice of i18next's `t` this needs, so pure code and tests can pass any. */
export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Shorthand for building a message at the call site. */
export const importMessage = (
  key: ImportMessageKey,
  params?: Record<string, string | number>,
  context?: ImportMessageContext,
): ImportMessage => ({
  key,
  ...(params && { params }),
  ...(context && { context }),
});

function formatContext(t: Translate, context: ImportMessageContext): string {
  if (context.pattern !== undefined) {
    return t("importContextPattern", {
      list: context.list,
      pattern: context.pattern,
    });
  }
  if (context.modifier !== undefined) {
    return t("importContextModifier", {
      list: context.list,
      modifier: context.modifier,
    });
  }
  return t("importContextList", { list: context.list });
}

export function formatImportMessage(t: Translate, message: ImportMessage) {
  const text = t(message.key, message.params);
  if (!message.context) return text;
  return t("importMessageInContext", {
    context: formatContext(t, message.context),
    message: text,
  });
}

/** One line per message, the way the error dialog shows them. */
export const formatImportMessages = (t: Translate, messages: ImportMessage[]) =>
  messages.map((message) => formatImportMessage(t, message)).join("\n");
