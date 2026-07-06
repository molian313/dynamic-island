export let isMinimized = false;
export function setIsMinimized(v: boolean) { isMinimized = v; }

export let leftMode: "time" | "shortcut" = "time";
export function setLeftMode(v: "time" | "shortcut") { leftMode = v; }

export let rightMode: "single" | "multi" = "single";
export function setRightMode(v: "single" | "multi") { rightMode = v; }
