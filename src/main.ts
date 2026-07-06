import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { capsule, leftPanel, rightPanel, timeText, memText, netUp, netDown } from "./dom";
import { initCapsuleInteraction } from "./modules/capsule-interaction";
import { initMinimize } from "./modules/minimize";
import { initShortcut } from "./modules/shortcut";
import { initPrinter } from "./modules/printer";
import { initTheme } from "./modules/theme";

interface SystemInfo {
  memory_percent: number;
  net_up_speed: string;
  net_down_speed: string;
}

function updateTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  timeText.textContent = `${h}:${m}:${s}`;
}

async function updateSystemInfo() {
  try {
    const info = await invoke<SystemInfo>("get_system_stats");
    memText.textContent = `内存 ${info.memory_percent}%`;
    netUp.textContent = info.net_up_speed;
    netDown.textContent = info.net_down_speed;
  } catch (e) {
    console.error("[SysInfo]", e);
  }
}

async function initDebugButton() {
  const debugBtn = document.getElementById("debug-expand-btn")!;

  // Load initial state from Rust
  invoke<boolean>("get_debug_mode").then((enabled) => {
    debugBtn.style.display = enabled ? "flex" : "none";
  }).catch(() => {});

  // Listen for changes from Rust (via settings window)
  await listen<{ enabled: boolean }>("debug-mode-changed", (event) => {
    debugBtn.style.display = event.payload.enabled ? "flex" : "none";
  });

  // Click to toggle expanded state
  debugBtn.addEventListener("click", () => {
    leftPanel.classList.toggle("expanded");
    rightPanel.classList.toggle("expanded");
  });
}

function init() {
  updateTime();
  setInterval(updateTime, 1000);

  updateSystemInfo();
  setInterval(updateSystemInfo, 1500);

  initCapsuleInteraction();
  initMinimize();
  initShortcut();
  initPrinter();
  initDebugButton();
  initTheme();
}

init();
