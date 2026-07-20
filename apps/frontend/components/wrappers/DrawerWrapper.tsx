'use client';

/**
 * DrawerWrapper
 *
 * Intended to wrap the `hiraki` drawer/sheet animation library from rdsx.dev.
 * Since that package is not available on npm, this file uses the
 * fallback-only implementation: a Shadcn Dialog component.
 *
 * When/if `hiraki` becomes available, replace the fallback with a dynamic
 * import, e.g.:
 *   const Hiraki = dynamic(() => import('hiraki'), { ssr: false });
 *   return <Hiraki trigger={trigger} title={title}>{children}</Hiraki>;
 */

import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface DrawerWrapperProps {
  trigger: ReactNode;
  children: ReactNode;
  title?: string;
}

export function DrawerWrapper({ trigger, children, title }: DrawerWrapperProps) {
  // Fallback: Shadcn Dialog — activates when the library fails to load
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

export default DrawerWrapper;
