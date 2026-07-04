use serde::Deserialize;
use windows::Win32::Graphics::Gdi::*;

#[derive(Deserialize)]
pub struct SampleRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

fn sample_luminance(desktop_dc: HDC, x: i32, y: i32, w: i32, h: i32) -> Option<f64> {
    if w <= 0 || h <= 0 {
        return None;
    }

    unsafe {
        let mem_dc = CreateCompatibleDC(Some(desktop_dc));
        let bitmap = CreateCompatibleBitmap(desktop_dc, w, h);
        let old_bmp = SelectObject(mem_dc, bitmap.into());

        let _ = BitBlt(mem_dc, 0, 0, w, h, Some(desktop_dc), x, y, SRCCOPY);

        let mut bmp_info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w as i32,
                biHeight: -h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut pixels: Vec<u32> = vec![0u32; (w * h) as usize];
        let result = GetDIBits(
            mem_dc,
            bitmap,
            0,
            h as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmp_info,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, old_bmp);
        let _ = DeleteObject(bitmap.into());
        let _ = DeleteDC(mem_dc);

        if result == 0 {
            return None;
        }

        let mut total: f64 = 0.0;
        let count = pixels.len() as f64;
        for &pixel in &pixels {
            let b = (pixel & 0xFF) as f64;
            let g = ((pixel >> 8) & 0xFF) as f64;
            let r = ((pixel >> 16) & 0xFF) as f64;
            total += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        Some(total / count / 255.0)
    }
}

#[tauri::command]
pub fn get_area_brightness(rects: Vec<SampleRect>) -> f64 {
    if rects.is_empty() {
        return 0.5;
    }

    unsafe {
        let desktop_dc = GetDC(None);
        if desktop_dc.is_invalid() {
            return 0.5;
        }

        let mut total_lum: f64 = 0.0;
        let mut total_pixels: f64 = 0.0;

        for r in &rects {
            if let Some(lum) = sample_luminance(desktop_dc, r.x, r.y, r.w, r.h) {
                let px = (r.w * r.h) as f64;
                total_lum += lum * px;
                total_pixels += px;
            }
        }

        let _ = ReleaseDC(None, desktop_dc);

        if total_pixels == 0.0 {
            return 0.5;
        }

        let avg = total_lum / total_pixels;
        (avg * 100.0).round() / 100.0
    }
}
