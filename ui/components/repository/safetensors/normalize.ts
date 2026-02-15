import {
    SafeTensorMetadataRaw,
    SafeTensorMetadata,
    SafeTensorTensor
  } from "./types";
  
  export function normalizeSafeTensorMetadata(
    raw: SafeTensorMetadataRaw
  ): SafeTensorMetadata {
    const tensorsRaw = raw.tensors ?? [];
  
    const tensors: SafeTensorTensor[] = tensorsRaw.map(t => ({
      name: t.name,
      dtype: t.dtype ?? "unknown",
      shape: t.shape ?? [],
      params:
        t.params ??
        (t.shape ? t.shape.reduce((a, b) => a * b, 1) : 0),
      data_offsets: t.data_offsets ?? [0, 0],
    }));
  
    const total_parameters =
      raw.total_parameters ??
      raw.total_params ??
      raw.metadata?.total_parameters ??
      tensors.reduce((sum, t) => sum + t.params, 0);
  
    const total_size_bytes =
      raw.total_size_bytes ??
      raw.metadata?.total_size_bytes ??
      (tensors.at(-1)?.data_offsets?.[1] ?? 0);
  
    return {
      type: "safetensors",
      tensors,
      total_tensors: raw.total_tensors ?? tensors.length,
      total_parameters,
      total_size_bytes,
    };
  }
  