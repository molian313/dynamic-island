use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS, TlsConfiguration, Transport};
use rustls::ClientConfig;
use rustls::client::danger::{ServerCertVerifier, ServerCertVerified, HandshakeSignatureValid};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, Error};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterConfig {
    pub name: String,
    pub ip_address: String,
    pub access_code: String,
    pub serial: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterStatus {
    pub name: String,
    pub status: String,
    pub progress: i32,
    pub remaining_time: i32,
    pub nozzle_temp: f64,
    pub bed_temp: f64,
    pub layer_num: i32,
    pub total_layers: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterEvent {
    pub index: usize,
    pub status: PrinterStatus,
}

pub struct PrinterManager {
    configs: Arc<Mutex<Vec<PrinterConfig>>>,
    statuses: Arc<Mutex<Vec<PrinterStatus>>>,
    config_changed: watch::Sender<bool>,
}

impl PrinterManager {
    pub fn new() -> Self {
        let (tx, _) = watch::channel(false);
        Self {
            configs: Arc::new(Mutex::new(Vec::new())),
            statuses: Arc::new(Mutex::new(Vec::new())),
            config_changed: tx,
        }
    }

    pub fn load_configs(&self) {
        let config_paths = [
            dirs::config_dir().map(|p| p.join("dynamic-island").join("printers_config.json")),
            dirs::desktop_dir().map(|p| p.join("p1s").join("printers_config.json")),
        ];
        for path in config_paths.into_iter().flatten() {
            if path.exists() {
                if let Ok(data) = std::fs::read_to_string(&path) {
                    if let Ok(configs) = serde_json::from_str::<Vec<PrinterConfig>>(&data) {
                        let count = configs.len();
                        *self.configs.lock().unwrap() = configs;
                        *self.statuses.lock().unwrap() = (0..count).map(|_| PrinterStatus {
                            name: String::new(),
                            status: "disconnected".to_string(),
                            progress: 0, remaining_time: 0,
                            nozzle_temp: 0.0, bed_temp: 0.0,
                            layer_num: 0, total_layers: 0,
                        }).collect();
                        return;
                    }
                }
            }
        }
    }

    pub fn save_configs(&self) -> Result<(), String> {
        let config_path = dirs::config_dir()
            .map(|p| p.join("dynamic-island").join("printers_config.json"))
            .ok_or("Failed to get config directory")?;
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let configs = self.configs.lock().unwrap().clone();
        let data = serde_json::to_string_pretty(&configs).map_err(|e| e.to_string())?;
        std::fs::write(&config_path, data).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_configs(&self) -> Vec<PrinterConfig> {
        self.configs.lock().unwrap().clone()
    }

    pub fn get_status(&self, index: usize) -> PrinterStatus {
        let statuses = self.statuses.lock().unwrap();
        statuses.get(index).cloned().unwrap_or(PrinterStatus {
            name: String::new(),
            status: "no_printer".to_string(),
            progress: 0, remaining_time: 0,
            nozzle_temp: 0.0, bed_temp: 0.0,
            layer_num: 0, total_layers: 0,
        })
    }

    pub fn get_priority_status(&self) -> PrinterStatus {
        let statuses = self.statuses.lock().unwrap();
        if statuses.is_empty() {
            return PrinterStatus {
                name: String::new(),
                status: "no_printer".to_string(),
                progress: 0, remaining_time: 0,
                nozzle_temp: 0.0, bed_temp: 0.0,
                layer_num: 0, total_layers: 0,
            };
        }

        // 1. Show printing printer with shortest remaining time
        let printing: Vec<(usize, &PrinterStatus)> = statuses.iter()
            .enumerate()
            .filter(|(_, s)| s.status == "printing")
            .collect();

        if !printing.is_empty() {
            let (_, best) = printing.iter()
                .min_by_key(|(_, s)| s.remaining_time)
                .unwrap();
            return (*best).clone();
        }

        // 2. No printing, show first completed one
        let completed: Vec<&PrinterStatus> = statuses.iter()
            .filter(|s| s.status == "completed")
            .collect();

        if !completed.is_empty() {
            return completed[0].clone();
        }

        // 3. No completed, show first printer
        statuses[0].clone()
    }

    fn find_priority_index(statuses: &[PrinterStatus]) -> Option<usize> {
        let printing: Vec<(usize, &PrinterStatus)> = statuses.iter()
            .enumerate()
            .filter(|(_, s)| s.status == "printing")
            .collect();

        if !printing.is_empty() {
            return printing.iter().min_by_key(|(_, s)| s.remaining_time).map(|(i, _)| *i);
        }

        let completed: Vec<(usize, &PrinterStatus)> = statuses.iter()
            .enumerate()
            .filter(|(_, s)| s.status == "completed")
            .collect();

        if !completed.is_empty() {
            return Some(completed[0].0);
        }

        Some(0)
    }

    pub fn get_secondary_status(&self) -> PrinterStatus {
        let statuses = self.statuses.lock().unwrap();
        if statuses.len() < 2 {
            return PrinterStatus {
                name: String::new(),
                status: "no_printer".to_string(),
                progress: 0, remaining_time: 0,
                nozzle_temp: 0.0, bed_temp: 0.0,
                layer_num: 0, total_layers: 0,
            };
        }

        let priority_idx = Self::find_priority_index(&statuses);

        // 1. If two+ printing, show the second shortest remaining time
        let printing: Vec<(usize, &PrinterStatus)> = statuses.iter()
            .enumerate()
            .filter(|(_, s)| s.status == "printing")
            .collect();

        if printing.len() >= 2 {
            let mut sorted = printing;
            sorted.sort_by_key(|(_, s)| s.remaining_time);
            return sorted[1].1.clone();
        }

        // 2. If one printing, show the non-printing one (excluding priority)
        if printing.len() == 1 {
            let printing_idx = printing[0].0;
            for (i, s) in statuses.iter().enumerate() {
                if i != printing_idx {
                    return s.clone();
                }
            }
        }

        // 3. No printing: return any device that is NOT the priority one
        if let Some(pri) = priority_idx {
            for (i, s) in statuses.iter().enumerate() {
                if i != pri {
                    return s.clone();
                }
            }
        }

        statuses[1].clone()
    }

    pub fn update_status(&self, index: usize, status: PrinterStatus) {
        let mut statuses = self.statuses.lock().unwrap();
        if index < statuses.len() {
            statuses[index] = status;
        }
    }

    pub fn start_monitoring(self: Arc<Self>, app: AppHandle) {
        let manager = self.clone();
        std::thread::Builder::new()
            .name("printer-mqtt".into())
            .spawn(move || {
                manager.load_configs();
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(manager.clone().mqtt_loop(app));
            })
            .ok();
    }

    fn subscribe_config_changed(&self) -> watch::Receiver<bool> {
        self.config_changed.subscribe()
    }

    async fn mqtt_loop(self: Arc<Self>, app: AppHandle) {
        let mut config_rx = self.subscribe_config_changed();
        loop {
            let configs = self.get_configs();
            if configs.is_empty() {
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_secs(3)) => {}
                    _ = config_rx.changed() => { let _ = config_rx.borrow_and_update(); }
                }
                continue;
            }

            // Monitor all printers concurrently
            let mut handles = Vec::new();
            for (i, config) in configs.iter().enumerate() {
                let config = config.clone();
                let app = app.clone();
                let manager = self.clone();
                let mut cfg_rx = self.subscribe_config_changed();
                handles.push(tokio::spawn(async move {
                    tokio::select! {
                        result = manager.clone().connect_and_monitor(i, &config, &app) => {
                            match result {
                                Ok(_) => {}
                                Err(_e) => {
                                    let status = PrinterStatus {
                                        name: config.name.clone(),
                                        status: "disconnected".to_string(),
                                        progress: 0, remaining_time: 0,
                                        nozzle_temp: 0.0, bed_temp: 0.0,
                                        layer_num: 0, total_layers: 0,
                                    };
                                    manager.update_status(i, status.clone());
                                    let _ = app.emit("printer-status", PrinterEvent { index: i, status });
                                }
                            }
                        }
                        _ = cfg_rx.changed() => {}
                    }
                }));
            }

            // Wait for all to finish or config change
            tokio::select! {
                _ = async {
                    for handle in handles {
                        let _ = handle.await;
                    }
                } => {}
                _ = config_rx.changed() => {
                    let _ = config_rx.borrow_and_update();
                    // Abort all running tasks
                }
            }

            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }

    async fn connect_and_monitor(self: Arc<Self>, index: usize, config: &PrinterConfig, app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        let mut opts = MqttOptions::new(&config.serial, &config.ip_address, 8883);
        opts.set_credentials("bblp", &config.access_code);
        opts.set_keep_alive(Duration::from_secs(30));

        let tls = ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(SkipCertVerifier))
            .with_no_client_auth();
        opts.set_transport(Transport::Tls(TlsConfiguration::Rustls(Arc::new(tls))));

        let (client, mut eventloop) = AsyncClient::new(opts, 100);
        let report_topic = format!("device/{}/report", config.serial);
        let request_topic = format!("device/{}/request", config.serial);

        client.subscribe(&report_topic, QoS::AtMostOnce).await?;
        client.publish(&request_topic, QoS::AtMostOnce, false,
            serde_json::json!({"pushing":{"command":"pushall"},"info":{"command":"get_version"}}).to_string().as_bytes()
        ).await?;

        let mut print_data: serde_json::Value = serde_json::json!({});

        loop {
            match eventloop.poll().await {
                Ok(Event::Incoming(Packet::Publish(publish))) => {
                    if let Ok(payload) = std::str::from_utf8(&publish.payload) {
                        if let Ok(doc) = serde_json::from_str::<serde_json::Value>(payload) {
                            if let Some(print_obj) = doc.get("print").and_then(|v| v.as_object()) {
                                let entry = print_data.as_object_mut().unwrap();
                                for (k, v) in print_obj { entry.insert(k.clone(), v.clone()); }
                            }
                            let status_str = match print_data.get("gcode_state").and_then(|v| v.as_str()).unwrap_or("UNKNOWN") {
                                "RUNNING" => "printing", "PAUSE" => "paused",
                                "FINISH" => "completed", "FAILED" => "failed",
                                "IDLE" => "idle", _ => "unknown",
                            };
                            let status = PrinterStatus {
                                name: config.name.clone(),
                                status: status_str.to_string(),
                                progress: print_data.get("mc_percent").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                                remaining_time: print_data.get("mc_remaining_time").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                                nozzle_temp: print_data.get("nozzle_temper").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                bed_temp: print_data.get("bed_temper").and_then(|v| v.as_f64()).unwrap_or(0.0),
                                layer_num: print_data.get("layer_num").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                                total_layers: print_data.get("total_layer_num").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                            };
                            self.update_status(index, status.clone());
                            let _ = app.emit("printer-status", PrinterEvent { index, status });
                        }
                    }
                }
                Ok(Event::Incoming(Packet::Disconnect)) => return Err("Disconnected".into()),
                Err(e) => return Err(Box::new(e)),
                _ => {}
            }
        }
    }
}

#[derive(Debug)]
struct SkipCertVerifier;

impl ServerCertVerifier for SkipCertVerifier {
    fn verify_server_cert(&self, _end_entity: &CertificateDer<'_>, _intermediates: &[CertificateDer<'_>], _server_name: &ServerName<'_>, _ocsp_response: &[u8], _now: UnixTime) -> Result<ServerCertVerified, Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(&self, _message: &[u8], _cert: &CertificateDer<'_>, _dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(&self, _message: &[u8], _cert: &CertificateDer<'_>, _dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            rustls::SignatureScheme::ED25519,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
        ]
    }
}

