import * as React from 'react';

export function Card({ className = '', ...props }: React.ComponentProps<'div'>) {
  return <div className={`rounded-2xl bg-[#141821] border border-[#252a33] ${className}`} {...props} />;
}
export const CardHeader = ({ className = '', ...p }: React.ComponentProps<'div'>) => <div className={`px-4 pt-4 ${className}`} {...p} />;
export const CardContent = ({ className = '', ...p }: React.ComponentProps<'div'>) => <div className={`px-4 pb-4 ${className}`} {...p} />;
export const CardFooter = ({ className = '', ...p }: React.ComponentProps<'div'>) => <div className={`px-4 pb-4 ${className}`} {...p} />;
export const CardTitle = ({ className = '', ...p }: React.ComponentProps<'div'>) => <div className={`text-lg font-semibold ${className}`} {...p} />;
export const CardDescription = ({ className = '', ...p }: React.ComponentProps<'div'>) => <div className={`text-sm text-neutral-400 ${className}`} {...p} />;