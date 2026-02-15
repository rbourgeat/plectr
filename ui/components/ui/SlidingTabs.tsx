'use client';
import React, { useState, useRef, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: any) => void;
  className?: string;
  layout?: 'shrink' | 'full';
}

export const SlidingTabs = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  layout = 'shrink',
}: Props) => {
  const [tabStyle, setTabStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const activeIndex = tabs.findIndex((t) => t.id === activeTab);
    const currentTab = tabsRef.current[activeIndex];

    if (currentTab) {
      setTabStyle({
        left: currentTab.offsetLeft,
        width: currentTab.offsetWidth,
        opacity: 1,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div
      className={`relative flex items-center bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 ${className}`}
    >
      <div
        className="absolute top-1 bottom-1 bg-zinc-800 rounded-md shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{
          left: tabStyle.left,
          width: tabStyle.width,
          opacity: tabStyle.opacity,
        }}
      />

      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            disabled={isDisabled}
            ref={(el) => {
              tabsRef.current[index] = el;
            }}
            onClick={() => !isDisabled && onChange(tab.id)}
            className={`
       relative z-10 flex items-center justify-center gap-2 px-3 py-1.5 
       text-xs font-bold transition-colors duration-200
       ${layout === 'full' ? 'flex-1' : 'flex-1 sm:flex-none'} 
       ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
       ${isDisabled ? 'opacity-50 cursor-not-allowed hover:text-zinc-500' : 'cursor-pointer'}
      `}
          >
            {Icon && <Icon size={14} className={isActive ? 'text-white' : 'text-zinc-500'} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
