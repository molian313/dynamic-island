mod sysinfo;
mod types;
mod icon;
mod shortcuts;
mod settings;
mod window;
mod screenshot;
pub mod printer;

use std::io::Write;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::image::Image;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE, SW_SHOWNOACTIVATE};

use sysinfo::get_system_stats;
use shortcuts::{get_shortcuts, add_shortcut, remove_shortcut, open_shortcut};
use settings::{open_settings, get_settings, save_settings, get_auto_start, set_auto_start, get_debug_mode, set_debug_mode, get_blacklist, get_blacklist_enabled, set_blacklist_enabled, save_blacklist};

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
    // Disable VT mouse tracking to prevent terminal garbling
    let _ = std::io::stdout().write_all(b"\x1b[?1000l\x1b[?1003l\x1b[?1006l");
    let _ = std::io::stdout().flush();

    let printer_manager = Arc::new(printer::PrinterManager::new());
    let pm_clone = printer_manager.clone();
    let debug_click_state = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(printer_manager)
        .manage(window::DebugClickState(debug_click_state.clone()))
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            get_shortcuts,
            add_shortcut,
            remove_shortcut,
            open_shortcut,
            open_settings,
            get_settings,
            save_settings,
            get_auto_start,
            set_auto_start,
            get_debug_mode,
            set_debug_mode,
            get_blacklist,
            get_blacklist_enabled,
            set_blacklist_enabled,
            save_blacklist,
            settings::get_theme,
            settings::save_theme,
            window::show_context_menu,
            screenshot::get_area_brightness,
            printer::get_printer_configs,
            printer::get_printer_status,
            printer::get_priority_printer_status,
            printer::get_secondary_printer_status,
            printer::set_printer_configs,
        ])
        .setup(move |app| {
            // Setup main window
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0)));

            if let Ok(Some(monitor)) = window.primary_monitor() {
                let screen = monitor.size();
                let win = window.outer_size().unwrap_or(tauri::PhysicalSize::new(500, 150));
                let x = (screen.width.saturating_sub(win.width)) / 2;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, 0));
            }

            // Setup click-through for transparent areas
            let _ = window::setup_click_through(app, debug_click_state.clone());

            // Setup tray icon
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
            let menu = MenuBuilder::new(app).item(&settings_item).item(&quit_item).build()?;

            let _tray = TrayIconBuilder::new()
                .icon(Image::new_owned(create_tray_icon(), 32, 32))
                .menu(&menu)
                .tooltip("灵动岛")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "quit" => app.exit(0),
                        "settings" => {
                            let _ = settings::open_settings(app.clone());
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Start printer monitoring
            let app_handle_clone = app.handle().clone();
            pm_clone.start_monitoring(app_handle_clone);

            // Start blacklist monitoring
            {
                let hwnd = window.hwnd().unwrap();
                let hwnd_val = hwnd.0 as usize;
                let settings = settings::load_settings_from_file();
                let blacklist_processes = Arc::new(std::sync::Mutex::new(
                    settings.blacklist_processes.iter().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()).collect::<Vec<String>>()
                ));
                let blacklist_enabled = Arc::new(AtomicBool::new(settings.blacklist_enabled));

                // Fullscreen scan thread
                {
                    let blacklist = blacklist_processes.clone();
                    let bl_enabled = blacklist_enabled.clone();
                    thread::spawn(move || {
                        loop {
                            thread::sleep(Duration::from_secs(3));
                            // Re-read settings
                            let settings = settings::load_settings_from_file();
                            bl_enabled.store(settings.blacklist_enabled, Ordering::Relaxed);
                            *blacklist.lock().unwrap() = settings.blacklist_processes;
                        }
                    });
                }

                // Foreground process monitor thread
                {
                    let blacklist = blacklist_processes.clone();
                    let bl_enabled = blacklist_enabled.clone();
                    thread::spawn(move || {
                        let hwnd = HWND(hwnd_val as *mut _);
                        let mut hidden = false;
                        loop {
                            thread::sleep(Duration::from_millis(200));
                            // Re-read settings periodically
                            if hidden || !bl_enabled.load(Ordering::Relaxed) {
                                let settings = settings::load_settings_from_file();
                                bl_enabled.store(settings.blacklist_enabled, Ordering::Relaxed);
                                *blacklist.lock().unwrap() = settings.blacklist_processes;
                            }
                            if !bl_enabled.load(Ordering::Relaxed) {
                                if hidden {
                                    unsafe { let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE); }
                                    hidden = false;
                                }
                                continue;
                            }
                            let list = blacklist.lock().unwrap().clone();
                            if list.is_empty() {
                                if hidden {
                                    unsafe { let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE); }
                                    hidden = false;
                                }
                                continue;
                            }
                            let fg_match = window::get_foreground_process_name()
                                .map(|n| list.iter().any(|b| *b == n))
                                .unwrap_or(false);
                            if fg_match && !hidden {
                                unsafe { let _ = ShowWindow(hwnd, SW_HIDE); }
                                hidden = true;
                            } else if !fg_match && hidden {
                                unsafe { let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE); }
                                hidden = false;
                            }
                        }
                    });
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
