use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::*;

pub struct DebugClickState(pub Arc<AtomicBool>);

const CAPSULE_TOP_PAD: f64 = 11.0;
const CAPSULE_COLLAPSED_H: f64 = 50.0;
const CAPSULE_EXPANDED_W: f64 = 340.0;
const CAPSULE_EXPANDED_H: f64 = 74.0;
const ZONE_HALF: f64 = 75.0;
const ZONE_TOP: f64 = 15.0;

pub fn set_click_through(hwnd: HWND, through: bool) {
    unsafe {
        let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
        let has_transparent = (ex & WS_EX_TRANSPARENT.0 as i32) != 0;
        if through && !has_transparent {
            SetWindowLongW(hwnd, GWL_EXSTYLE, ex | WS_EX_TRANSPARENT.0 as i32 | WS_EX_LAYERED.0 as i32);
        } else if !through && has_transparent {
            SetWindowLongW(hwnd, GWL_EXSTYLE, ex & !(WS_EX_TRANSPARENT.0 as i32));
        }
    }
}

pub fn setup_click_through(app: &tauri::App, debug_click_state: Arc<AtomicBool>) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").unwrap();
    let hwnd = window.hwnd()?;
    let hwnd_val = hwnd.0 as usize;

    // Start as click-through
    set_click_through(hwnd, true);

    let scale = window.scale_factor().unwrap_or(1.0);
    let screen_w = if let Ok(Some(monitor)) = window.current_monitor() {
        monitor.size().width as f64 / monitor.scale_factor()
    } else {
        1920.0
    };

    let is_expanded = Arc::new(AtomicBool::new(false));
    let is_interacting = Arc::new(AtomicBool::new(false));

    // Listen for expand events from frontend
    let is_expanded_listen = is_expanded.clone();
    let window_clone = window.clone();
    tauri::async_runtime::spawn(async move {
        use tauri::Listener;
        let _ = window_clone.listen("set-expand", move |event| {
            let expanded: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            is_expanded_listen.store(expanded, Ordering::Relaxed);
        });
    });

    // Listen for interaction events from frontend
    let is_interacting_listen = is_interacting.clone();
    let window_clone2 = window.clone();
    tauri::async_runtime::spawn(async move {
        use tauri::Listener;
        let _ = window_clone2.listen("set-interacting", move |event| {
            let interacting: bool = serde_json::from_str(event.payload()).unwrap_or(false);
            is_interacting_listen.store(interacting, Ordering::Relaxed);
        });
    });

    // Mouse monitoring thread
    let window_thread = window.clone();
    thread::spawn(move || {
        let hwnd = HWND(hwnd_val as *mut _);
        let center_x = (screen_w * scale / 2.0) as i32;
        let zone_half = (ZONE_HALF * scale) as i32;
        let zone_top = (ZONE_TOP * scale) as i32;
        let mut was_on_capsule = false;
        let mut was_interacting = false;

        loop {
            if let Some((mx, my)) = get_cursor_pos() {
                let expanded = is_expanded.load(Ordering::Relaxed);
                let interacting = is_interacting.load(Ordering::Relaxed);
                let debug_mode = debug_click_state.load(Ordering::Relaxed);

                let rect = get_window_rect(hwnd);
                let on_capsule = if let Some(rect) = rect {
                    let win_w = (rect.right - rect.left) as f64 / scale;

                    let (cw, ch) = if expanded {
                        (CAPSULE_EXPANDED_W + 240.0, CAPSULE_EXPANDED_H)
                    } else {
                        (196.0, CAPSULE_COLLAPSED_H)
                    };

                    let win_x = rect.left as f64;
                    let win_y = rect.top as f64;
                    let capsule_x = win_x + (win_w * scale - cw * scale) / 2.0;
                    let capsule_y = win_y + CAPSULE_TOP_PAD * scale;
                    let fmx = mx as f64;
                    let fmy = my as f64;
                    fmx >= capsule_x && fmx <= capsule_x + cw * scale && fmy >= capsule_y && fmy <= capsule_y + ch * scale
                } else {
                    false
                };

                // When interacting transitions from true to false, force re-sync
                if was_interacting && !interacting {
                    set_click_through(hwnd, !on_capsule);
                    was_on_capsule = on_capsule;
                }
                was_interacting = interacting;

                // Toggle click-through based on capsule hover
                if debug_mode {
                    set_click_through(hwnd, false);
                    was_on_capsule = on_capsule;
                } else if on_capsule && !was_on_capsule {
                    if !interacting {
                        set_click_through(hwnd, false);
                    }
                    was_on_capsule = true;
                } else if !on_capsule && was_on_capsule {
                    if !interacting {
                        set_click_through(hwnd, true);
                    }
                    was_on_capsule = false;
                }

                // Trigger zone for expand
                let in_zone = mx > center_x - zone_half && mx < center_x + zone_half && my < zone_top;
                if in_zone && !expanded {
                    let _ = window_thread.emit("set-expand", true);
                    is_expanded.store(true, Ordering::Relaxed);
                } else if expanded {
                    if let Some(rect) = rect {
                        let win_bottom = (rect.bottom as f64 / scale) as i32 + (10.0 * scale) as i32;
                        if my > win_bottom {
                            let _ = window_thread.emit("set-expand", false);
                            is_expanded.store(false, Ordering::Relaxed);
                        }
                    }
                }
            }
            thread::sleep(Duration::from_millis(16));
        }
    });

    Ok(())
}

