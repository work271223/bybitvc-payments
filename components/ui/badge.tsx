import * as React from 'react';
export function Badge({ className = '', ...props }: React.ComponentProps<'span'>) {
  return <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${className}`} {...props} />;
}