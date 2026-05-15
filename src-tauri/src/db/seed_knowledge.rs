use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct KnowledgeNodeSeed {
    id: i64,
    name: String,
    #[serde(rename = "parent_id")]
    parent_id: Option<i64>,
    grade: i32,
    semester: i32,
}

#[derive(Debug, Deserialize)]
struct KnowledgeTree {
    math: Vec<KnowledgeNodeSeed>,
    physics: Vec<KnowledgeNodeSeed>,
}

const KNOWLEDGE_TREE_JSON: &str = include_str!("./knowledge_tree.json");

pub fn get_knowledge_tree() -> Vec<(String, i64, String, Option<i64>, i32, i32)> {
    let tree: KnowledgeTree = serde_json::from_str(KNOWLEDGE_TREE_JSON).unwrap();
    let mut result = Vec::new();

    for node in tree.math {
        result.push(("math".to_string(), node.id, node.name, node.parent_id, node.grade, node.semester));
    }
    for node in tree.physics {
        result.push(("physics".to_string(), node.id, node.name, node.parent_id, node.grade, node.semester));
    }

    result
}
