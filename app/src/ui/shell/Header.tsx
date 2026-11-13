import { Brand } from './Brand';
import { ProjectNameField } from './ProjectNameField';
import { SaveStatusText } from './SaveStatusText';
import { UndoRedoButtons } from './UndoRedoButtons';
import { ThemeToggle } from './ThemeToggle';
import { ExportButton } from './ExportButton';
import { HelpButton } from './HelpButton';

export function Header() {
  return (
    <header className="top">
      <Brand />
      <div className="mid">
        <ProjectNameField />
        <SaveStatusText />
      </div>
      <UndoRedoButtons />
      <ThemeToggle />
      <ExportButton />
      <HelpButton />
    </header>
  );
}
