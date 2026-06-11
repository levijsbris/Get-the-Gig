import type { MouseEvent } from 'react';
import type { NavTarget } from '@portfoliopro/snapshot-schema';

/**
 * Resolves a NavTarget into the props an <a> needs: `href`, `target`, `rel`,
 * and an optional click handler for internal targets that the viewer should
 * handle client-side (Phase 8 viewer hooks router navigation here). For v1
 * in the editor, internal targets fall back to anchor-style hash navigation
 * since the editor doesn't render a router-aware viewer.
 */
export interface ResolvedNavTarget {
  href: string;
  target?: string;
  rel?: string;
  onClick?: (event: MouseEvent) => void;
}

export function useNavTarget(target: NavTarget | undefined): ResolvedNavTarget {
  if (!target) return { href: '#' };
  switch (target.kind) {
    case 'url':
      return {
        href: target.href,
        target: target.openInNewTab ? '_blank' : undefined,
        rel: target.openInNewTab ? 'noopener noreferrer' : undefined,
      };
    case 'mailto':
      return { href: `mailto:${target.email}` };
    case 'page':
      return { href: `#${target.pageId}` };
    case 'section':
      return { href: `#${target.pageId}-${target.sectionId}` };
  }
}
