import * as React from 'react';

type Props = React.ComponentProps<'span'> & {
  variant?: 'default' | 'secondary' | 'outline' | 'warning' | 'success';
};

export function Badge({ className = '', variant = 'default', ...props }: Props) {
  const base = 'inline-flex items-center px-2 py-1 text-xs font-medium rounded';
  const variants = {
    default: 'bg-white/10 text-white',
    secondary: 'bg-white/10 text-white',
    outline: 'border border-white/20 text-white',
    warning: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  } as const;

  return <span className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
