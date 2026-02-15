'use client';

import { useState } from 'react';
import { Layers, Table, GitBranch, Code } from 'lucide-react';
import { SafeTensorMetadata } from './types';

import { OverviewView } from './views/OverviewView';
import { TableView } from './views/TableView';
import { HierarchyView } from './views/HierarchyView';
import { RawView } from './views/RawView';
import { SlidingTabs } from '@/components/ui/SlidingTabs';

type View = 'overview' | 'table' | 'hierarchy' | 'raw';

export function SafeTensorDashboard({ data }: { data: SafeTensorMetadata }) {
  const [view, setView] = useState<View>('overview');

  return (
    <div className="glass-panel rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
        <div>
          <h3 className="font-bold tracking-tight">SafeTensors Inspector</h3>
          <p className="text-xs text-zinc-500 font-mono">
            {data.total_tensors} tensors · {data.total_parameters.toLocaleString()} params
          </p>
        </div>

        <SlidingTabs
          activeTab={view}
          onChange={setView}
          tabs={[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'table', label: 'Table', icon: Table },
            { id: 'hierarchy', label: 'Tree', icon: GitBranch },
            { id: 'raw', label: 'Raw', icon: Code },
          ]}
        />
      </div>

      <div className="p-6">
        {view === 'overview' && <OverviewView data={data} />}
        {view === 'table' && <TableView tensors={data.tensors} />}
        {view === 'hierarchy' && <HierarchyView tensors={data.tensors} />}
        {view === 'raw' && <RawView data={data} />}
      </div>
    </div>
  );
}