#[tauri::command]
pub fn get_printer_configs(manager: tauri::State<'_, Arc<PrinterManager>>) -> Vec<PrinterConfig> {
    manager.get_configs()
}

#[tauri::command]
pub fn get_printer_status(manager: tauri::State<'_, Arc<PrinterManager>>, index: usize) -> PrinterStatus {
    manager.get_status(index)
}

#[tauri::command]
pub fn get_priority_printer_status(manager: tauri::State<'_, Arc<PrinterManager>>) -> PrinterStatus {
    manager.get_priority_status()
}

#[tauri::command]
pub fn get_secondary_printer_status(manager: tauri::State<'_, Arc<PrinterManager>>) -> PrinterStatus {
    manager.get_secondary_status()
}

#[tauri::command]
pub fn set_printer_configs(manager: tauri::State<'_, Arc<PrinterManager>>, app: AppHandle, configs: Vec<PrinterConfig>) -> Result<(), String> {
    let count = configs.len();
    *manager.configs.lock().unwrap() = configs;
    let mut statuses = manager.statuses.lock().unwrap();
    statuses.truncate(count);
    while statuses.len() < count {
        statuses.push(PrinterStatus {
            name: String::new(),
            status: "no_printer".to_string(),
            progress: 0, remaining_time: 0,
            nozzle_temp: 0.0, bed_temp: 0.0,
            layer_num: 0, total_layers: 0,
        });
    }
    drop(statuses);
    manager.save_configs()?;
    let _ = manager.config_changed.send(true);
    let _ = app.emit("printer-configs-changed", ());
    Ok(())
}
