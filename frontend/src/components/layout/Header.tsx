import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, Sun, Moon, User } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleSidebar } from '@/store/slices/uiSlice';
import { setTheme } from '@/store/slices/uiSlice';

export default function Header() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme } = useAppSelector((s) => s.ui);
  const { unreadCount } = useAppSelector((s) => s.notifications);
  const { user } = useAppSelector((s) => s.auth);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    dispatch(setTheme(next));
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  return (
    <header className="h-14 border-b border-border flex items-center gap-3 px-4 bg-background shrink-0">
      {/* Mobile menu toggle */}
      <button
        onClick={() => dispatch(toggleSidebar())}
        className="lg:hidden text-muted-foreground hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <User className="h-4 w-4" />
        </button>

        <span className="ml-1 text-sm font-medium hidden sm:block">
          {user?.faculty?.firstName ?? user?.student?.firstName ?? user?.email?.split('@')[0]}
        </span>
      </div>
    </header>
  );
}
