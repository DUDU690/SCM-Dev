import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginUser, clearError } from '@/store/slices/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ShieldCheck, GraduationCap, BookOpen } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Administrator', sub: 'admin@saka.edu', icon: ShieldCheck, email: 'admin@saka.edu', password: 'Admin@12345', color: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:border-red-800 dark:text-red-300' },
  { label: 'Teacher', sub: 'teacher@saka.edu', icon: GraduationCap, email: 'teacher@saka.edu', password: 'Teacher@12345', color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300' },
  { label: 'Student', sub: 'student@saka.edu', icon: BookOpen, email: 'student@saka.edu', password: 'Student@12345', color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:border-green-800 dark:text-green-300' },
];

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((s) => s.auth);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  async function onSubmit(data: FormData) {
    const result = await dispatch(loginUser(data));
    if (loginUser.fulfilled.match(result)) {
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/saka-logo.png"
            alt="SAKA"
            className="h-16 mx-auto mb-3 object-contain drop-shadow-md"
          />
          <p className="text-muted-foreground text-sm">School Management System</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@school.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" loading={isLoading}>
                Sign in
              </Button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 rounded-lg border border-dashed border-muted-foreground/30 p-3 bg-muted/30">
              <p className="text-xs text-center font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Quick Login — Demo Accounts
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.label}
                      type="button"
                      onClick={() => { setValue('email', acc.email); setValue('password', acc.password); }}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-md border font-medium transition-colors ${acc.color}`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{acc.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                Click a role to auto-fill credentials, then Sign in
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SAKA AI · School Management System
        </p>
      </div>
    </div>
  );
}
