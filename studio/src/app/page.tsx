
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppLogo } from '@/components/AppLogo';

export default function WelcomePage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [currentUser, loading, router]);

  // Display a loading state or minimal content while redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary p-4">
      <AppLogo className="h-24 w-24 text-primary animate-pulse" />
      <p className="mt-4 text-xl font-semibold text-foreground">Initializing InspectZen...</p>
    </div>
  );
}
