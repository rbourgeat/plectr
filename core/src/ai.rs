use anyhow::Result;
use safetensors::SafeTensors;
use serde_json::{ json, Value };

pub fn analyze_safetensors(data: &[u8]) -> Result<Value> {
  let tensors = SafeTensors::deserialize(data)?;

  let mut layers_info = Vec::new();
  let mut total_params: u64 = 0;

  for (name, view) in tensors.tensors() {
    let shape = view.shape().to_vec();
    let dtype = view.dtype();

    let params_count: u64 = shape.iter().product::<usize>() as u64;
    total_params += params_count;

    if layers_info.len() < 10 {
      layers_info.push(json!({
                "name": name,
                "shape": shape,
                "dtype": format!("{:?}", dtype),
                "params": params_count
            }));
    }
  }

  Ok(json!({
        "type": "safetensors",
        "total_tensors": tensors.names().len(),
        "total_parameters": total_params,
        "sample_layers": layers_info
    }))
}
