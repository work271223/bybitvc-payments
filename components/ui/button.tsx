'use client';
import * as React from 'react';

type Props = React.ComponentProps<'button'> & {
  variant?: 'default' | 'secondary';
  size?: 'default' | 'icon';
};

export function Button({ className = '', variant = 'default', size = 'default', ...props }: Props) {
  const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-md';
  const variants = {
    default: 'bg-[#1f232b] text-white hover:bg-black/70',
    secondary: 'bg-white/10 text-white hover:bg-white/20'
  } as const;
  const sizes = {
    default: 'h-10 px-4 py-2',
    icon: 'h-10 w-10 p-0'
  } as const;
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}