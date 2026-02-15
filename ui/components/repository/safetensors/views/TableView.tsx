import { SafeTensorTensor } from "../types";

export function TableView({ tensors }: { tensors: SafeTensorTensor[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead className="border-b border-zinc-800 text-zinc-500">
          <tr>
            <th className="text-left py-2">Name</th>
            <th>Shape</th>
            <th>Params</th>
            <th>DType</th>
            <th>Offsets</th>
          </tr>
        </thead>
        <tbody>
          {tensors.map(t => (
            <tr key={t.name} className="border-b border-zinc-900 hover:bg-zinc-900/40">
              <td className="py-2 text-blue-400">{t.name}</td>
              <td>[{t.shape.join("×")}]</td>
              <td>{t.params.toLocaleString()}</td>
              <td>{t.dtype}</td>
              <td className="text-zinc-500">
                {t.data_offsets[0]} → {t.data_offsets[1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
