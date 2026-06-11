import { Button } from '@portfoliopro/renderer';
import { withEditable } from '../hocs/withEditable';

/**
 * Button component editor wrapper. v1 has no inline label editing — label
 * changes flow through the right-side ContextToolbar (selection-driven).
 * The renderer is unchanged from the viewer's; selection chrome + ⋮ menu
 * arrive via withEditable.
 */
export const ButtonEditable = withEditable(Button, { label: 'Button' });
