'use client';

import { Toaster } from 'sileo';

export function SileoToaster() {
  return (
    <Toaster position="top-right" theme="system" options={{ duration: 4000, roundness: 14 }} />
  );
}
