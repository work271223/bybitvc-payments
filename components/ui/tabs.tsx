'use client';
import * as React from 'react';

const TabsContext = React.createContext<{value:string; setValue:(v:string)=>void} | null>(null);

export function Tabs({ value, onValueChange, children, className='' }: { value: string; onValueChange: (v:string)=>void; children: React.ReactNode; className?: string; }) {
  return <TabsContext.Provider value={{ value, setValue: onValueChange }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ children, className='' }: {children:React.ReactNode; className?:string;}) {
  return <div className={className}>{children}</div>;
}

export function TabsTrigger({ value, children, className='' }: { value:string; children:React.ReactNode; className?:string; }) {
  const ctx = React.useContext(TabsContext)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={`px-3 py-2 text-sm rounded-xl ${active ? 'bg-[#1b2029] text-[#F5A623]' : 'bg-black/40 text-neutral-200 hover:bg-black/60'} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className='' }: { value:string; children:React.ReactNode; className?:string; }) {
  const ctx = React.useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}