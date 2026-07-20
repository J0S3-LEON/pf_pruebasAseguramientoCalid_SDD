'use client';

/**
 * IconWrapper
 *
 * Intended to wrap the `reicon` icon library from rdsx.dev.
 * Since that package is not available on npm, this file uses
 * the fallback-only implementation: a `<span>` with a `?` placeholder.
 *
 * When/if `reicon` becomes available, replace the fallback with the
 * real icon render call, e.g.:
 *   import { Icon } from 'reicon';
 *   return <Icon name={name} size={size} className={className} />;
 */

import React from 'react';

export interface IconWrapperProps {
  name: string;
  size?: number;
  className?: string;
}

export function IconWrapper({ name: _name, size = 20, className }: IconWrapperProps) {
  // Fallback: question-mark placeholder — activates when the library fails to load
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
    >
      ?
    </span>
  );
}

export default IconWrapper;
