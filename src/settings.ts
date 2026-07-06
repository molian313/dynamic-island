import { invoke } from "@tauri-apps/api/core";

interface PrinterConfig {
  name: string;
  ip_address: string;
  access_code: string;
  serial: string;
}

let printerConfigs: PrinterConfig[] = [];
let editingIndex = -1;

// Page navigation
const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");
const pageDesc = document.getElementById("page-desc");

const pageInfo: Record<string, { title: string; desc: string }> = {
  general: { title: "常规设置", desc: "配置系统选项。" },
  printer: { title: "打印机", desc: "管理 Bambu Lab 打印机连接配置。" },
};

function navigateTo(pageId: string) {
  navItems.forEach(n => n.classList.remove("active"));
  document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add("active");
  pages.forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${pageId}`)?.classList.add("active");
  const info = pageInfo[pageId];
  if (info) {
    if (pageTitle) pageTitle.textContent = info.title;
    if (pageDesc) pageDesc.textContent = info.desc;
  }
}

navItems.forEach(item => {
  item.addEventListener("click", () => navigateTo((item as HTMLElement).dataset.page ?? ""));
});

// Auto-start
const autoStartToggle = document.getElementById("auto-start-toggle") as HTMLInputElement;

async function loadSettings() {
  try {
    const autoStart = await invoke<boolean>("get_auto_start");
    autoStartToggle.checked = autoStart;
  } catch (e) {
    console.error("[Settings]", e);
  }
}

autoStartToggle.addEventListener("change", async () => {
  try {
    await invoke("set_auto_start", { enabled: autoStartToggle.checked });
  } catch (e) {
    console.error("[Settings]", e);
  }
});

// Printer configs
const printerList = document.getElementById("printer-list")!;
const pcfgName = document.getElementById("pcfg-name") as HTMLInputElement;
const pcfgIp = document.getElementById("pcfg-ip") as HTMLInputElement;
const pcfgAccess = document.getElementById("pcfg-access") as HTMLInputElement;
const pcfgSerial = document.getElementById("pcfg-serial") as HTMLInputElement;
const pcfgAdd = document.getElementById("pcfg-add")!;
const pcfgSave = document.getElementById("pcfg-save")!;

function renderPrinterList() {
  printerList.innerHTML = "";
  printerConfigs.forEach((cfg, i) => {
    const el = document.createElement("div");
    el.className = "printer-item";
    el.innerHTML = `
      <div class="printer-item-info">
        <div class="printer-item-name">${cfg.name}</div>
        <div class="printer-item-ip">${cfg.ip_address}</div>
      </div>
      <div class="printer-item-actions">
        <button class="btn btn-edit" data-index="${i}">编辑</button>
        <button class="btn btn-danger" data-index="${i}">删除</button>
      </div>
    `;
    el.querySelector(".btn-edit")?.addEventListener("click", () => {
      editingIndex = i;
      pcfgName.value = cfg.name;
      pcfgIp.value = cfg.ip_address;
      pcfgAccess.value = cfg.access_code;
      pcfgSerial.value = cfg.serial;
      pcfgAdd.textContent = "更新";
      pcfgAdd.classList.remove("btn-primary");
      pcfgAdd.classList.add("btn-edit");
    });
    el.querySelector(".btn-danger")?.addEventListener("click", () => {
      if (editingIndex === i) cancelEdit();
      else if (editingIndex > i) editingIndex--;
      printerConfigs.splice(i, 1);
      renderPrinterList();
    });
    printerList.appendChild(el);
  });
}

function cancelEdit() {
  editingIndex = -1;
  pcfgAdd.textContent = "添加";
  pcfgAdd.classList.remove("btn-edit");
  pcfgAdd.classList.add("btn-primary");
  pcfgName.value = "";
  pcfgIp.value = "";
  pcfgAccess.value = "";
  pcfgSerial.value = "";
}

pcfgAdd.addEventListener("click", () => {
  const name = pcfgName.value.trim();
  const ip = pcfgIp.value.trim();
  const access = pcfgAccess.value.trim();
  const serial = pcfgSerial.value.trim();
  if (!name || !ip || !access || !serial) return;

  if (editingIndex >= 0) {
    printerConfigs[editingIndex] = { name, ip_address: ip, access_code: access, serial: serial };
    cancelEdit();
  } else {
    printerConfigs.push({ name, ip_address: ip, access_code: access, serial: serial });
  }
  renderPrinterList();

  pcfgName.value = "";
  pcfgIp.value = "";
  pcfgAccess.value = "";
  pcfgSerial.value = "";
});

pcfgSave.addEventListener("click", async () => {
  try {
    await invoke("set_printer_configs", { configs: printerConfigs });
    showStatus("打印机配置已保存");
  } catch (e) {
    console.error("[Printer]", e);
  }
});

async function loadPrinterConfigs() {
  try {
    printerConfigs = await invoke<PrinterConfig[]>("get_printer_configs");
    renderPrinterList();
  } catch (e) {
    console.error("[Printer]", e);
  }
}

// Status
const statusEl = document.getElementById("status")!;

function showStatus(msg: string) {
  statusEl.textContent = msg;
  statusEl.classList.add("show");
  setTimeout(() => statusEl.classList.remove("show"), 2000);
}

// Debug mode
const debugToggle = document.getElementById("debug-toggle") as HTMLInputElement;

async function loadDebugMode() {
  try {
    const enabled = await invoke<boolean>("get_debug_mode");
    debugToggle.checked = enabled;
  } catch (e) {
    console.error("[Settings]", e);
  }
}

async function updateDebugButton() {
  try {
    await invoke("set_debug_mode", { enabled: debugToggle.checked });
  } catch (e) {
    console.error("[Settings] set_debug_mode failed:", e);
  }
}

debugToggle.addEventListener("change", () => {
  console.log("[Settings] debug mode toggled to:", debugToggle.checked);
  updateDebugButton();
});

// Init
loadSettings();
loadPrinterConfigs();
loadDebugMode();
