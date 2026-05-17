pub fn load_font_data() -> Result<Vec<u8>, String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let query = fontdb::Query {
        families: &[
            fontdb::Family::Name("PingFang SC"),
            fontdb::Family::Name("Hiragino Sans GB"),
            fontdb::Family::Name("Microsoft YaHei"),
            fontdb::Family::Name("WenQuanYi Micro Hei"),
            fontdb::Family::Name("Noto Sans CJK SC"),
            fontdb::Family::Name("Source Han Sans SC"),
            fontdb::Family::SansSerif,
        ],
        weight: fontdb::Weight::NORMAL,
        stretch: fontdb::Stretch::Normal,
        style: fontdb::Style::Normal,
    };

    if let Some(id) = db.query(&query) {
        if let Some((source, _index)) = db.face_source(id) {
            let data = match source {
                fontdb::Source::File(path) => {
                    std::fs::read(&path).map_err(|e| format!("Failed to read font file: {}", e))?
                }
                fontdb::Source::Binary(data) => {
                    let bytes: &[u8] = (*data).as_ref();
                    bytes.to_vec()
                }
                fontdb::Source::SharedFile(_, data) => {
                    let bytes: &[u8] = (*data).as_ref();
                    bytes.to_vec()
                }
            };
            return Ok(data);
        }
    }

    find_fallback_font()
}

fn find_fallback_font() -> Result<Vec<u8>, String> {
    let fallback_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "C:\\Windows\\Fonts\\msyh.ttc",
        "C:\\Windows\\Fonts\\simhei.ttf",
        "C:\\Windows\\Fonts\\simsun.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ];

    for path in &fallback_paths {
        if std::path::Path::new(path).exists() {
            return std::fs::read(path)
                .map_err(|e| format!("Failed to read font file: {}", e));
        }
    }

    Err("No Chinese font found. Please install a CJK font.".to_string())
}
