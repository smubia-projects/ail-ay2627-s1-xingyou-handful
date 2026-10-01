import type { HandLandmarker } from "@mediapipe/tasks-vision";

// Loads Google's hand tracker once and shares it. The engine and model are served from
// public/mediapipe, so nothing is fetched from anywhere else and the video never leaves the device.
let loading: Promise<HandLandmarker> | null = null;

export class NoGraphicsError extends Error {
  constructor() {
    super("WebGL is not available");
  }
}

function hasGraphics(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function loadHandTracker(): Promise<HandLandmarker> {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const create = (delegate: "GPU" | "CPU") =>
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate },
          runningMode: "VIDEO",
          numHands: 1,
        });
      // The tracker draws video frames with WebGL even in its processor mode, so without
      // graphics support it can't work at all. Say so before downloading anything big.
      if (!hasGraphics()) throw new NoGraphicsError();
      try {
        return await create("GPU");
      } catch {
        return await create("CPU");
      }
    })();
    // A failed load can be retried (except for a device that will never work).
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

// The lines between the 21 hand points, for drawing the skeleton.
export const HAND_LINES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
