// src/app/not-found.tsx
"use client"; // Keep it as a client component if using Link/Button from shadcn, but no Firebase logic.

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="text-center">
        <AlertTriangle className="w-20 h-20 text-destructive mx-auto mb-6" />
        <h1 className="text-5xl font-bold font-headline mb-4">404</h1>
        <h2 className="text-3xl font-semibold text-foreground mb-3">Page Not Found</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Oops! The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/dashboard">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
