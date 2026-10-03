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

// Plain words for why the camera didn't start, from the error the browser gave.
export function cameraProblem(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "The camera is blocked. Allow it in your browser's address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. You can pick a video file instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your camera is busy, probably used by another app or browser tab. Close that and try again, or pick a video file instead.";
  }
  if (name === "SecurityError") return cameraUnavailable(false);
  return "The camera couldn't start. You can pick a video file instead.";
}

// Why there is no camera support at all. Browsers only allow the camera on a secure (https) address,
// or on the same computer.
export function cameraUnavailable(secure = typeof window === "undefined" ? true : window.isSecureContext): string {
  return secure
    ? "This browser can't use the camera here. You can pick a video file instead."
    : "The camera only works on a secure (https) connection, or on the same computer the app runs on. Open the app from its https address, or pick a video file instead.";
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
