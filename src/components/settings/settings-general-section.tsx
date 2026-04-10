import { Moon, Sun } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type SettingsGeneralSectionProps = {
  matchSystem: boolean;
  manualTheme: 'light' | 'dark';
  onSetMatchSystem: (v: boolean) => void;
  onSetManualTheme: (v: 'light' | 'dark') => void;
};

export function SettingsGeneralSection({
  matchSystem,
  manualTheme,
  onSetMatchSystem,
  onSetManualTheme,
}: SettingsGeneralSectionProps) {
  return (
    <section>
      <h2 className="text-base font-semibold">General</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Appearance and default workspace behavior.
      </p>
      <Separator className="my-4" />
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="match-system">Match system appearance</Label>
            <p className="text-xs text-muted-foreground">
              Automatically follow macOS light/dark mode.
            </p>
          </div>
          <Switch
            id="match-system"
            checked={matchSystem}
            onCheckedChange={onSetMatchSystem}
          />
        </div>

        {!matchSystem && (
          <div className="flex flex-col gap-2">
            <Label>Theme</Label>
            <p className="text-xs text-muted-foreground">
              Choose a theme to use across the app.
            </p>
            <div className="mt-1 flex gap-2">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSetManualTheme(t)}
                  aria-pressed={manualTheme === t}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors',
                    manualTheme === t
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground',
                  )}>
                  {t === 'light' ? (
                    <Sun className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Moon className="size-4" strokeWidth={1.75} />
                  )}
                  {t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="launch">Open to workspace</Label>
          <select
            id="launch"
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="ask">
            <option value="ask">Ask</option>
            <option value="library">Library</option>
          </select>
        </div>
      </div>
    </section>
  );
}
