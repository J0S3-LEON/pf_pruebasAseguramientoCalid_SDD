'use client';

/**
 * SlotTextWrapper
 *
 * Intended to wrap the `slot-text` library from rdsx.dev.
 * Since that package is not available on npm, this file uses
 * the fallback-only implementation: a plain <span> element.
 *
 * When/if `slot-text` becomes available, replace the fallback below
 * with:
 *   const SlotText = dynamic(() => import('slot-text'), { ssr: false });
 *   and render <SlotText text={text} className={className} />
 */

import React from 'react';

export interface SlotTextWrapperProps {
  text: string;
  className?: string;
}

export function SlotTextWrapper({ text, className }: SlotTextWrapperProps) {
  // Fallback: plain span — activates when the library fails to load
  return <span className={className}>{text}</span>;
}

export default SlotTextWrapper;
