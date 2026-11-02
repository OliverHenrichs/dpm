import { findIneligiblePrerequisiteIds } from "@/src/pattern/graph/utils/GenericGraphUtils";
import {
  normalizeRhythm,
  rhythmMatchesCounts,
  Timing,
} from "@/src/pattern/rhythm/rhythm";
import {
  IPattern,
  IPatternList,
  IPatternModifierRef,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import { resolveLevelIds } from "@/src/pattern/types/PatternLevel";
import {
  asVariantTiming,
  asVideoRefs,
  isObject,
} from "@/src/pattern/suggestions/suggestions";

/**
 * A suggested change to an existing figure, as the list owner reviews it.
 *
 * The suggestion carries two snapshots of the figure: `base`, as the subscriber's copy had it,
 * and `pattern`, as they suggest it. Their difference is what was suggested; comparing each
 * difference with the figure as it is now tells a change that still applies from one the list
 * owner has made already, or overtaken with a change of their own. Both snapshots come from
 * another phone, so they are read as untrusted input, like `patternFromSuggestion`.
 */
export type FigureChange =
  | { kind: "name"; from: string; to: string; now?: string }
  | { kind: "type"; from: string; to: string; now?: string }
  | { kind: "level"; from?: string; to?: string; now?: string | null }
  | {
      kind: "counts";
      from: CountsAndRhythm;
      to: CountsAndRhythm;
      now?: CountsAndRhythm;
    }
  | { kind: "description"; from: string; to: string; now?: string }
  | { kind: "tag"; op: Op; tag: string }
  | { kind: "prerequisite"; op: Op; patternId: number }
  | {
      kind: "modifier";
      op: Op;
      modifierId: string;
      videos: IVideoReference[];
      /** An added variant's own counts and rhythm, when it has them. */
      timing?: Timing;
    }
  /** A variant's own counts and rhythm (#134); empty means it follows the figure. */
  | {
      kind: "variantCounts";
      modifierId: string;
      from: Timing;
      to: Timing;
      now?: Timing;
    }
  | { kind: "video"; op: Op; modifierId?: string; video: IVideoReference }
  | {
      kind: "videoStart";
      modifierId?: string;
      url: string;
      from?: number;
      to?: number;
      now?: number | null;
    };

export type Op = "add" | "remove";

/** Counts and rhythm change together: a rhythm always matches its counts. */
export interface CountsAndRhythm {
  counts: number;
  rhythm?: string;
}

/**
 * One line of the review. `changedSince`: the list owner has changed the same thing to
 * something else since the subscriber saw it; `now` on the change says to what. Such a line is
 * offered unticked.
 */
export type ChangeLine = FigureChange & { id: string; changedSince?: boolean };

/** The fields of a figure snapshot, read leniently; references are checked against the list later. */
interface Snapshot {
  name: string;
  typeId: string;
  counts: number;
  level?: string;
  rhythm?: string;
  description: string;
  tags: string[];
  prerequisites: number[];
  videoRefs: IVideoReference[];
  modifierRefs: IPatternModifierRef[];
}

function snapshot(raw: unknown): Snapshot | null {
  if (!isObject(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const counts =
    typeof raw.counts === "number" &&
    Number.isInteger(raw.counts) &&
    raw.counts >= 0
      ? raw.counts
      : 0;
  const strings = (v: unknown) =>
    Array.isArray(v)
      ? [
          ...new Set(
            v
              .filter((s): s is string => typeof s === "string")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ]
      : [];
  const seen = new Set<string>();
  return {
    name,
    typeId: typeof raw.typeId === "string" ? raw.typeId : "",
    counts,
    // Checked against the list's levels in `figureChanges`, as the type is.
    ...(typeof raw.level === "string" &&
      raw.level !== "" && { level: raw.level }),
    ...(typeof raw.rhythm === "string" &&
      rhythmMatchesCounts(raw.rhythm, counts) && {
        rhythm: normalizeRhythm(raw.rhythm),
      }),
    description: typeof raw.description === "string" ? raw.description : "",
    tags: strings(raw.tags),
    prerequisites: Array.isArray(raw.prerequisites)
      ? [
          ...new Set(
            raw.prerequisites.filter(
              (id): id is number => typeof id === "number",
            ),
          ),
        ]
      : [],
    videoRefs: uniqueByLink(asVideoRefs(raw.videoRefs)),
    modifierRefs: Array.isArray(raw.modifierRefs)
      ? raw.modifierRefs
          .filter(
            (m): m is Record<string, unknown> =>
              isObject(m) &&
              typeof m.modifierId === "string" &&
              !seen.has(m.modifierId) &&
              !!seen.add(m.modifierId),
          )
          .map((m) => ({
            modifierId: m.modifierId as string,
            videoRefs: uniqueByLink(asVideoRefs(m.videoRefs)),
            ...asVariantTiming(m),
          }))
      : [],
  };
}

function uniqueByLink(refs: IVideoReference[]): IVideoReference[] {
  const seen = new Set<string>();
  return refs.filter((r) => !seen.has(r.value) && !!seen.add(r.value));
}

/** The figure's online videos by link; local files are the list owner's own and never compared. */
function byLink(refs: IVideoReference[] | undefined) {
  return new Map(
    (refs ?? []).filter((r) => r.type === "url").map((r) => [r.value, r]),
  );
}

const sameCounts = (a: Timing, b: Timing) =>
  a.counts === b.counts && (a.rhythm ?? "") === (b.rhythm ?? "");

/** A variant's own counts and rhythm, without its other fields. */
const timingOf = (ref: Timing | undefined): Timing => ({
  ...(ref?.counts !== undefined && { counts: ref.counts }),
  ...(ref?.rhythm && { rhythm: ref.rhythm }),
});

/**
 * The lines of a suggested change to `current`, in the order the review shows them. A change
 * the figure already has is left out, and so is one that refers to something the list does not
 * have (any more): a type, a prerequisite, a variation. Empty when nothing is left to apply.
 */
export function figureChanges(
  rawBase: unknown,
  rawSuggested: unknown,
  current: IPattern,
  list: IPatternList,
  patterns: IPattern[],
): ChangeLine[] {
  const base = snapshot(rawBase);
  const next = snapshot(rawSuggested);
  if (!base || !next) return [];
  const lines: ChangeLine[] = [];

  // A scalar: unchanged since → a plain change; already as suggested → nothing; else a clash.
  const scalar = <T>(
    from: T,
    to: T,
    now: T,
    same: (a: T, b: T) => boolean,
    make: (changedSince: boolean) => ChangeLine,
  ) => {
    if (same(from, to) || same(now, to)) return;
    lines.push(make(!same(now, from)));
  };
  const eq = <T>(a: T, b: T) => a === b;

  if (next.name) {
    scalar(base.name, next.name, current.name, eq, (changedSince) => ({
      id: "name",
      kind: "name",
      from: base.name,
      to: next.name,
      ...(changedSince && { changedSince, now: current.name }),
    }));
  }
  if (list.patternTypes.some((t) => t.id === next.typeId)) {
    scalar(base.typeId, next.typeId, current.typeId, eq, (changedSince) => ({
      id: "type",
      kind: "type",
      from: base.typeId,
      to: next.typeId,
      ...(changedSince && { changedSince, now: current.typeId }),
    }));
  }
  // A level the list does not have (any more) is left out, as a type is; clearing it is not.
  const levelIds = resolveLevelIds(list.levels);
  if (!next.level || levelIds.includes(next.level)) {
    scalar(
      base.level ?? "",
      next.level ?? "",
      current.level ?? "",
      eq,
      (changedSince) => ({
        id: "level",
        kind: "level",
        ...(base.level && { from: base.level }),
        ...(next.level && { to: next.level }),
        ...(changedSince && { changedSince, now: current.level ?? null }),
      }),
    );
  }
  const countsOf = (s: { counts: number; rhythm?: string }) => ({
    counts: s.counts,
    ...(s.rhythm && { rhythm: s.rhythm }),
  });
  scalar(
    countsOf(base),
    countsOf(next),
    countsOf(current),
    sameCounts,
    (changedSince) => ({
      id: "counts",
      kind: "counts",
      from: countsOf(base),
      to: countsOf(next),
      ...(changedSince && { changedSince, now: countsOf(current) }),
    }),
  );
  scalar(
    base.description,
    next.description,
    current.description,
    eq,
    (changedSince) => ({
      id: "description",
      kind: "description",
      from: base.description,
      to: next.description,
      ...(changedSince && { changedSince, now: current.description }),
    }),
  );

  // Items: an addition the figure has already, or a removal it no longer needs, is left out.
  const items = <T>(
    before: T[],
    after: T[],
    have: T[],
    line: (op: Op, item: T) => ChangeLine | null,
  ) => {
    const b = new Set(before);
    const a = new Set(after);
    const h = new Set(have);
    for (const item of after) {
      if (!b.has(item) && !h.has(item)) push(line("add", item));
    }
    for (const item of before) {
      if (!a.has(item) && h.has(item)) push(line("remove", item));
    }
  };
  const push = (line: ChangeLine | null) => {
    if (line) lines.push(line);
  };

  items(base.tags, next.tags, current.tags, (op, tag) => ({
    id: `tag:${op}:${tag}`,
    kind: "tag",
    op,
    tag,
  }));
  const ids = new Set(patterns.map((p) => p.id));
  // A prerequisite that depends on this figure would close a loop, which has no learning order.
  const wouldLoop = findIneligiblePrerequisiteIds(patterns, current.id);
  items(
    base.prerequisites,
    next.prerequisites,
    current.prerequisites,
    (op, patternId) =>
      op === "add" && (!ids.has(patternId) || wouldLoop.has(patternId))
        ? null
        : {
            id: `prerequisite:${op}:${patternId}`,
            kind: "prerequisite",
            op,
            patternId,
          },
  );

  videoLines(base.videoRefs, next.videoRefs, current.videoRefs, undefined);

  const attachable = new Set(
    (list.modifiers ?? []).filter((m) => !m.universal).map((m) => m.id),
  );
  const refsOf = (refs: IPatternModifierRef[]) =>
    new Map(refs.map((m) => [m.modifierId, m]));
  const baseMods = refsOf(base.modifierRefs);
  const nextMods = refsOf(next.modifierRefs);
  const currentMods = refsOf(current.modifierRefs ?? []);
  for (const [modifierId, ref] of nextMods) {
    if (!attachable.has(modifierId)) continue;
    const had = baseMods.get(modifierId);
    const has = currentMods.get(modifierId);
    if (!had && !has) {
      const timing = timingOf(ref);
      lines.push({
        id: `modifier:add:${modifierId}`,
        kind: "modifier",
        op: "add",
        modifierId,
        videos: ref.videoRefs,
        ...(timing.counts !== undefined && { timing }),
      });
    } else if (has) {
      const from = timingOf(had);
      const to = timingOf(ref);
      const now = timingOf(has);
      scalar(from, to, now, sameCounts, (changedSince) => ({
        id: `variantCounts:${modifierId}`,
        kind: "variantCounts",
        modifierId,
        from,
        to,
        ...(changedSince && { changedSince, now }),
      }));
      videoLines(
        had?.videoRefs ?? [],
        ref.videoRefs,
        has.videoRefs,
        modifierId,
      );
    }
  }
  for (const [modifierId, ref] of baseMods) {
    if (!nextMods.has(modifierId) && currentMods.has(modifierId)) {
      lines.push({
        id: `modifier:remove:${modifierId}`,
        kind: "modifier",
        op: "remove",
        modifierId,
        videos: ref.videoRefs,
      });
    }
  }
  return lines;

  function videoLines(
    before: IVideoReference[],
    after: IVideoReference[],
    have: IVideoReference[],
    modifierId: string | undefined,
  ) {
    const b = byLink(before);
    const a = byLink(after);
    const h = byLink(have);
    const at = modifierId ? `${modifierId}:` : "";
    for (const [url, video] of a) {
      const was = b.get(url);
      const is = h.get(url);
      if (!was) {
        if (!is) {
          lines.push({
            id: `video:add:${at}${url}`,
            kind: "video",
            op: "add",
            ...(modifierId && { modifierId }),
            video,
          });
        }
      } else if (is && was.startTime !== video.startTime) {
        if (is.startTime === video.startTime) continue;
        const changedSince = is.startTime !== was.startTime;
        lines.push({
          id: `videoStart:${at}${url}`,
          kind: "videoStart",
          ...(modifierId && { modifierId }),
          url,
          ...(was.startTime !== undefined && { from: was.startTime }),
          ...(video.startTime !== undefined && { to: video.startTime }),
          ...(changedSince && { changedSince, now: is.startTime ?? null }),
        });
      }
    }
    for (const [url, video] of b) {
      if (!a.has(url) && h.has(url)) {
        lines.push({
          id: `video:remove:${at}${url}`,
          kind: "video",
          op: "remove",
          ...(modifierId && { modifierId }),
          video,
        });
      }
    }
  }
}

/**
 * `current` with the chosen lines applied. Each line is applied to the figure as it is now, so
 * a change the list owner did not pick leaves their own value standing.
 */
export function applyFigureChanges(
  current: IPattern,
  lines: ChangeLine[],
): IPattern {
  let figure: IPattern = {
    ...current,
    tags: [...current.tags],
    prerequisites: [...current.prerequisites],
    videoRefs: [...current.videoRefs],
    modifierRefs: (current.modifierRefs ?? []).map((m) => ({
      ...m,
      videoRefs: [...m.videoRefs],
    })),
  };
  const withVideos = (
    modifierId: string | undefined,
    edit: (refs: IVideoReference[]) => IVideoReference[],
  ) => {
    if (!modifierId) {
      figure.videoRefs = edit(figure.videoRefs);
    } else {
      figure.modifierRefs = figure.modifierRefs.map((m) =>
        m.modifierId === modifierId
          ? { ...m, videoRefs: edit(m.videoRefs) }
          : m,
      );
    }
  };

  for (const line of lines) {
    switch (line.kind) {
      case "name":
        figure.name = line.to;
        break;
      case "type":
        figure.typeId = line.to;
        break;
      case "level": {
        const { level: _level, ...rest } = figure;
        figure = line.to ? { ...rest, level: line.to } : rest;
        break;
      }
      case "counts": {
        const { rhythm: _rhythm, ...rest } = figure;
        figure = {
          ...rest,
          counts: line.to.counts,
          ...(line.to.rhythm && { rhythm: line.to.rhythm }),
        };
        break;
      }
      case "description":
        figure.description = line.to;
        break;
      case "tag":
        figure.tags =
          line.op === "add"
            ? [...new Set([...figure.tags, line.tag])]
            : figure.tags.filter((t) => t !== line.tag);
        break;
      case "prerequisite":
        figure.prerequisites =
          line.op === "add"
            ? [...new Set([...figure.prerequisites, line.patternId])]
            : figure.prerequisites.filter((id) => id !== line.patternId);
        break;
      case "modifier":
        if (line.op === "remove") {
          figure.modifierRefs = figure.modifierRefs.filter(
            (m) => m.modifierId !== line.modifierId,
          );
        } else if (
          !figure.modifierRefs.some((m) => m.modifierId === line.modifierId)
        ) {
          figure.modifierRefs = [
            ...figure.modifierRefs,
            {
              modifierId: line.modifierId,
              videoRefs: line.videos,
              ...line.timing,
            },
          ];
        }
        break;
      case "variantCounts":
        figure.modifierRefs = figure.modifierRefs.map((m) => {
          if (m.modifierId !== line.modifierId) return m;
          const { counts: _counts, rhythm: _rhythm, ...rest } = m;
          return { ...rest, ...line.to };
        });
        break;
      case "video":
        withVideos(line.modifierId, (refs) =>
          line.op === "add"
            ? refs.some((r) => r.value === line.video.value)
              ? refs
              : [...refs, line.video]
            : refs.filter(
                (r) => !(r.type === "url" && r.value === line.video.value),
              ),
        );
        break;
      case "videoStart":
        withVideos(line.modifierId, (refs) =>
          refs.map((r) => {
            if (r.type !== "url" || r.value !== line.url) return r;
            const { startTime: _start, ...rest } = r;
            return line.to !== undefined
              ? { ...rest, startTime: line.to }
              : rest;
          }),
        );
        break;
    }
  }
  return figure;
}
