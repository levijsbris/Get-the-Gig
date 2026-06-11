import type { ReactNode } from 'react';
import type { Component } from '@portfoliopro/snapshot-schema';

/**
 * Palette registry. Each entry describes a draggable / clickable card in the
 * left-rail palette. Phase 5 registers six entries (Text, Image, Card,
 * Button, Container, PDF) — landing in this file as the component types
 * arrive. Sections are tracked separately because they live at a different
 * level of the snapshot.
 *
 * Entry semantics:
 *   - `dragId` — dnd-kit draggable id, MUST start with `palette:`. The
 *     editor's collision detection dispatches on this prefix.
 *   - `insert` — async factory invoked when the user clicks the card (drag
 *     uses `factory` directly). Returns null when the user cancels a picker
 *     (e.g. Image / PDF asset picker). Returns a fresh Component instance
 *     that already passes Zod validation.
 *   - `description` — appears under the label as a subtitle inside the card.
 */
export interface PaletteEntry {
  /** Discriminator that matches the Component schema's `type` literal. */
  type: Component['type'];
  /** Card title. */
  label: string;
  /** Subtitle hint shown under the label. */
  description: string;
  /** dnd-kit draggable id used by the editor's DndContext. */
  dragId: string;
  /** Optional thumbnail / icon rendered inside the card. */
  thumbnail?: () => ReactNode;
  /**
   * Synchronous factory for entries that can be inserted with no user
   * input. Components needing a picker (Image, PDF) use `insert` instead.
   */
  factory?: () => Component;
  /**
   * Async insert path for components requiring user input before they can
   * exist as a valid snapshot leaf. Returns null on cancel.
   */
  insert?: () => Promise<Component | null>;
}

// Registry. Each Phase 5 component PR appends one entry here.
export const PALETTE_COMPONENTS: PaletteEntry[] = [];

/** Mutates the registry. Called once per component type at module load. */
export function registerPaletteComponent(entry: PaletteEntry): void {
  if (PALETTE_COMPONENTS.some((e) => e.type === entry.type)) return;
  PALETTE_COMPONENTS.push(entry);
}
