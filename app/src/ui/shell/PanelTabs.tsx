interface Tab<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (id: T) => void;
}

/** The pill row used at the top of a panel. */
export function PanelTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          className={t.id === value ? 'on' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
