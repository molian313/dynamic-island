import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface PrinterStatus {
  name: string;
  status: string;
  progress: number;
  remaining_time: number;
  nozzle_temp: number;
  bed_temp: number;
  layer_num: number;
  total_layers: number;
}

interface PrinterEvent {
  index: number;
  status: PrinterStatus;
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    printing: "#eab308",
    completed: "#22c55e",
    failed: "#ef4444",
    paused: "#ef4444",
    disconnected: "#6b7280",
    no_printer: "#6b7280",
  };
  return map[status] || "#6b7280";
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    printing: "打印中",
    completed: "已完成",
    failed: "失败",
    paused: "暂停",
    disconnected: "未连接",
    no_printer: "未配置",
  };
  return map[status] || "未知";
}

function formatTime(minutes: number): string {
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}` : `0:${m.toString().padStart(2, "0")}`;
}

function updatePrinter(index: number, status: PrinterStatus) {
  const selector = index === 0 ? ".printer-unit" : ".printer-unit-2";
  const progress = document.querySelector(`${selector} .printer-progress`) as SVGCircleElement;
  const percent = document.querySelector(`${selector} .printer-percent`) as HTMLSpanElement;
  const name = document.querySelector(`${selector} .printer-name`) as HTMLSpanElement;
  const statusEl = document.querySelector(`${selector} .printer-status`) as HTMLSpanElement;

  if (progress) {
    const circumference = 2 * Math.PI * 12;
    const offset = circumference - (status.progress / 100) * circumference;
    progress.style.strokeDashoffset = `${offset}`;
    progress.style.stroke = getStatusColor(status.status);
  }

  if (percent) {
    percent.textContent = `${status.progress}%`;
  }

  if (name) {
    name.textContent = status.name || `${index + 1}号`;
  }

  if (statusEl) {
    statusEl.textContent = status.status === "printing"
      ? `${formatTime(status.remaining_time)}`
      : getStatusText(status.status);
  }
}

export async function initPrinter() {
  await listen<PrinterEvent>("printer-status", (event) => {
    // Update both printers with priority/secondary status
    updatePrinter1FromPriority();
    updatePrinter2FromSecondary();
  });

  // Listen for config changes from settings page
  await listen("printer-configs-changed", () => {
    updatePrinter1FromPriority();
    updatePrinter2FromSecondary();
  });

  // Initial load
  updatePrinter1FromPriority();
  updatePrinter2FromSecondary();
}

async function updatePrinter1FromPriority() {
  try {
    const status = await invoke<PrinterStatus>("get_priority_printer_status");
    updatePrinter(0, status);
  } catch (e) {
    console.error("[Printer]", e);
  }
}

async function updatePrinter2FromSecondary() {
  try {
    const status = await invoke<PrinterStatus>("get_secondary_printer_status");
    updatePrinter(1, status);
  } catch (e) {
    console.error("[Printer]", e);
  }
}
