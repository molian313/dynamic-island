# AGENTS.md

## Project Overview

Tauri 2 desktop app ("Dynamic Island") — a macOS-style floating capsule overlay for Windows showing time, memory usage, network speed, and file/shortcut launchers.

- **Frontend**: Vanilla TypeScript + Vite (no framework). Entry: `index.html` → `src/main.ts`
- **Backend**: Rust (Tauri 2). Entry: `src-tauri/src/main.rs` → `src-tauri/src/lib.rs`
- **Platform**: Windows only. Uses Win32 APIs (`windows` crate) for `GlobalMemoryStatusEx` and `GetIfTable`.

## Commands

```bash
# Frontend only (dev server on port 1420)
npm run dev

# Full Tauri app (frontend + Rust backend, hot-reload)
npm run tauri dev

# Build frontend to dist/
npm run build

# Type-check frontend
npx tsc --noEmit

# Build full desktop app (produces installer)
npm run tauri build
```

There is no test suite, linter, or formatter configured.

## Architecture

- `src/` — TypeScript frontend modules
  - `main.ts` — init loop, polls system stats every 1.5s, time every 1s
  - `dom.ts` — exported DOM element references (used everywhere, no circular deps)
  - `state.ts` — module-level mutable state with setters (isMinimized, isDragging, leftMode, rightMode)
  - `settings.ts` — settings page logic (auto-start toggle, printer CRUD)
  - `modules/` — feature modules: capsule-interaction, drag, minimize, shortcut, view-switcher, printer
- `src-tauri/` — Rust backend
  - `lib.rs` — Module declarations + tray icon + `run()` entry (98 lines)
  - `types.rs` — `SystemStats` + `ShortcutItem` type definitions
  - `icon.rs` — Windows IShellItemImageFactory icon extraction (BGRA→RGBA→PNG→base64)
  - `shortcuts.rs` — Shortcut CRUD + OnceLock static storage + file persistence
  - `sysinfo.rs` — Win32 `GlobalMemoryStatusEx` + `GetIfTable` for memory/network stats
  - `printer.rs` — MQTT Bambu Lab printer monitoring + `PrinterManager`
  - `settings.rs` — Auto-start registry + JSON settings persistence + settings window creation
- `src-tauri/capabilities/default.json` — Tauri 2 permissions (currently `core:default` + `shell:allow-open`)
- Shortcuts are persisted to `%LOCALAPPDATA%/dynamic-island/shortcuts.json`
- Settings are persisted to `%APPDATA%/dynamic-island/settings.json`

## Gotchas

- The app window is borderless, transparent, always-on-top, fixed-size (500×100). Do not add resizable/visible titlebar without explicit intent.
- Vite dev server is hardcoded to port 1420 (`strictPort: true`). Tauri expects it there.
- `src/styles/island.css` is loaded via `<link>` in `index.html` — no bundler CSS processing.
- No `@tauri-apps/plugin-fs` — file operations go through Rust commands, not the frontend.
- The `windows` crate dependency pins to v0.61 and uses specific Win32 feature gates. Adding new Win32 APIs requires matching feature flags in `Cargo.toml`.

## 问题排查

遇到编译错误或异常时，先搜索以下目录，按关键词查找是否有现成解决方案：

- `C:\Users\Administrator\Documents\molian\agents-resource\manual/problems\` — 手动整理的方案（永久保留）
- `C:\Users\Administrator\Documents\molian\agents-resource\auto/problems\` — 自动保存的方案（可能被清理）

关键词参考：

| 搜索什么 | 关键词 |
|---------|-------|
| Tauri command pub 错误 | `tauri`, `command`, `pub` |
| rumqttc/rustls 版本冲突 | `rumqttc`, `rustls`, `tls` |
| Bambu Lab 自签名证书 | `bambu`, `certificate`, `self-signed` |
| Windows crate API 签名 | `windows`, `win32`, `GetWindowRect` |
| Vite 8 缺 esbuild | `vite`, `esbuild` |
| Vite 构建目标过低 | `vite`, `target`, `es2022` |
| 双打印机显示同名 | `printer`, `secondary`, `priority` |
| Settings 页面同步 | `tauri`, `settings`, `inline` |
| Rust dead_code 警告 | `dead_code`, `warning` |
| GitHub Actions Node.js 弃用 | `github-actions`, `nodejs` |
