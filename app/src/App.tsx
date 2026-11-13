import { Header } from './ui/shell/Header';
import { Rail } from './ui/shell/Rail';
import { LeftPanel } from './ui/shell/LeftPanel';
import { RightPanel } from './ui/shell/RightPanel';
import { Stage } from './ui/shell/Stage';
import { FileInputs } from './ui/shell/FileInputs';
import { Toast } from './ui/shell/Toast';
import { DropOverlay } from './ui/shell/DropOverlay';
import { ModalHost } from './ui/shell/ModalHost';
import { useProjectState } from './ui/hooks/useProject';
import { useTheme } from './ui/hooks/useTheme';
import { useShortcuts } from './ui/hooks/useShortcuts';
import { useDragDrop } from './ui/hooks/useDragDrop';

/**
 * The whole screen. The grid here is taken verbatim from the reference
 * stylesheet: a 52px header row, then a four-column body.
 */
export default function App() {
  const theme = useProjectState(s => s.theme);

  useTheme(theme);
  useShortcuts();
  useDragDrop();

  return (
    <div className="app">
      <Header />
      <div className="body">
        <Rail />
        <LeftPanel />
        <Stage />
        <RightPanel />
      </div>

      <FileInputs />
      <Toast />
      <DropOverlay />
      <ModalHost />
    </div>
  );
}
