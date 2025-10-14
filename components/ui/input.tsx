import * as React from 'react';
export function Input({ className = '', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={`h-10 w-full rounded-xl bg-black/40 border border-[#2a2f3a] px-3 text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40 ${className}`}
      {...props}
    />
  );
}