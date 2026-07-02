mod screencap;
mod sysinfo;
mod types;
mod window;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;
use tauri::Emitter;
use tauri::Listener;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::image::Image;

use sysinfo::get_system_stats;
use screencap::capture_screen;
use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WINDOW_DISPLAY_AFFINITY};

const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;

#[tauri::command]
fn forward_settings(app: tauri::AppHandle, settings: serde_json::Value) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit_to("main", "settings-changed", settings);
    }
}

fn create_tray_icon() -> Vec<u8> {
    let (size, center, radius) = (32u32, 16.0, 12.0);
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    for y in 0..size {
        for x in 0..size {
            let dist = ((x as f64 - center).powi(2) + (y as f64 - center).powi(2)).sqrt();
            let idx = ((y * size + x) * 4) as usize;
            if dist <= radius {
                let a = if dist > radius - 1.0 { ((radius - dist).max(0.0) * 255.0) as u8 } else { 255 };
                rgba[idx] = 255; rgba[idx+1] = 255; rgba[idx+2] = 255; rgba[idx+3] = a;
            }
        }
    }
    rgba
}

fn open_settings_window(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // If settings window already exists, just focus it
    if let Some(win) = app.get_webview_window("settings") {
        win.show()?;
        win.set_focus()?;
        return Ok(());
    }

    let main_window = app.get_webview_window("main").unwrap();

    let settings = tauri::WebviewWindowBuilder::new(
        app,
        "settings",
        tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("设置 - Liquid Glass Island")
    .inner_size(360.0, 600.0)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()?;

    // Send current config to settings window after it loads
    let settings_clone = settings.clone();
    settings.listen("tauri://ready", move |_| {
        let _ = settings_clone.emit_to("settings", "settings-init", serde_json::Value::Null);
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let debug_click_state = Arc::new(AtomicBool::new(true)); // debug mode on by default for dev

    tauri::Builder::default()
        .manage(window::DebugClickState(debug_click_state.clone()))
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            capture_screen,
            forward_settings,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0)));

            // Exclude window from screen captures (prevents feedback loop ghosting)
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    let _ = SetWindowDisplayAffinity(hwnd, WINDOW_DISPLAY_AFFINITY(WDA_EXCLUDEFROMCAPTURE));
                }
            }

            // Center horizontally at top
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let screen = monitor.size();
                let win = window.outer_size().unwrap_or(tauri::PhysicalSize::new(1920, 150));
                let x = (screen.width.saturating_sub(win.width)) / 2;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, 0));
            }

            // Setup click-through for transparent areas
            let _ = window::setup_click_through(app, debug_click_state.clone());

            // Setup tray icon with menu
            let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(Image::new_owned(create_tray_icon(), 32, 32))
                .menu(&menu)
                .tooltip("Liquid Glass Island")
                .on_menu_event(move |_app, event| {
                    match event.id().as_ref() {
                        "settings" => {
                            let _ = open_settings_window(&app_handle);
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