fn get_cursor_pos() -> Option<(i32, i32)> {
    use windows::Win32::Foundation::POINT;
    let mut pt = POINT { x: 0, y: 0 };
    unsafe {
        if GetCursorPos(&mut pt).is_ok() {
            Some((pt.x, pt.y))
        } else {
            None
        }
    }
}

fn get_window_rect(hwnd: HWND) -> Option<windows::Win32::Foundation::RECT> {
    let mut rect = windows::Win32::Foundation::RECT::default();
    unsafe {
        if GetWindowRect(hwnd, &mut rect).is_ok() {
            Some(rect)
        } else {
            None
        }
    }
}

#[tauri::command]
pub fn show_context_menu(app: tauri::AppHandle, window: tauri::WebviewWindow) {
    let Some((x, y)) = get_cursor_pos() else { return };
    let Ok(hwnd) = window.hwnd() else { return };

    let cmd_id: i32 = unsafe {
        let hwnd = HWND(hwnd.0);
        let Ok(h_menu) = CreatePopupMenu() else { return };
        let _ = AppendMenuW(h_menu, MF_STRING, 1, windows::core::w!("收起"));
        let _ = AppendMenuW(h_menu, MF_STRING, 2, windows::core::w!("设置"));
        let cmd = TrackPopupMenu(
            h_menu,
            TPM_LEFTALIGN | TPM_TOPALIGN | TPM_RETURNCMD,
            x,
            y,
            None,
            hwnd,
            None,
        ).0;
        let _ = DestroyMenu(h_menu);
        cmd
    };

    match cmd_id {
        1 => {
            let _ = app.emit("context-menu-action", "minimize");
        }
        2 => {
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(50));
                crate::settings::open_settings(app);
            });
        }
        _ => {}
    }
}

pub fn get_foreground_process_name() -> Option<String> {
    use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_NAME_WIN32};
    use windows::core::PWSTR;

    unsafe {
        let fg = GetForegroundWindow();
        if fg.0.is_null() { return None; }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(fg, Some(&mut pid));
        if pid == 0 { return None; }

        let handle = match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            Ok(h) => h,
            Err(_) => return None,
        };
        let mut buf = [0u16; 260];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len);
        let _ = windows::Win32::Foundation::CloseHandle(handle);
        if ok.is_err() { return None; }

        let path = String::from_utf16_lossy(&buf[..len as usize]);
        path.rsplit('\\').next().map(|s| s.to_lowercase())
    }
}
