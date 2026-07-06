import { emit } from "@tauri-apps/api/event";
import { capsule, leftPanel, rightPanel } from "../dom";
import { rightMode, setRightMode } from "../state";
import { switchToNextView } from "./view-switcher";

let isExpanded = false;

export function initCapsuleInteraction() {
  // Listen for expand/collapse from Rust thread
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<boolean>("set-expand", (event) => {
      if (event.payload && !isExpanded) {
        isExpanded = true;
        leftPanel.classList.add("expanded");
        rightPanel.classList.add("expanded");
      } else if (!event.payload && isExpanded) {
        isExpanded = false;
        leftPanel.classList.remove("expanded");
        rightPanel.classList.remove("expanded");
      }
    });
  });

  // Emit interacting state for click-through logic
  capsule.addEventListener("mouseenter", () => {
    emit("set-interacting", true);
  });

  capsule.addEventListener("mouseleave", () => {
    emit("set-interacting", false);
  });

  leftPanel.addEventListener("dblclick", (e: MouseEvent) => {
    e.stopPropagation();
    switchToNextView();
  });

  rightPanel.addEventListener("dblclick", (e: MouseEvent) => {
    e.stopPropagation();
    const newMode = rightMode === "single" ? "multi" : "single";
    setRightMode(newMode);
    rightPanel.classList.toggle("single-mode");
    rightPanel.classList.toggle("multi-mode");
    leftPanel.classList.toggle("multi-open");
  });
}
