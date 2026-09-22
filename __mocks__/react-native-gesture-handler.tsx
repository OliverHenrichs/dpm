import React from "react";
import { View, ViewProps } from "react-native";

/**
 * A minimal Gesture Handler, for mounting components that use gestures.
 *
 * The real module installs bindings into the worklets UI runtime on import,
 * which jest has no runtime for. Its own `jestSetup` mocks the native module
 * but not that install, so it does not get far enough on its own.
 *
 * Gesture builders record their callbacks and return themselves, so a chain
 * like `Gesture.Pan().averageTouches(true).onChange(fn)` builds without error
 * and the test can see what was configured. Nothing dispatches events: a
 * gesture is not something this environment can produce, and pretending
 * otherwise would be a test that passes while the real thing is broken.
 * Gesture behaviour is verified on device — see AGENTS.md.
 */

export interface MockGesture {
  readonly type: string;
  readonly handlers: Record<string, (...args: unknown[]) => unknown>;
  readonly config: Record<string, unknown>;
  readonly children?: MockGesture[];
  [key: string]: unknown;
}

const CALLBACK_METHODS = [
  "onBegin",
  "onStart",
  "onUpdate",
  "onChange",
  "onEnd",
  "onFinalize",
  "onTouchesDown",
  "onTouchesMove",
  "onTouchesUp",
];

function buildGesture(type: string, children?: MockGesture[]): MockGesture {
  const gesture = {
    type,
    handlers: {} as Record<string, (...args: unknown[]) => unknown>,
    config: {} as Record<string, unknown>,
    children,
  } as MockGesture;

  // Every builder method returns the proxy, not the raw object — returning the
  // target would end the chain there, and the next `.foo()` would be a
  // TypeError on a plain object.
  const proxy: MockGesture = new Proxy(gesture, {
    get(target, property: string) {
      if (property in target) return target[property];
      return (...args: unknown[]) => {
        target.config[property] = args.length > 1 ? args : args[0];
        return proxy;
      };
    },
  });

  for (const method of CALLBACK_METHODS) {
    gesture[method] = (handler: (...args: unknown[]) => unknown) => {
      gesture.handlers[method] = handler;
      return proxy;
    };
  }

  return proxy;
}

export const Gesture = {
  Pan: () => buildGesture("pan"),
  Pinch: () => buildGesture("pinch"),
  Tap: () => buildGesture("tap"),
  LongPress: () => buildGesture("longPress"),
  Fling: () => buildGesture("fling"),
  Native: () => buildGesture("native"),
  Race: (...gestures: MockGesture[]) => buildGesture("race", gestures),
  Simultaneous: (...gestures: MockGesture[]) =>
    buildGesture("simultaneous", gestures),
  Exclusive: (...gestures: MockGesture[]) =>
    buildGesture("exclusive", gestures),
};

/**
 * Every gesture handed to a `GestureDetector` this render pass, newest last.
 *
 * Recording them is what makes the gesture *logic* testable without a device:
 * a test can reach the handler a component registered and call it with a
 * synthetic event. That covers the maths — a pan's delta, a pinch's focal
 * point, a zoom step — while leaving the parts only hardware can answer
 * (arbitration, feel, whether a tap survives a drag) to manual verification.
 */
const mountedGestures: MockGesture[] = [];

export function peekGestures(): MockGesture[] {
  return mountedGestures;
}

export function resetGestureMock(): void {
  mountedGestures.length = 0;
}

/** Depth-first search for the first gesture of a given type in a composition. */
export function findGesture(
  root: MockGesture | undefined,
  type: string,
): MockGesture | undefined {
  if (!root) return undefined;
  if (root.type === type) return root;
  for (const child of root.children ?? []) {
    const found = findGesture(child, type);
    if (found) return found;
  }
  return undefined;
}

export const GestureDetector: React.FC<{
  gesture?: MockGesture;
  children?: React.ReactNode;
}> = ({ gesture, children }) => {
  if (gesture && !mountedGestures.includes(gesture)) {
    mountedGestures.push(gesture);
  }
  return <>{children}</>;
};

export const GestureHandlerRootView: React.FC<ViewProps> = (props) => (
  <View {...props} />
);

export const ScrollView = View;
export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

export default { Gesture, GestureDetector, GestureHandlerRootView, State };
