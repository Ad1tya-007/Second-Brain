import { BookOpen, MessageCircleQuestion, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type AppView = 'ask' | 'library' | 'settings';

type NavRailProps = {
  active: AppView;
  onChange: (view: AppView) => void;
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

export function NavRail({ active, onChange }: NavRailProps) {
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
    </nav>
  );
}
