import { SafeTensorTensor } from "../types";

export function HierarchyView({ tensors }: { tensors: SafeTensorTensor[] }) {
  const groups = tensors.reduce((acc: any, t) => {
    const parts = t.name.split(".");
    const group = parts.slice(0, -1).join(".");
    const leaf = parts.at(-1);
    acc[group] = acc[group] || [];
    acc[group].push({ ...t, leaf });
    return acc;
  }, {});

  return (
    <div className="space-y-3 font-mono text-xs">
      {Object.entries(groups).map(([group, items]: any) => (
        <details
          key={group}
          open
          className="rounded-xl bg-zinc-900/40 border border-zinc-800"
        >
          <summary className="cursor-pointer px-4 py-2 font-bold">
            {group || "root"}
          </summary>
          <div className="px-6 pb-3">
            {items.map((t: any) => (
              <div key={t.name} className="flex justify-between py-1 text-zinc-400">
                <span>{t.leaf}</span>
                <span>
                  [{t.shape.join("×")}] · {t.params.toLocaleString()} params
                </span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
