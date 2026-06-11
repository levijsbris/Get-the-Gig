import { Text } from '@portfoliopro/renderer';
import { withEditable } from '../hocs/withEditable';

/**
 * Phase 4 / 5 transitional TextEditable. Phase 5 component commits replace
 * the wrapped `Text` renderer with the full TipTap editor; the HOC chrome
 * (selection ring, ⋮ button, right-click menu) is unchanged across that swap.
 */
export const TextEditable = withEditable(Text, { label: 'Text' });
