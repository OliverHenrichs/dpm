import React from "react";
import { View } from "react-native";

/**
 * A minimal Reanimated, for mounting components that animate.
 *
 * Reanimated's real entry point initialises the worklets runtime on import,
 * which under jest reaches a native module that does not exist ("Cannot read
 * properties of undefined (reading 'loadUnpackers')") and fails the suite
 * before a test runs. Its own shipped mock re-imports that entry point, so it
 * does not help.
 *
 * This is deliberately behavioural rather than inert: shared values really
 * hold and update, so a component's worklets run and are measurable. What it
 * does *not* do is animate — `withTiming` and friends resolve to their target
 * immediately. Motion is judged on a device, never here.
 */

export interface SharedValue<T> {
  value: T;
  get(): T;
  set(next: T | ((current: T) => T)): void;
  addListener(): void;
  removeListener(): void;
  modify(): void;
}

export function makeMutable<T>(initial: T): SharedValue<T> {
  let current = initial;
  return {
    get value() {
      return current;
    },
    set value(next: T) {
      current = next;
    },
    get: () => current,
    set: (next) => {
      current =
        typeof next === "function"
          ? (next as (value: T) => T)(current)
          : (next as T);
    },
    addListener: () => {},
    removeListener: () => {},
    modify: () => {},
  };
}

export function useSharedValue<T>(initial: T): SharedValue<T> {
  // Lazy `useState` rather than a ref: the same "created once, never
  // re-created" behaviour, without reading a ref during render — which the
  // React Compiler rules reject, and this project has the compiler on.
  const [value] = React.useState(() => makeMutable(initial));
  return value;
}

export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

export function useAnimatedProps<T>(factory: () => T): T {
  return factory();
}

export function useDerivedValue<T>(factory: () => T): SharedValue<T> {
  return makeMutable(factory());
}

export function useAnimatedReaction() {}

/**
 * Knobs a test can turn, reset before every test by `resetReanimatedMock`
 * (called from jest.setup.components.ts).
 */
const knobs = { reducedMotion: false, timingFinishes: true };

/** The system's "reduce motion" setting, as `useReducedMotion` reports it. */
export function setReducedMotion(reduced: boolean): void {
  knobs.reducedMotion = reduced;
}

/** Whether `withTiming` reports its animation as finished — false models an interruption. */
export function setTimingFinishes(finishes: boolean): void {
  knobs.timingFinishes = finishes;
}

export function resetReanimatedMock(): void {
  knobs.reducedMotion = false;
  knobs.timingFinishes = true;
}

/** No animation: land on the target, and run the callback as if complete. */
export function withTiming<T>(
  target: T,
  _config?: unknown,
  callback?: (finished: boolean) => void,
): T {
  callback?.(knobs.timingFinishes);
  return target;
}

export function withSpring<T>(
  target: T,
  _config?: unknown,
  callback?: (finished: boolean) => void,
): T {
  callback?.(true);
  return target;
}

export function withDelay<T>(_delay: number, animation: T): T {
  return animation;
}

export function runOnJS<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export function runOnUI<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}

export function cancelAnimation() {}

export function useReducedMotion(): boolean {
  return knobs.reducedMotion;
}

export const ReduceMotion = {
  System: "system",
  Always: "always",
  Never: "never",
} as const;

const bezier = () => ({ factory: () => (t: number) => t });

export const Easing = {
  bezier,
  linear: (t: number) => t,
  ease: (t: number) => t,
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => fn,
  inOut: (fn: (t: number) => number) => fn,
};

export function createAnimatedComponent<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  return Component;
}

/**
 * Layout animations (`entering`, `exiting`) do nothing under jest; the
 * builders only need to chain, as `FadeIn.duration(200).delay(50)` does.
 */
function layoutAnimation(): Record<string, unknown> {
  const builder: Record<string, unknown> = new Proxy(
    {},
    { get: () => () => builder },
  );
  return builder;
}
export const FadeIn = layoutAnimation();
export const FadeOut = layoutAnimation();
export const FadeInDown = layoutAnimation();
export const FadeOutUp = layoutAnimation();
export const LinearTransition = layoutAnimation();

const Animated = {
  View,
  Text: View,
  ScrollView: View,
  Image: View,
  createAnimatedComponent,
};

export default Animated;
