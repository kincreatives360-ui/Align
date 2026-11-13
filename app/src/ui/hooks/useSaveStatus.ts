import { useEffect, useState } from 'react';
import { onSaveStatus } from '../../state/persistence';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Subscribe to the debounced autosave indicator. */
export function useSaveStatus(): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => onSaveStatus(setStatus), []);

  return status;
}
