import { useState } from 'react';
import {
  BookOpen,
  MessageCircleQuestion,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Sun,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Read the current theme from the DOM (source of truth). */
function currentTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function useThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('lsb:theme', next);
    setTheme(next);
  };

  return { theme, toggle };
}

export type AppView = 'ask' | 'library' | 'settings';

type NavRailProps = {
  active: AppView;
  onChange: (view: AppView) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  /** Inspector applies to Ask; hide toggle on other views. */
  showInspectorToggle?: boolean;
};

const items: {
  id: AppView;
  label: string;
  icon: typeof MessageCircleQuestion;
}[] = [
  { id: 'ask', label: 'Ask', icon: MessageCircleQuestion },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function NavRail({
  active,
  onChange,
  inspectorOpen,
  onToggleInspector,
  showInspectorToggle = true,
}: NavRailProps) {
  const { theme, toggle: toggleTheme } = useThemeToggle();

  return (
    <nav
      className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3"
      aria-label="Primary">
      {items.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger>
            <Button
              variant={active === id ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'size-9 rounded-lg',
                active === id &&
                  'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
              )}
              onClick={() => onChange(id)}
              aria-current={active === id ? 'page' : undefined}>
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      {/* Light / dark toggle */}
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }>
            {theme === 'dark' ? (
              <Sun className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <Moon className="size-[18px]" strokeWidth={1.75} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </TooltipContent>
      </Tooltip>

      {showInspectorToggle && (
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              onClick={onToggleInspector}
              aria-pressed={inspectorOpen}>
              {inspectorOpen ? (
                <PanelRightClose className="size-[18px]" strokeWidth={1.75} />
              ) : (
                <PanelRightOpen className="size-[18px]" strokeWidth={1.75} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {inspectorOpen ? 'Hide inspector' : 'Show inspector'}
          </TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}
