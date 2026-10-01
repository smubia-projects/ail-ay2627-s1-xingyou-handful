"use client";

import { useEffect } from "react";
import { useProgress } from "@/lib/progress";

// Tells the stylesheet which hand the learner signs with. Left-handed mode mirrors every
// element with the "hand-mirror" class (see globals.css).
export default function HandPreference() {
  const { leftHanded } = useProgress();
  useEffect(() => {
    document.documentElement.dataset.hand = leftHanded ? "left" : "right";
  }, [leftHanded]);
  return null;
}
