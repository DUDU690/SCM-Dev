import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
      <p className="text-8xl font-black text-muted-foreground/20 mb-4">404</p>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist or you don't have permission to access it.</p>
      <Button onClick={() => navigate('/dashboard')}><Home className="h-4 w-4 mr-2" />Go to Dashboard</Button>
    </div>
  );
}
