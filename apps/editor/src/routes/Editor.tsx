import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useEditorStore } from '../store/editorStore';
import { Canvas } from './editor/Canvas';
import { ContextToolbar } from './editor/ContextToolbar';
import { PageTabs } from './editor/PageTabs';
import { Palette } from './editor/Palette';
import { Toolbar } from './editor/Toolbar';

export function Editor() {
  const { id: portfolioId } = useParams<{ id: string }>();
  const { load, saveStatus } = useDraftAutosave(portfolioId ?? '');
  const setSelection = useEditorStore((s) => s.setSelection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  // Keyboard: ⌘Z / ctrl-Z undo; ⌘⇧Z / ctrl-Y redo; Escape clears selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (event.key === 'Escape') {
        setSelection(null);
        return;
      }
      if (meta && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelection, undo, redo]);

  if (!portfolioId) {
    return <p className="p-6 text-sm text-red-600">Missing portfolio id.</p>;
  }
  if (load.status === 'loading') {
    return <p className="p-6 text-sm text-slate-500">Loading editor…</p>;
  }
  if (load.status === 'error') {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Could not load draft: {load.error.message}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-slate-700 underline">
          ← Back to portfolios
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <Link to="/" className="text-sm text-slate-500 hover:underline">
          ← Portfolios
        </Link>
      </header>
      <Toolbar saveStatus={saveStatus} />
      <PageTabs />
      <ContextToolbar />
      <div className="flex flex-1 overflow-hidden">
        <Canvas />
        <Palette />
      </div>
    </div>
  );
}
