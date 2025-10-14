import * as React from 'react';
export function Label({ className = '', ...props }: React.ComponentProps<'label'>) {
  return <label className={`text-sm text-neutral-300 ${className}`} {...props} />;
}