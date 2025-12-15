use tauri::{
    Manager, WebviewWindow
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;

const WEBSITE_URL: &str = "https://accounted.th3void.com";

/// Network connectivity status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub is_online: bool,
    pub can_reach_website: bool,
}

/// Data fetch result with source information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchResult {
    pub data: serde_json::Value,
    pub source: String, // "online" or "local"
    pub timestamp: i64,
}

#[tauri::command]
async fn retry_connection(window: WebviewWindow) -> Result<(), String> {
    window.eval(&format!("window.location.href = '{}'", WEBSITE_URL))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_network_status() -> Result<NetworkStatus, String> {
    let is_online = check_internet_connectivity().await;
    let can_reach_website = if is_online {
        check_website_connectivity().await
    } else {
        false
    };

    Ok(NetworkStatus {
        is_online,
        can_reach_website,
    })
}

async fn check_internet_connectivity() -> bool {
    let test_urls = vec![
        "https://www.google.com",
        "https://1.1.1.1",
        "https://8.8.8.8",
    ];

    for url in test_urls {
        if let Ok(client) = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
        {
            if client.get(url).send().await.is_ok() {
                return true;
            }
        }
    }

    false
}

async fn check_website_connectivity() -> bool {
    if let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        if client.get(WEBSITE_URL).send().await.is_ok() {
            return true;
        }
    }

    false
}

fn get_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;

    Ok(app_data_dir)
}

fn get_data_file_path(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
    let data_dir = get_data_dir(app)?;
    Ok(data_dir.join(format!("{}.json", key)))
}

