import {
  BookOpen,
  LogOut,
  MessageCircleQuestion,
  Settings,
  User,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AuthUser } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

// ---------------------------------------------------------------------------
// Avatar — shows Google picture or a monogram fallback
// ---------------------------------------------------------------------------

function UserAvatar({ user }: { user: AuthUser }) {
  const [imgError, setImgError] = useState(false);
  const initials = user.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <Avatar className="size-7">
      {user.avatarUrl && !imgError && (
        <AvatarImage
          src={user.avatarUrl}
          alt={user.name ?? user.email}
          onError={() => setImgError(true)}
        />
      )}
      <AvatarFallback className="text-[11px] font-semibold leading-none">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

// ---------------------------------------------------------------------------
// NavRail
// ---------------------------------------------------------------------------

export function NavRail({ active, onChange }: NavRailProps) {
  const { user, logout } = useAuth();

  return (
    <nav
      className="flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-sidebar py-3"
      aria-label="Primary">
      {/* Nav items */}
      <div className="flex flex-1 flex-col items-center gap-1">
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
      </div>

      {/* User avatar + logout */}
      {user && (
        <div className="flex flex-col items-center gap-1 pb-1">
          {/* Avatar — shows user info on hover */}
          <Tooltip>
            <TooltipTrigger>
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Signed in as">
                {user.avatarUrl ? (
                  <UserAvatar user={user} />
                ) : (
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 ring-1 ring-border">
                    <User
                      className="size-3.5 text-primary"
                      strokeWidth={1.75}
                    />
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[160px] text-xs">
              <p className="truncate">{user.name}</p>
            </TooltipContent>
          </Tooltip>

          {/* Logout button */}
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg text-muted-foreground hover:text-destructive"
                onClick={logout}
                aria-label="Sign out">
                <LogOut className="size-[18px]" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Sign out
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </nav>
  );
}
