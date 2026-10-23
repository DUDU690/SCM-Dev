import { NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser } from '@/store/slices/authSlice';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  Clock, CheckSquare, FileText, DollarSign, UserPlus, Building2,
  Star, Image, Video, ClipboardList, Bell, BarChart3, Settings,
  Shield, LogOut, ChevronRight, School, BookMarked, Award,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('ADMIN' | 'FACULTY' | 'STUDENT')[];
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'FACULTY', 'STUDENT'] },

  // Admin items
  { label: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
  { label: 'Students', href: '/students', icon: GraduationCap, roles: ['ADMIN'] },
  { label: 'Faculty', href: '/faculty', icon: BookOpen, roles: ['ADMIN'] },
  { label: 'Classes', href: '/classes', icon: School, roles: ['ADMIN'] },
  { label: 'Subjects', href: '/subjects', icon: BookMarked, roles: ['ADMIN'] },
  { label: 'Academic Years', href: '/academic-years', icon: Calendar, roles: ['ADMIN'] },
  { label: 'Timetable', href: '/timetable', icon: Clock, roles: ['ADMIN'] },
  { label: 'Holidays', href: '/holidays', icon: Calendar, roles: ['ADMIN'] },
  { label: 'Attendance', href: '/attendance', icon: CheckSquare, roles: ['ADMIN'] },
  { label: 'Examinations', href: '/examinations', icon: FileText, roles: ['ADMIN'] },
  { label: 'Marks', href: '/marks', icon: Star, roles: ['ADMIN'] },
  { label: 'Fees', href: '/fees', icon: DollarSign, roles: ['ADMIN'] },
  { label: 'Admissions', href: '/admissions', icon: UserPlus, roles: ['ADMIN'] },
  { label: 'Hostel', href: '/hostel', icon: Building2, roles: ['ADMIN'] },
  { label: 'Events', href: '/events', icon: Calendar, roles: ['ADMIN'] },
  { label: 'Achievements', href: '/achievements', icon: Award, roles: ['ADMIN'] },
  { label: 'Gallery', href: '/gallery', icon: Image, roles: ['ADMIN'] },
  { label: 'Online Classes', href: '/online-classes', icon: Video, roles: ['ADMIN'] },
  { label: 'Assignments', href: '/assignments', icon: ClipboardList, roles: ['ADMIN'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
  { label: 'Audit Logs', href: '/audit-logs', icon: Shield, roles: ['ADMIN'] },

  // Faculty items
  { label: 'My Timetable', href: '/faculty/timetable', icon: Clock, roles: ['FACULTY'] },
  { label: 'My Students', href: '/faculty/students', icon: GraduationCap, roles: ['FACULTY'] },
  { label: 'Take Attendance', href: '/faculty/attendance', icon: CheckSquare, roles: ['FACULTY'] },
  { label: 'Enter Marks', href: '/faculty/marks', icon: FileText, roles: ['FACULTY'] },
  { label: 'Online Classes', href: '/online-classes', icon: Video, roles: ['FACULTY'] },
  { label: 'Assignments', href: '/assignments', icon: ClipboardList, roles: ['FACULTY'] },

  // Student items
  { label: 'My Timetable', href: '/student/timetable', icon: Clock, roles: ['STUDENT'] },
  { label: 'My Attendance', href: '/student/attendance', icon: CheckSquare, roles: ['STUDENT'] },
  { label: 'My Results', href: '/student/results', icon: FileText, roles: ['STUDENT'] },
  { label: 'My Fees', href: '/student/fees', icon: DollarSign, roles: ['STUDENT'] },
  { label: 'Assignments', href: '/student/assignments', icon: ClipboardList, roles: ['STUDENT'] },
  { label: 'My Profile', href: '/student/profile', icon: Users, roles: ['STUDENT'] },

  // Shared
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['ADMIN', 'FACULTY', 'STUDENT'] },
];

export default function Sidebar() {
  const { user } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const role = user?.role ?? 'STUDENT';
  const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrator', FACULTY: 'Teacher', STUDENT: 'Student' };
  const profile = user?.faculty ?? user?.student;
  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : user?.email ?? '';

  const filteredItems = navItems.filter((item) => item.roles.includes(role as never));

  async function handleLogout() {
    await dispatch(logoutUser());
    navigate('/login');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
          S
        </div>
        <div>
          <p className="font-semibold text-sidebar-foreground text-sm">SAKA SMS</p>
          <p className="text-xs text-sidebar-foreground/60">{ROLE_LABELS[role] ?? role} Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {filteredItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group
               ${isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-semibold shrink-0">
            {profile
              ? getInitials(profile.firstName, profile.lastName)
              : user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
