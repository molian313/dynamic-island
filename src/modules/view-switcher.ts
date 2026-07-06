import { leftPanel } from "../dom";
import { leftMode, setLeftMode } from "../state";

export function switchToNextView() {
  const next = leftMode === "time" ? "shortcut" : "time";
  setLeftMode(next);

  leftPanel.classList.remove("time-mode", "shortcuts-mode");
  leftPanel.classList.add(next === "shortcut" ? "shortcuts-mode" : "time-mode");
}
