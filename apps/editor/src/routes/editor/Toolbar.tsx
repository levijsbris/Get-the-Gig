import { canRedo, canUndo } from '../../store/history';
import { useEditorStore, type Viewport } from '../../store/editorStore';

interface ToolbarProps {
  saveStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
}

export function Toolbar({ saveStatus }: ToolbarProps) {
  const history = useEditorStore((s) => s.history);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const viewport = useEditorStore((s) => s.viewport);
  const setViewport = useEditorStore((s) => s.setViewport);

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo(history)}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo(history)}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
        >
          Redo
        </button>
        <SaveIndicator status={saveStatus} />
      </div>
      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
        {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewport(v)}
            className={`rounded px-3 py-1 text-xs capitalize ${
              viewport === v ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: ToolbarProps['saveStatus'] }) {
  const text = {
    idle: '',
    pending: 'Editing…',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed',
  }[status];
  if (!text) return null;
  return (
    <span
      className={`ml-3 text-xs ${
        status === 'error'
          ? 'text-red-600'
          : status === 'saved'
            ? 'text-green-700'
            : 'text-slate-500'
      }`}
    >
      {text}
    </span>
  );
}
