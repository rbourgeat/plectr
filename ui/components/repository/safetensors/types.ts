
export interface SafeTensorTensorRaw {
    name: string;
    dtype?: string;
    shape?: number[];
    params?: number;
    data_offsets?: [number, number];
  }
  
  export interface SafeTensorMetadataRaw {
    type: "safetensors";
    total_tensors?: number;
    total_parameters?: number;
    total_params?: number;
    total_size_bytes?: number;
    tensors?: SafeTensorTensorRaw[];
    metadata?: {
      total_parameters?: number;
      total_size_bytes?: number;
    };
  }
    
  export interface SafeTensorTensor {
    name: string;
    dtype: string;
    shape: number[];
    params: number;
    data_offsets: [number, number];
  }
  
  export interface SafeTensorMetadata {
    type: "safetensors";
    total_tensors: number;
    total_parameters: number;
    total_size_bytes: number;
    tensors: SafeTensorTensor[];
  }
  