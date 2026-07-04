use base64::Engine;
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::UI::WindowsAndMessaging::{GetDesktopWindow, GetWindowRect};

#[tauri::command]
pub fn capture_screen(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    unsafe {
        let desktop = GetDesktopWindow();
        let hdc_desktop = GetWindowDC(Some(desktop));

        let mut win_rect = RECT::default();
        let _ = GetWindowRect(desktop, &mut win_rect);
        let screen_w = (win_rect.right - win_rect.left) as i32;
        let screen_h = (win_rect.bottom - win_rect.top) as i32;

        let capture_h = (height as i32).min(screen_h);
        let capture_w = (width as i32).min(screen_w);
        let src_x = x.max(0).min(screen_w - capture_w);
        let src_y = y.max(0).min(screen_h - capture_h);

        let hdc_mem = CreateCompatibleDC(Some(hdc_desktop));
        if hdc_mem.0.is_null() {
            ReleaseDC(Some(desktop), hdc_desktop);
            return Err("CreateCompatibleDC failed".into());
        }

        let hbitmap = CreateCompatibleBitmap(hdc_desktop, capture_w, capture_h);
        if hbitmap.0.is_null() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(Some(desktop), hdc_desktop);
            return Err("CreateCompatibleBitmap failed".into());
        }

        let _old_bitmap = SelectObject(hdc_mem, hbitmap.into());

        let _ = BitBlt(
            hdc_mem, 0, 0, capture_w, capture_h,
            Some(hdc_desktop), src_x, src_y, SRCCOPY,
        );

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: capture_w,
                biHeight: -capture_h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut pixels = vec![0u8; (capture_w * capture_h * 4) as usize];
        let _ = GetDIBits(
            hdc_mem, hbitmap, 0, capture_h as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi, DIB_RGB_COLORS,
        );

        let _ = SelectObject(hdc_mem, _old_bitmap);
        let _ = DeleteObject(hbitmap.into());
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(Some(desktop), hdc_desktop);

        // BGRA → RGB (丢弃 Alpha，JPEG 不需要)
        // 同时翻转行（top-down → bottom-up for WebGL）
        let w = capture_w as usize;
        let h = capture_h as usize;
        let mut rgb = vec![0u8; w * h * 3];
        for row in 0..h {
            let src_row = h - 1 - row;
            for col in 0..w {
                let src_idx = (src_row * w + col) * 4;
                let dst_idx = (row * w + col) * 3;
                rgb[dst_idx] = pixels[src_idx + 2];     // R (from BGRA)
                rgb[dst_idx + 1] = pixels[src_idx + 1]; // G
                rgb[dst_idx + 2] = pixels[src_idx];     // B (from BGRA)
            }
        }

        // 用 turbojpeg 编码（比 image crate 快 5-10 倍）
        let image = turbojpeg::Image {
            pixels: rgb.as_slice(),
            width: w,
            height: h,
            pitch: w * 3,
            format: turbojpeg::PixelFormat::RGB,
        };
        let jpeg_buf = turbojpeg::compress(image, 75, turbojpeg::Subsamp::Sub2x2)
            .map_err(|e| format!("turbojpeg compress error: {}", e))?;

        Ok(base64::engine::general_purpose::STANDARD.encode(&jpeg_buf))
    }
}
