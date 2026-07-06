import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { startBrightnessPolling, stopBrightnessPolling } from "./brightness";

let currentTheme = "dark";

function applyTheme(theme: string) {
  const capsule = document.getElementById("island-capsule");
  if (!capsule) return;

  capsule.classList.remove("theme-dark", "theme-glass");
  capsule.classList.add(`theme-${theme}`);

  if (theme === "glass") {
    startBrightnessPolling(200);
  } else {
    stopBrightnessPolling();
    document.documentElement.style.setProperty("--adaptive-text", "#ffffff");
  }

  currentTheme = theme;
}

export async function initTheme() {
  try {
    const theme: string = await invoke("get_theme");
    applyTheme(theme);
  } catch {
    applyTheme("dark");
  }

  await listen<{ theme: string }>("theme-changed", (event) => {
    const capsule = document.getElementById("island-capsule");
    if (!capsule) return;

    capsule.style.transition = "opacity 0.15s ease";
    capsule.style.opacity = "0";

    setTimeout(() => {
      applyTheme(event.payload.theme);
      capsule.style.opacity = "1";
      setTimeout(() => { capsule.style.transition = ""; }, 180);
    }, 150);
  });
}

export function getCurrentTheme() {
  return currentTheme;
}
