use std::sync::mpsc;
use windows::Win32::Foundation::HMODULE;
use windows::Win32::Graphics::Direct3D::*;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::*;
use windows::Win32::Graphics::Dxgi::*;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
use windows_core::Interface;

struct DxgiCapture {
    duplication: IDXGIOutputDuplication,
    staging: ID3D11Texture2D,
    device: ID3D11Device,
    desk_w: u32,
    desk_h: u32,
}

fn init_dxgi() -> windows::core::Result<DxgiCapture> {
    unsafe {
        let mut device: Option<ID3D11Device> = None;
        D3D11CreateDevice(
            None::<&IDXGIAdapter>,
            D3D_DRIVER_TYPE_HARDWARE,
            HMODULE(std::ptr::null_mut()),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            Some(&[D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_1, D3D_FEATURE_LEVEL_10_0]),
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            None,
        )?;
        let device = device.ok_or(windows::core::Error::from_hresult(windows::core::HRESULT(0x80004005u32 as i32)))?;

        let factory: IDXGIFactory1 = CreateDXGIFactory1()?;
        let adapter: IDXGIAdapter = factory.EnumAdapters1(0)?.into();

        let output_idx = 0u32;
        let output: IDXGIOutput = loop {
            match adapter.EnumOutputs(output_idx) {
                Ok(o) => break o,
                Err(_) => return Err(windows::core::Error::from_hresult(windows::core::HRESULT(0x80004005u32 as i32))),
            }
        };

        let output1: IDXGIOutput1 = output.cast()?;
        let desc = output.GetDesc()?;
        let desk_w = (desc.DesktopCoordinates.right - desc.DesktopCoordinates.left) as u32;
        let desk_h = (desc.DesktopCoordinates.bottom - desc.DesktopCoordinates.top) as u32;

        let duplication = output1.DuplicateOutput(&device)?;

        let tex_desc = D3D11_TEXTURE2D_DESC {
            Width: desk_w,
            Height: desk_h,
            MipLevels: 1,
            ArraySize: 1,
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
            Usage: D3D11_USAGE_STAGING,
            BindFlags: 0,
            CPUAccessFlags: D3D11_CPU_ACCESS_READ.0 as u32,
            MiscFlags: 0,
            ..Default::default()
        };
        let mut staging: Option<ID3D11Texture2D> = None;
        device.CreateTexture2D(&tex_desc, None, Some(&mut staging))?;
        let staging = staging.ok_or(windows::core::Error::from_hresult(windows::core::HRESULT(0x80004005u32 as i32)))?;

        Ok(DxgiCapture { duplication, staging, device, desk_w, desk_h })
    }
}

fn capture_frame(cap: &mut DxgiCapture) -> windows::core::Result<(u32, u32, Vec<u8>)> {
    unsafe {
        let mut frame: Option<IDXGIResource> = None;
        let mut info = DXGI_OUTDUPL_FRAME_INFO::default();
        cap.duplication.AcquireNextFrame(100, &mut info, &mut frame)?;
        let frame = frame.ok_or(windows::core::Error::from_hresult(windows::core::HRESULT(0x80004005u32 as i32)))?;

        let tex: ID3D11Texture2D = frame.cast()?;
        let ctx = cap.device.GetImmediateContext()?;
        ctx.CopyResource(&cap.staging, &tex);
        let _ = cap.duplication.ReleaseFrame();

        let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
        ctx.Map(&cap.staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))?;
        let ptr = mapped.pData as *const u8;
        let bytes_per_row = mapped.RowPitch as usize;
        let total = bytes_per_row * cap.desk_h as usize;
        let raw = std::slice::from_raw_parts(ptr, total);
        let mut pixels = Vec::with_capacity((cap.desk_w * cap.desk_h * 4) as usize);
        for row in 0..cap.desk_h as usize {
            let start = row * bytes_per_row;
            let end = start + cap.desk_w as usize * 4;
            pixels.extend_from_slice(&raw[start..end]);
        }
        ctx.Unmap(&cap.staging, 0);

        Ok((cap.desk_w, cap.desk_h, pixels))
    }
}

// ---------------------------------------------------------------------------
// Static channel — JS commands → capture thread
// ---------------------------------------------------------------------------

struct CaptureReq {
    _x: i32, _y: i32, _w: u32, _h: u32,
    reply: mpsc::Sender<CaptureRes>,
}

struct CaptureRes {
    _w: u32, _h: u32, pixels: Vec<u8>,
}

static CAPTURE_TX: std::sync::OnceLock<mpsc::Sender<CaptureReq>> =
    std::sync::OnceLock::new();

fn get_capture_tx() -> &'static mpsc::Sender<CaptureReq> {
    CAPTURE_TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<CaptureReq>();
        std::thread::Builder::new()
            .name("dxgi-capture".into())
            .spawn(move || {
                unsafe { let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED); }

                let mut cap = None::<DxgiCapture>;

                for req in rx {
                    if cap.is_none() {
                        match init_dxgi() {
                            Ok(c) => cap = Some(c),
                            Err(e) => {
                                eprintln!("[DXGI] init failed: {e}");
                                let _ = req.reply.send(CaptureRes { _w: 0, _h: 0, pixels: vec![] });
                                std::thread::sleep(std::time::Duration::from_secs(3));
                                continue;
                            }
                        }
                    }
                    let c = cap.as_mut().unwrap();
                    match capture_frame(c) {
                        Ok((w, h, px)) => {
                            let _ = req.reply.send(CaptureRes { _w: w, _h: h, pixels: px });
                        }
                        Err(e) => {
                            eprintln!("[DXGI] frame error: {e}, reinitializing");
                            cap = None;
                            let _ = req.reply.send(CaptureRes { _w: 0, _h: 0, pixels: vec![] });
                        }
                    }
                }
            })
            .expect("spawn dxgi-capture thread");
        tx
    })
}

// ---------------------------------------------------------------------------
// Public capture function (called from tauri command)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn capture_screen(
    _x: i32, _y: i32, _w: u32, _h: u32,
) -> std::result::Result<Vec<u8>, String> {
    let (reply_tx, reply_rx) = mpsc::channel();
    get_capture_tx()
        .send(CaptureReq { _x, _y, _w, _h, reply: reply_tx })
        .map_err(|e| format!("capture channel send: {e}"))?;
    let res = reply_rx
        .recv()
        .map_err(|e| format!("capture channel recv: {e}"))?;
    Ok(res.pixels)
}
