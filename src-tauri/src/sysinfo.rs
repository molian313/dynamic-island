use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows::Win32::NetworkManagement::IpHelper::{GetIfTable, MIB_IFTABLE};

use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::SystemStats;

// Track previous values for speed calculation
static mut PREV_BYTES_UP: u64 = 0;
static mut PREV_BYTES_DOWN: u64 = 0;
static mut PREV_TIMESTAMP: u64 = 0;

#[tauri::command]
pub fn get_system_stats() -> SystemStats {
    let memory_percent = get_memory_percent();
    let (up, down) = get_network_speed();

    SystemStats {
        memory_percent,
        net_up_speed: format_speed(up),
        net_down_speed: format_speed(down),
    }
}

fn get_memory_percent() -> u32 {
    unsafe {
        let mut mem: MEMORYSTATUSEX = std::mem::zeroed();
        mem.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        if GlobalMemoryStatusEx(&mut mem).is_ok() {
            mem.dwMemoryLoad
        } else {
            0
        }
    }
}

fn get_network_speed() -> (u64, u64) {
    unsafe {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Get required buffer size
        let mut bytes_needed: u32 = 0;
        let _ = GetIfTable(None, &mut bytes_needed, false);

        if bytes_needed == 0 {
            return (0, 0);
        }

        let mut buf: Vec<u8> = vec![0u8; bytes_needed as usize];
        let table = buf.as_mut_ptr() as *mut MIB_IFTABLE;

        if GetIfTable(Some(table), &mut bytes_needed, false) != 0 {
            return (0, 0);
        }

        let num_entries = (*table).dwNumEntries;
        let mut total_bytes_up: u64 = 0;
        let mut total_bytes_down: u64 = 0;

        // MIB_IFTABLE.table is [MIB_IFROW; 1] — use from_raw_parts to get the full slice
        let entries =
            std::slice::from_raw_parts((*table).table.as_ptr(), num_entries as usize);
        for entry in entries {
            total_bytes_up += entry.dwOutOctets as u64;
            total_bytes_down += entry.dwInOctets as u64;
        }

        let prev_up = PREV_BYTES_UP;
        let prev_down = PREV_BYTES_DOWN;
        let prev_ts = PREV_TIMESTAMP;

        PREV_BYTES_UP = total_bytes_up;
        PREV_BYTES_DOWN = total_bytes_down;
        PREV_TIMESTAMP = now;

        if prev_ts == 0 || now <= prev_ts {
            return (0, 0);
        }

        let duration = now - prev_ts;
        let speed_up = if total_bytes_up >= prev_up {
            (total_bytes_up - prev_up) / duration
        } else {
            0
        };
        let speed_down = if total_bytes_down >= prev_down {
            (total_bytes_down - prev_down) / duration
        } else {
            0
        };

        (speed_up, speed_down)
    }
}

fn format_speed(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B/s", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB/s", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB/s", bytes as f64 / (1024.0 * 1024.0))
    }
}
