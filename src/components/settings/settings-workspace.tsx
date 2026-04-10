import { useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { SettingsGeneralSection } from './settings-general-section';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settings-nav';
import { SettingsModelsSection } from './settings-models-section';
import type { SettingsWorkspaceProps } from './settings-types';
import { useSettingsModelsPanel } from './use-settings-models-panel';

export type { SettingsWorkspaceProps };

export function SettingsWorkspace({
  settings,
  onChangeSettings,
  matchSystem,
  manualTheme,
  onSetMatchSystem,
  onSetManualTheme,
  ollamaReachable,
  onOllamaReachableChange,
}: SettingsWorkspaceProps) {
  const [active, setActive] = useState<SettingsSectionId>('general');

  const modelsPanel = useSettingsModelsPanel({
    modelsSectionActive: active === 'models',
    settings,
    ollamaReachable,
    onChangeSettings,
    onOllamaReachableChange,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <nav
        className="w-[220px] shrink-0 border-r border-border bg-muted/20 py-3 pr-2 pl-2"
        aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={cn(
              'mb-0.5 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              active === s.id
                ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}>
            {s.label}
          </button>
        ))}
      </nav>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-16 py-8">
          {active === 'general' && (
            <SettingsGeneralSection
              matchSystem={matchSystem}
              manualTheme={manualTheme}
              onSetMatchSystem={onSetMatchSystem}
              onSetManualTheme={onSetManualTheme}
            />
          )}

          {active === 'models' && (
            <SettingsModelsSection
              settings={settings}
              onChangeSettings={onChangeSettings}
              ollamaReachable={ollamaReachable}
              {...modelsPanel}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
