use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::UI::WindowsAndMessaging::{GetDesktopWindow, GetWindowRect};

/// Capture the desktop top strip as RGBA pixels + width/height header
#[tauri::command]
pub fn capture_screen() -> Result<Vec<u8>, String> {
    unsafe {
        let desktop = GetDesktopWindow();
        let hdc_desktop = GetWindowDC(Some(desktop));

        let mut win_rect = RECT::default();
        let _ = GetWindowRect(desktop, &mut win_rect);
        let screen_w = (win_rect.right - win_rect.left) as i32;
        let screen_h = (win_rect.bottom - win_rect.top) as i32;

        let capture_h = 150.min(screen_h);
        let capture_w = screen_w;

        let hdc_mem = CreateCompatibleDC(Some(hdc_desktop));
        let hbitmap = CreateCompatibleBitmap(hdc_desktop, capture_w, capture_h);
        let _old_bitmap = SelectObject(hdc_mem, hbitmap.into());

        let _ = BitBlt(
            hdc_mem, 0, 0, capture_w, capture_h,
            Some(hdc_desktop), 0, 0, SRCCOPY,
        );

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: capture_w,
                biHeight: -capture_h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0, // BI_RGB = 0
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

        // BGRA -> RGBA
        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        let w_bytes = (capture_w as u32).to_le_bytes();
        let h_bytes = (capture_h as u32).to_le_bytes();
        let mut result = Vec::with_capacity(8 + pixels.len());
        result.extend_from_slice(&w_bytes);
        result.extend_from_slice(&h_bytes);
        result.extend_from_slice(&pixels);

        Ok(result)
    }
}
