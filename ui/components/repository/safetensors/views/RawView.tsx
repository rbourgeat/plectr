export function RawView({ data }: { data: any }) {
    return (
      <pre className="text-xs font-mono text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  