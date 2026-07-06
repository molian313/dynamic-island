import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { shortcutList, shortcutArea, capsule } from "../dom";

interface ShortcutItem {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  type: string;
}

let dragOut: { itemId: string; startX: number; startY: number; isDragging: boolean } | null = null;

async function loadShortcuts() {
  try {
    const shortcuts: ShortcutItem[] = await invoke("get_shortcuts");
    renderShortcuts(shortcuts);
  } catch (e) {
    console.error("[Shortcut] load failed:", e);
  }
}

function renderShortcuts(shortcuts: ShortcutItem[]) {
  shortcutList.innerHTML = "";

  if (shortcuts.length === 0) {
    shortcutList.innerHTML = '<div class="shortcut-empty">拖拽文件夹到此处添加</div>';
    return;
  }

  shortcuts.forEach((item) => {
    const el = document.createElement("div");
    el.className = "sc-item";
    el.dataset.id = item.id;

    const icon = document.createElement("span");
    icon.className = "sc-icon";
    if (item.icon) {
      const img = document.createElement("img");
      img.src = item.icon;
      img.draggable = false;
      icon.appendChild(img);
    } else {
      icon.textContent = item.type === "folder" ? "📁" : item.type === "app" ? "📱" : "📄";
    }

    const labelShort = document.createElement("span");
    labelShort.className = "sc-label sc-label-short";
    labelShort.textContent = item.name.slice(0, 2);

    const labelFull = document.createElement("span");
    labelFull.className = "sc-label sc-label-full";
    labelFull.textContent = item.name;

    el.appendChild(icon);
    el.appendChild(labelShort);
    el.appendChild(labelFull);

    el.addEventListener("click", () => {
      invoke("open_shortcut", { id: item.id }).catch(console.warn);
    });

    shortcutList.appendChild(el);
  });
}

export function initShortcut() {
  loadShortcuts();

  shortcutList.addEventListener("mousedown", (e: MouseEvent) => {
    const itemEl = (e.target as HTMLElement).closest(".sc-item") as HTMLElement | null;
    if (!itemEl) return;
    e.stopPropagation();
    e.preventDefault();
    dragOut = {
      itemId: itemEl.dataset.id!,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!dragOut) return;
    if (!dragOut.isDragging) {
      const dx = e.clientX - dragOut.startX;
      const dy = e.clientY - dragOut.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragOut.isDragging = true;
        const el = shortcutList.querySelector(`[data-id="${dragOut.itemId}"]`);
        if (el) el.classList.add("dragging");
      }
    }
  });

  document.addEventListener("mouseup", async (e: MouseEvent) => {
    if (!dragOut) return;
    const el = shortcutList.querySelector(`[data-id="${dragOut.itemId}"]`);
    if (el) el.classList.remove("dragging");

    if (dragOut.isDragging) {
      const r = capsule.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        try {
          await invoke("remove_shortcut", { id: dragOut.itemId });
          await loadShortcuts();
        } catch (err) {
          console.error("[Shortcut] delete failed:", err);
        }
      }
    }
    dragOut = null;
  });

  listen<any>("tauri://drag-drop", async (event) => {
    shortcutArea.classList.remove("drag-over");
    const payload = event.payload;
    let paths: string[] = [];
    if (payload?.Drop?.paths) {
      paths = payload.Drop.paths;
    } else if (Array.isArray(payload)) {
      paths = payload;
    } else if (payload?.paths) {
      paths = payload.paths;
    }
    for (const p of paths) {
      try {
        await invoke("add_shortcut", { path: p });
      } catch (e) {
        console.error("[DragDrop] add failed:", e);
      }
    }
    if (paths.length > 0) {
      await loadShortcuts();
    }
  });

  listen("tauri://drag-enter", () => {
    shortcutArea.classList.add("drag-over");
  });

  listen("tauri://drag-over", () => {});

  listen("tauri://drag-leave", () => {
    shortcutArea.classList.remove("drag-over");
  });
}
