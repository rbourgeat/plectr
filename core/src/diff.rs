use similar::{ ChangeTag, TextDiff };
use serde_json::{ json, Value };

pub fn compute_text_diff(original: &str, modified: &str) -> Value {
  let diff = TextDiff::from_lines(original, modified);
  let mut changes = Vec::new();

  for change in diff.iter_all_changes() {
    let tag = match change.tag() {
      ChangeTag::Delete => "delete",
      ChangeTag::Insert => "insert",
      ChangeTag::Equal => "equal",
    };
    changes.push(json!({
            "tag": tag,
            "content": change.value(),
            "old_index": change.old_index(),
            "new_index": change.new_index(),
        }));
  }

  json!({
        "type": "text",
        "changes": changes
    })
}
