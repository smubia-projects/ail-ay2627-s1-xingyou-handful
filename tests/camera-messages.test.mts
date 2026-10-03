// Checks the plain-words messages shown when the camera won't start (lib/tracker.ts).
// Run with:  node tests/camera-messages.test.mts
import { cameraProblem, cameraUnavailable } from "../lib/tracker.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  if (!ok) console.log(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
}
const problem = (name: string) => cameraProblem(new DOMException("x", name));

check("a blocked camera says to allow it in the address bar", /blocked.*address bar/.test(problem("NotAllowedError")));
check("no camera says so and offers a video file", /No camera was found.*video file/.test(problem("NotFoundError")));
check("a camera in use by another app says so", /busy.*another app/.test(problem("NotReadableError")));
check("a security error explains the https rule", /secure \(https\)/.test(problem("SecurityError")));
check("anything else gets a general message that offers a video file", /couldn't start.*video file/.test(problem("SomethingElse")) && /couldn't start/.test(cameraProblem(undefined)) && /couldn't start/.test(cameraProblem("text")));
check("without camera support on a secure page, it says the browser can't", /browser can't use the camera/.test(cameraUnavailable(true)));
check("without camera support on an insecure page, it explains https and the same computer", /secure \(https\).*same computer/.test(cameraUnavailable(false)));
check("every message is plain: no error codes or jargon leaks through", ["NotAllowedError", "NotFoundError", "NotReadableError", "SecurityError", "X"].every((n) => !/Error|DOMException|getUserMedia/.test(problem(n))));

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
