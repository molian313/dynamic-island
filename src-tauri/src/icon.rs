use std::path::PathBuf;

#[cfg(target_os = "windows")]
pub fn get_file_icon_data_url(path: &str) -> Option<String> {
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::UI::Shell::{SHCreateItemFromParsingName, IShellItemImageFactory, SIIGBF_THUMBNAILONLY};
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let path_buf = PathBuf::from(path);
    if !path_buf.exists() {
        return None;
    }

    let wide_path: Vec<u16> = OsStr::new(path).encode_wide().chain(Some(0)).collect();

    unsafe {
        let shell_item: windows::core::IUnknown = SHCreateItemFromParsingName(
            PCWSTR(wide_path.as_ptr()),
            None,
        ).ok()?;

        let factory: IShellItemImageFactory = shell_item.cast().ok()?;

        let size = windows::Win32::Foundation::SIZE { cx: 64, cy: 64 };
        let hbitmap = factory.GetImage(size, SIIGBF_THUMBNAILONLY).ok()?;

        use windows::Win32::Graphics::Gdi::{
            CreateCompatibleDC, SelectObject,
            DeleteDC, DeleteObject, GetDIBits, GetDC, ReleaseDC,
            BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS,
        };
        use windows::Win32::Foundation::HWND;

        let hdc_screen = GetDC(Some(HWND::default()));
        if hdc_screen.is_invalid() {
            let _ = DeleteObject(hbitmap.into());
            return None;
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
        let old_bmp = SelectObject(hdc_mem, hbitmap.into());

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: 64,
                biHeight: -64,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                ..Default::default()
            },
            ..Default::default()
        };

        let buf_len = (64 * 64 * 4) as usize;
        let mut pixels: Vec<u8> = vec![0u8; buf_len];

        let copied = GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            64,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        let _ = SelectObject(hdc_mem, old_bmp);
        let _ = DeleteObject(hbitmap.into());
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(Some(HWND::default()), hdc_screen);

        if copied == 0 {
            return None;
        }

        let mut rgba = vec![0u8; buf_len];
        for i in 0..(64 * 64) {
            let o = i * 4;
            rgba[o]     = pixels[o + 2];
            rgba[o + 1] = pixels[o + 1];
            rgba[o + 2] = pixels[o];
            rgba[o + 3] = pixels[o + 3];
        }

        let mut png_buf = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut png_buf, 64, 64);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            if let Ok(mut w) = enc.write_header() {
                let _ = w.write_image_data(&rgba);
            } else {
                return None;
            }
        }

        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_buf);
        Some(format!("data:image/png;base64,{}", b64))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_file_icon_data_url(_path: &str) -> Option<String> {
    None
}
