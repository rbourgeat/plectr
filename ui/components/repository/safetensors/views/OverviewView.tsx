import { SafeTensorMetadata } from "../types";

export function OverviewView({ data }: { data: SafeTensorMetadata }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat label="Format" value="SafeTensors" />
      <Stat label="Tensors" value={data.total_tensors} />
      <Stat label="Parameters" value={data.total_parameters.toLocaleString()} />
      <Stat
        label="Size"
        value={`${(data.total_size_bytes / 1024).toFixed(2)} KB`}
      />
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
      <p className="text-[10px] uppercase font-bold text-zinc-500">{label}</p>
      <p className="text-xl font-mono font-bold">{value}</p>
    </div>
  );
}
