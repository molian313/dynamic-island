import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

let timer: ReturnType<typeof setInterval> | null = null;
const SMOOTH = 0.35;

interface SampleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

let cachedPos: { x: number; y: number } | null = null;

function luminanceToTextColor(lum: number): string {
  if (lum > 0.6) return "#000000";
  if (lum < 0.55) return "#ffffff";
  return document.documentElement.style.getPropertyValue("--adaptive-text") || "#ffffff";
}

function applyBrightness(lum: number) {
  document.documentElement.style.setProperty("--adaptive-text", luminanceToTextColor(lum));
}

function buildRect(el: HTMLElement, pos: { x: number; y: number }, scale: number): SampleRect {
  const r = el.getBoundingClientRect();
  return {
    x: pos.x + Math.round(r.x * scale),
    y: pos.y + Math.round(r.y * scale),
    w: Math.round(r.width * scale),
    h: Math.round(r.height * scale),
  };
}

async function pollBrightness() {
  try {
    if (!cachedPos) {
      cachedPos = await getCurrentWindow().outerPosition();
    }
    const left = document.getElementById("left-panel");
    const right = document.getElementById("right-panel");
    if (!left || !right) return;

    const scale = window.devicePixelRatio || 1;
    const rects = [buildRect(left, cachedPos, scale), buildRect(right, cachedPos, scale)];
    const lum: number = await invoke("get_area_brightness", { rects });
    applyBrightness(lum);
  } catch (e) {
    console.error("[Brightness]", e);
  }
}

export function startBrightnessPolling(intervalMs = 200) {
  if (timer) return;
  pollBrightness();
  timer = setInterval(pollBrightness, intervalMs);
}

export function stopBrightnessPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
