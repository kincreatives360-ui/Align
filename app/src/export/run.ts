import type { ProjectState } from '../state/types';
import { useExport } from '../state/exportStore';

/**
 * Produce the file for the current export settings.
 *
 * This is the seam between the UI and the encoder (WebCodecs, GIF, PNG
 * sequence — built in a later milestone). Everything the button needs is
 * already here: it sets progress on `useExport` and resolves when done.
 */
export async function runExport(state: ProjectState): Promise<void> {
  const store = useExport.getState();
  store.start('Preparing frames…');

  try {
    // The real encoder renders frame by frame and calls `update` between
    // frames; until it exists, fail loudly rather than pretending to work.
    throw new ExportNotReady(state.export.kind);
  } catch (err) {
    store.fail(err instanceof Error ? err.message : 'Export failed');
    throw err;
  }
}

export class ExportNotReady extends Error {
  constructor(kind: string) {
    super(`The ${kind} exporter is not built yet.`);
    this.name = 'ExportNotReady';
  }
}
