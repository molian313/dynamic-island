use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub memory_percent: u32,
    pub net_up_speed: String,
    pub net_down_speed: String,
}
