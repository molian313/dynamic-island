use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{Manager, Emitter};

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

fn default_theme() -> String { "dark".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsData {
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default)]
    pub debug_mode: bool,
    #[serde(default)]
    pub blacklist_enabled: bool,
    #[serde(default = "default_blacklist_processes")]
    pub blacklist_processes: Vec<String>,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_blacklist_processes() -> Vec<String> { Vec::new() }

fn get_settings_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("dynamic-island");
    fs::create_dir_all(&path).ok();
    path.push("settings.json");
    path
}

pub fn load_settings_from_file() -> SettingsData {
    let path = get_settings_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(data) = serde_json::from_str::<SettingsData>(&content) {
            return data;
        }
    }
    SettingsData { auto_start: false, debug_mode: false, blacklist_enabled: false, blacklist_processes: Vec::new(), theme: "dark".to_string() }
}

pub fn save_settings_to_file(data: &SettingsData) -> Result<(), String> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_settings(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(&app, "settings", tauri::WebviewUrl::App("settings.html".into()))
            .title("灵动岛 - 设置")
            .inner_size(600.0, 500.0)
            .min_inner_size(500.0, 400.0)
            .resizable(true)
            .center()
            .build();
    }
}

#[tauri::command]
pub fn get_settings() -> SettingsData {
    load_settings_from_file()
}

#[tauri::command]
pub fn save_settings(auto_start: Option<bool>) -> Result<(), String> {
    let mut settings = load_settings_from_file();

    if let Some(auto) = auto_start {
        settings.auto_start = auto;
        let _ = apply_auto_start(auto);
    }

    save_settings_to_file(&settings)
}

#[tauri::command]
pub fn get_debug_mode() -> bool {
    load_settings_from_file().debug_mode
}

#[tauri::command]
pub fn set_debug_mode(app: tauri::AppHandle, state: tauri::State<'_, crate::window::DebugClickState>, enabled: bool) -> Result<(), String> {
    let mut settings = load_settings_from_file();
    settings.debug_mode = enabled;
    save_settings_to_file(&settings)?;
    state.0.store(enabled, std::sync::atomic::Ordering::Relaxed);
    let _ = app.emit("debug-mode-changed", serde_json::json!({ "enabled": enabled }));
    Ok(())
}

const AUTOSTART_REG_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
const AUTOSTART_REG_NAME: &str = "DynamicIsland";

#[tauri::command]
pub fn get_auto_start() -> bool {
    #[cfg(windows)]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(run_key) = hkcu.open_subkey(AUTOSTART_REG_KEY) {
            return run_key.get_value::<String, _>(AUTOSTART_REG_NAME).is_ok();
        }
        false
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
pub fn set_auto_start(enabled: bool) -> Result<(), String> {
    apply_auto_start(enabled)?;

    let mut settings = load_settings_from_file();
    settings.auto_start = enabled;
    save_settings_to_file(&settings)?;

    Ok(())
}

fn apply_auto_start(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(AUTOSTART_REG_KEY, KEY_WRITE)
            .map_err(|e| format!("打开注册表失败: {}", e))?;

        if enabled {
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("获取程序路径失败: {}", e))?
                .to_string_lossy()
                .to_string();
            run_key
                .set_value(AUTOSTART_REG_NAME, &exe_path)
                .map_err(|e| format!("写入注册表失败: {}", e))?;
        } else {
            let _ = run_key.delete_value(AUTOSTART_REG_NAME);
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Ok(())
    }
}

#[tauri::command]
pub fn get_blacklist() -> Vec<String> {
    load_settings_from_file().blacklist_processes
}

#[tauri::command]
pub fn get_blacklist_enabled() -> bool {
    load_settings_from_file().blacklist_enabled
}

#[tauri::command]
pub fn set_blacklist_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = load_settings_from_file();
    settings.blacklist_enabled = enabled;
    save_settings_to_file(&settings)?;
    let _ = app.emit("blacklist-changed", serde_json::json!({ "enabled": enabled }));
    Ok(())
}

#[tauri::command]
pub fn save_blacklist(app: tauri::AppHandle, processes: Vec<String>) -> Result<(), String> {
    let normalized: Vec<String> = processes.iter()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    let mut settings = load_settings_from_file();
    settings.blacklist_processes = normalized;
    save_settings_to_file(&settings)?;
    let _ = app.emit("blacklist-changed", serde_json::json!({ "processes": settings.blacklist_processes }));
    Ok(())
}

#[tauri::command]
pub fn get_theme() -> String {
    load_settings_from_file().theme
}

#[tauri::command]
pub fn save_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let mut settings = load_settings_from_file();
    settings.theme = theme.clone();
    save_settings_to_file(&settings)?;
    let _ = app.emit("theme-changed", serde_json::json!({ "theme": theme }));
    Ok(())
}
