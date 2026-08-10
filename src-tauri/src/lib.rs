use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum TreeEntry {
  Folder {
    name: String,
    path: String,
    children: Vec<TreeEntry>,
  },
  Note {
    name: String,
    path: String,
  },
}

fn build_tree(dir: &Path) -> std::io::Result<Vec<TreeEntry>> {
  let mut dir_entries: Vec<_> = fs::read_dir(dir)?.filter_map(|e| e.ok()).collect();
  dir_entries.sort_by_key(|e| e.file_name());

  let mut entries = Vec::new();
  for entry in dir_entries {
    let path = entry.path();
    let file_name = entry.file_name().to_string_lossy().to_string();
    if file_name.starts_with('.') {
      continue;
    }

    if path.is_dir() {
      let children = build_tree(&path)?;
      entries.push(TreeEntry::Folder {
        name: file_name,
        path: path.to_string_lossy().to_string(),
        children,
      });
    } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
      let name = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or(file_name);
      entries.push(TreeEntry::Note {
        name,
        path: path.to_string_lossy().to_string(),
      });
    }
  }
  Ok(entries)
}

#[tauri::command]
fn read_tree(root: String) -> Result<Vec<TreeEntry>, String> {
  let path = PathBuf::from(&root);
  if !path.exists() {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
  }
  build_tree(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
  fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_note(path: String, content: String) -> Result<(), String> {
  if let Some(parent) = Path::new(&path).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_note(path: String) -> Result<(), String> {
  if Path::new(&path).exists() {
    return Err("A note with that name already exists".into());
  }
  if let Some(parent) = Path::new(&path).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
  fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_entry(from: String, to: String) -> Result<(), String> {
  if Path::new(&to).exists() {
    return Err("Something with that name already exists".into());
  }
  fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_entry(path: String) -> Result<(), String> {
  let p = Path::new(&path);
  if p.is_dir() {
    fs::remove_dir_all(p).map_err(|e| e.to_string())
  } else {
    fs::remove_file(p).map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn path_exists(path: String) -> bool {
  Path::new(&path).exists()
}

#[tauri::command]
fn default_root_dir(app: tauri::AppHandle) -> Result<String, String> {
  let doc_dir = app.path().document_dir().map_err(|e| e.to_string())?;
  Ok(doc_dir.join("Noter").to_string_lossy().to_string())
}

#[derive(Serialize)]
struct FontFile {
  name: String,
  path: String,
}

const FONT_EXTENSIONS: [&str; 4] = ["ttf", "otf", "woff", "woff2"];

fn fonts_dir() -> Result<PathBuf, String> {
  // CARGO_MANIFEST_DIR is baked in at compile time as `<repo>/src-tauri`; go up
  // one level to the project root. Only valid for this dev checkout - a moved
  // or packaged copy of the app would need a different strategy.
  let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
  let project_root = manifest_dir.parent().ok_or("Could not resolve project root")?;
  let dir = project_root.join("Fonts");
  if !dir.exists() {
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  Ok(dir)
}

#[tauri::command]
fn get_fonts_dir() -> Result<String, String> {
  Ok(fonts_dir()?.to_string_lossy().to_string())
}

#[tauri::command]
fn list_fonts() -> Result<Vec<FontFile>, String> {
  let dir = fonts_dir()?;
  let mut fonts = Vec::new();
  for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    let ext = path
      .extension()
      .and_then(|e| e.to_str())
      .map(|e| e.to_lowercase());
    if let Some(ext) = ext {
      if FONT_EXTENSIONS.contains(&ext.as_str()) {
        let name = path
          .file_stem()
          .map(|s| s.to_string_lossy().to_string())
          .unwrap_or_default();
        fonts.push(FontFile {
          name,
          path: path.to_string_lossy().to_string(),
        });
      }
    }
  }
  fonts.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(fonts)
}

#[tauri::command]
fn read_bytes(path: String) -> Result<Vec<u8>, String> {
  fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
  if let Some(parent) = Path::new(&path).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
  open::that(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      read_tree,
      read_note,
      write_note,
      create_note,
      create_folder,
      rename_entry,
      delete_entry,
      path_exists,
      default_root_dir,
      get_fonts_dir,
      list_fonts,
      read_bytes,
      write_bytes,
      open_path
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