#[tauri::command]
async fn save_local_data(
    app: AppHandle,
    key: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let file_path = get_data_file_path(&app, &key)?;

    let data_with_timestamp = serde_json::json!({
        "data": data,
        "timestamp": chrono::Utc::now().timestamp(),
    });

    let json_string = serde_json::to_string_pretty(&data_with_timestamp)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;

    std::fs::write(&file_path, json_string)
        .map_err(|e| format!("Failed to write data file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn load_local_data(
    app: AppHandle,
    key: String,
) -> Result<Option<FetchResult>, String> {
    let file_path = get_data_file_path(&app, &key)?;

    if !file_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read data file: {}", e))?;

    let parsed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse data file: {}", e))?;

    let timestamp = parsed
        .get("timestamp")
        .and_then(|t| t.as_i64())
        .unwrap_or(0);

    let data = parsed
        .get("data")
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    Ok(Some(FetchResult {
        data,
        source: "local".to_string(),
        timestamp,
    }))
}

#[tauri::command]
async fn fetch_data_with_fallback(
    app: AppHandle,
    key: String,
    url: String,
    headers: Option<HashMap<String, String>>,
) -> Result<FetchResult, String> {
    let network_status = check_network_status().await?;

    if network_status.can_reach_website {
        match fetch_online_data(&url, headers).await {
            Ok(online_data) => {
                if let Err(e) = save_local_data(app.clone(), key.clone(), online_data.clone()).await
                {
                    eprintln!("Warning: Failed to save data locally: {}", e);
                }

                return Ok(FetchResult {
                    data: online_data,
                    source: "online".to_string(),
                    timestamp: chrono::Utc::now().timestamp(),
                });
            }
            Err(e) => {
                eprintln!("Failed to fetch online data: {}", e);
            }
        }
    }

    match load_local_data(app, key).await {
        Ok(Some(local_data)) => Ok(local_data),
        Ok(None) => Err("No data available online or locally".to_string()),
        Err(e) => Err(format!("Failed to load local data: {}", e)),
    }
}

async fn fetch_online_data(
    url: &str,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut request = client.get(url);

    if let Some(headers_map) = headers {
        for (key, value) in headers_map {
            request = request.header(&key, &value);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP error: {} - {}",
            response.status(),
            response.status().canonical_reason().unwrap_or("Unknown")
        ));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    Ok(json)
}

#[tauri::command]
async fn force_refresh_data(
    app: AppHandle,
    key: String,
    url: String,
    headers: Option<HashMap<String, String>>,
) -> Result<FetchResult, String> {
    let network_status = check_network_status().await?;

    if !network_status.can_reach_website {
        return Err("Cannot reach website. Please check your internet connection.".to_string());
    }

    let online_data = fetch_online_data(&url, headers).await?;

    save_local_data(app.clone(), key.clone(), online_data.clone()).await?;

    Ok(FetchResult {
        data: online_data,
        source: "online".to_string(),
        timestamp: chrono::Utc::now().timestamp(),
    })
}

#[tauri::command]
async fn clear_local_cache(app: AppHandle, key: Option<String>) -> Result<(), String> {
    let data_dir = get_data_dir(&app)?;

    if let Some(specific_key) = key {
        let file_path = get_data_file_path(&app, &specific_key)?;
        if file_path.exists() {
            std::fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to remove data file: {}", e))?;
        }
    } else {
        let entries = std::fs::read_dir(&data_dir)
            .map_err(|e| format!("Failed to read data directory: {}", e))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Err(e) = std::fs::remove_file(&path) {
                        eprintln!("Warning: Failed to remove file {:?}: {}", path, e);
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_cache_info(app: AppHandle) -> Result<HashMap<String, i64>, String> {
    let data_dir = get_data_dir(&app)?;
    let mut cache_info = HashMap::new();

    let entries = std::fs::read_dir(&data_dir)
        .map_err(|e| format!("Failed to read data directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_name) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(timestamp) = parsed.get("timestamp").and_then(|t| t.as_i64()) {
                                cache_info.insert(file_name.to_string(), timestamp);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(cache_info)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();

            #[cfg(desktop)]
            {
                main_window.eval(r#"
                    // Disable default context menu
                    document.addEventListener('contextmenu', function(e) {
                        e.preventDefault();

                        // Create custom context menu
                        const contextMenu = document.createElement('div');
                        contextMenu.id = 'custom-context-menu';
                        contextMenu.style.cssText = `
                            position: fixed;
                            top: ${e.clientY}px;
                            left: ${e.clientX}px;
                            background: #2d2d2d;
                            border: 1px solid #555;
                            border-radius: 6px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            z-index: 10000;
                            min-width: 150px;
                            padding: 4px 0;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        `;

                        const items = [
                            { text: '⬅️ Back', action: () => window.history.back() },
                            { text: '🔄 Refresh', action: () => window.location.href = 'https://accounted.th3void.com' },
                            { text: 'ℹ️ About', action: () => {
                                const currentYear = new Date().getFullYear();
                                const aboutMessage = `Lotus Routine - Your Accountability Hub\nTrack your progress, compete with friends, and build lasting habits.\nVersion: 1.0.0\n© ${currentYear} th3void. All rights reserved.`;
                                alert(aboutMessage);
                            }},

                        ];

                        items.forEach(item => {
                            const menuItem = document.createElement('div');
                            menuItem.textContent = item.text;
                            menuItem.style.cssText = `
                                padding: 8px 16px;
                                cursor: pointer;
                                color: #ffffff;
                                font-size: 14px;
                                transition: background-color 0.2s;
                            `;

                            menuItem.addEventListener('mouseenter', () => {
                                menuItem.style.backgroundColor = '#404040';
                            });

                            menuItem.addEventListener('mouseleave', () => {
                                menuItem.style.backgroundColor = 'transparent';
                            });

                            menuItem.addEventListener('click', () => {
                                try {
                                    item.action();
                                    contextMenu.remove();
                                } catch (error) {
                                    console.error('Menu action error:', error);
                                    contextMenu.remove();
                                }
                            });

                            contextMenu.appendChild(menuItem);
                        });

                        // Remove existing context menu
                        const existing = document.getElementById('custom-context-menu');
                        if (existing) existing.remove();

                        // Add to document
                        document.body.appendChild(contextMenu);

                        // Close on click outside
                        const closeMenu = (e) => {
                            if (!contextMenu.contains(e.target)) {
                                contextMenu.remove();
                                document.removeEventListener('click', closeMenu);
                            }
                        };

                        setTimeout(() => {
                            document.addEventListener('click', closeMenu);
                        }, 100);
                    });
                "#)?;
            }


            #[cfg(mobile)]
            {
                use tauri::WindowEvent;
                let window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let WindowEvent::Resized(_) = event {
                        let _ = window_clone.eval(r#"
                            // Apply safe area insets for mobile devices
                            const style = document.getElementById('safe-area-style');
                            if (style) style.remove();

                            const safeStyle = document.createElement('style');
                            safeStyle.id = 'safe-area-style';
                            safeStyle.textContent = `
                                :root {
                                    --safe-area-inset-top: env(safe-area-inset-top);
                                    --safe-area-inset-bottom: env(safe-area-inset-bottom);
                                    --safe-area-inset-left: env(safe-area-inset-left);
                                    --safe-area-inset-right: env(safe-area-inset-right);
                                }

                                body {
                                    padding-top: max(var(--safe-area-inset-top), 0px);
                                    padding-bottom: max(var(--safe-area-inset-bottom), 0px);
                                    padding-left: max(var(--safe-area-inset-left), 0px);
                                    padding-right: max(var(--safe-area-inset-right), 0px);
                                }
                            `;
                            document.head.appendChild(safeStyle);
                        "#);
                    }
                });

                // Add mobile-specific print handling using iframe approach
                let _ = main_window.eval(r#"
                    // Override window.open for mobile to use iframe printing instead
                    const originalWindowOpen = window.open;
                    window.open = function(url, name, specs) {
                        if (name === '' && specs === 'height=500, width=500') {
                            // Use iframe approach like the Barcode component
                            const printFrame = document.createElement('iframe');
                            printFrame.style.display = 'none';
                            document.body.appendChild(printFrame);

                            // Create a mock window object that uses iframe
                            const mockWindow = {
                                document: {
                                    write: function(content) {
                                        printFrame.contentDocument.body.innerHTML = content;
                                    },
                                    close: function() {
                                        document.body.removeChild(printFrame);
                                    }
                                },
                                print: function() {
                                    printFrame.contentWindow.print();
                                    // Clean up after a short delay
                                    setTimeout(() => {
                                        if (printFrame.parentNode) {
                                            document.body.removeChild(printFrame);
                                        }
                                    }, 1000);
                                },
                                closed: false,
                                close: function() {
                                    this.closed = true;
                                    if (printFrame.parentNode) {
                                        document.body.removeChild(printFrame);
                                    }
                                }
                            };

                            return mockWindow;
                        }
                        return originalWindowOpen.call(this, url, name, specs);
                    };
                "#);
            }

            Ok(())
        })
        .on_page_load(|window, _| {
            let css = r#"
                ::-webkit-scrollbar {
                    display: none !important;
                }
                * {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                :root {
                    --safe-area-inset-top: env(safe-area-inset-top);
                    --safe-area-inset-bottom: env(safe-area-inset-bottom);
                    --safe-area-inset-left: env(safe-area-inset-left);
                    --safe-area-inset-right: env(safe-area-inset-right);
                }

                body {
                    padding-top: max(var(--safe-area-inset-top), 0px) !important;
                    padding-bottom: max(var(--safe-area-inset-bottom), 0px) !important;
                    padding-left: 0 !important;
                    padding-right: max(var(--safe-area-inset-right), 0px) !important;
                }

                /* Ensure sidebar is visible and properly positioned */
                [data-sidebar="sidebar"] {
                    z-index: 50 !important;
                    position: fixed !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }

                /* Fix sidebar positioning - sidebar should not be affected by body padding */
                .group.peer[data-side="left"] > div[data-sidebar="sidebar"],
                .group.peer[data-side="left"] > div.fixed {
                    top: 0 !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    height: 100vh !important;
                }

                /* Ensure sidebar content is visible */
                [data-sidebar="sidebar"] * {
                    visibility: visible !important;
                }

                /* Fix for sidebar wrapper - don't let body padding affect it */
                .group\/sidebar-wrapper {
                    position: relative !important;
                    padding-left: 0 !important;
                }

                /* Ensure main content accounts for sidebar but not body padding */
                main[class*="md:ml-"] {
                    margin-left: var(--sidebar-width, 16rem) !important;
                }
            "#;

            let _ = window.eval(&format!(
                r#"
                const style = document.createElement('style');
                style.id = 'tauri-sidebar-fix';
                style.textContent = `{} `;
                document.head.appendChild(style);
                "#,
                css
            ));
        })
        .invoke_handler(tauri::generate_handler![
            retry_connection,
            check_network_status,
            save_local_data,
            load_local_data,
            fetch_data_with_fallback,
            force_refresh_data,
            clear_local_cache,
            get_cache_info,
        ])
        .run(context)
        .expect("error while running Lotus Routine application");
}
