mod screencap;
mod sysinfo;
mod types;
mod window;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::image::Image;

use sysinfo::get_system_stats;
use screencap::capture_screen;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let debug_click_state = Arc::new(AtomicBool::new(true)); // debug mode on by default for dev

    tauri::Builder::default()
        .manage(window::DebugClickState(debug_click_state.clone()))
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            capture_screen,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0)));

            // Center horizontally at top
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let screen = monitor.size();
                let win = window.outer_size().unwrap_or(tauri::PhysicalSize::new(1920, 150));
                let x = (screen.width.saturating_sub(win.width)) / 2;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, 0));
            }

            // Setup click-through for transparent areas
            let _ = window::setup_click_through(app, debug_click_state.clone());

            // Setup tray icon
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app).item(&quit_item).build()?;

            let _tray = TrayIconBuilder::new()
                .icon(Image::new_owned(create_tray_icon(), 32, 32))
                .menu(&menu)
                .tooltip("Liquid Glass Island")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
