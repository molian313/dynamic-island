use crate::types::ShortcutItem;
use crate::icon::get_file_icon_data_url;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

static SHORTCUTS: OnceLock<Mutex<Vec<ShortcutItem>>> = OnceLock::new();

fn get_shortcuts_store() -> &'static Mutex<Vec<ShortcutItem>> {
    SHORTCUTS.get_or_init(|| Mutex::new(load_from_file()))
}

fn shortcuts_path() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("dynamic-island");
    fs::create_dir_all(&dir).ok();
    dir.join("shortcuts.json")
}

fn load_from_file() -> Vec<ShortcutItem> {
    let path = shortcuts_path();
    if !path.exists() {
        return Vec::new();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_to_file(shortcuts: &[ShortcutItem]) {
    let path = shortcuts_path();
    if let Ok(json) = serde_json::to_string_pretty(shortcuts) {
        let _ = fs::write(&path, json);
    }
}

#[tauri::command]
pub fn get_shortcuts() -> Vec<ShortcutItem> {
    let store = get_shortcuts_store();
    let existing = { store.lock().unwrap().clone() };

    let mut modified = existing.clone();
    let mut changed = false;
    for item in &mut modified {
        if item.r#type == "folder" {
            let path_buf = PathBuf::from(&item.path);
            let new_name = path_buf
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                .unwrap_or(&item.name)
                .to_string();
            if item.name != new_name {
                item.name = new_name;
                changed = true;
            }
        }

        if let Some(icon) = get_file_icon_data_url(&item.path) {
            if item.icon.as_ref() != Some(&icon) {
                item.icon = Some(icon);
                changed = true;
            }
        }
    }

    if changed {
        let mut guard = store.lock().unwrap();
        *guard = modified.clone();
        save_to_file(&modified);
    }

    modified
}

#[tauri::command]
pub fn add_shortcut(path: String) -> Result<(), String> {
    let store = get_shortcuts_store();
    let mut shortcuts = store.lock().unwrap();

    if shortcuts.iter().any(|s| s.path == path) {
        return Ok(());
    }

    let path_buf = PathBuf::from(&path);

    let r#type = if path_buf.is_dir() {
        "folder"
    } else if path_buf.extension().map(|e| e == "exe").unwrap_or(false) {
        "app"
    } else {
        "file"
    };

    let name = if r#type == "folder" {
        path_buf
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or(&path)
            .to_string()
    } else {
        path_buf
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&path)
            .to_string()
    };

    let icon = get_file_icon_data_url(&path);

    let item = ShortcutItem {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path: path.clone(),
        icon,
        r#type: r#type.to_string(),
    };

    shortcuts.push(item);
    save_to_file(&shortcuts);

    Ok(())
}

#[tauri::command]
pub fn remove_shortcut(id: String) -> Result<(), String> {
    let store = get_shortcuts_store();
    let mut shortcuts = store.lock().unwrap();
    shortcuts.retain(|s| s.id != id);
    save_to_file(&shortcuts);
    Ok(())
}

#[tauri::command]
pub fn open_shortcut(id: String) -> Result<(), String> {
    let store = get_shortcuts_store();
    let shortcuts = store.lock().unwrap();
    if let Some(item) = shortcuts.iter().find(|s| s.id == id) {
        #[cfg(target_os = "windows")]
        {
            if item.r#type == "app" {
                std::process::Command::new(&item.path)
                    .spawn()
                    .map_err(|e| format!("启动应用失败: {}", e))?;
            } else {
                open_or_focus_explorer(&item.path);
            }
        }
        Ok(())
    } else {
        Err("Shortcut not found".to_string())
    }
}

#[cfg(target_os = "windows")]
fn open_or_focus_explorer(path: &str) {
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::Foundation::HWND;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let wide_path: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        let _ = ShellExecuteW(
            Some(HWND(std::ptr::null_mut())),
            windows::core::w!("open"),
            windows::core::PCWSTR(wide_path.as_ptr()),
            windows::core::PCWSTR::null(),
            windows::core::PCWSTR::null(),
            windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        );
    }
}
