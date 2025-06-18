
"use client"; 

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, FilePlus2, History as HistoryIcon, LayoutDashboard, Settings, Package, SearchCheck, ClipboardCheck, ShieldCheck, Truck, Building, UserCog, LogOut, UserPlus, KeyRound, Users, ShieldAlert } from 'lucide-react';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from "@/components/ui/toaster";
import { AppLogo } from '@/components/AppLogo';
import { PART_NAMES_LIST, PART_SLUGS_MAP, USER_ROLES, USER_ROLES_LIST } from '@/lib/constants';
import type { PartName, UserRole } from '@/lib/types';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole'; 
import { Skeleton } from '@/components/ui/skeleton';
import { PwaUpdater } from '@/components/PwaUpdater';
import { useEffect, useMemo } from 'react';

const partLinks = PART_NAMES_LIST.map(name => {
  const IconComponent = Package; // Default or map to specific icons if needed
  return { name, icon: IconComponent };
});


function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, logout, loading: authLoading } = useAuth();
  const { currentRole, isLoadingRole } = useUserRole();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isWelcomePage = pathname === '/';

  const memoizedPartLinks = useMemo(() => 
    PART_NAMES_LIST.map(name => ({
      name,
      icon: Package, // Default icon, can be customized
      slug: PART_SLUGS_MAP[name]
    })), 
  []);


  useEffect(() => {
    if (!authLoading && !currentUser && !isAuthPage && !isWelcomePage) {
      router.replace('/login');
    }
  }, [authLoading, currentUser, isAuthPage, isWelcomePage, router, pathname]);


  if (isWelcomePage) {
    return <>{children}</>; 
  }
  
  if (authLoading || (currentUser && isLoadingRole)) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <AppLogo className="size-12 text-primary animate-pulse" />
            <p className="ml-3 text-lg text-foreground">Loading InspectZen...</p>
        </div>
    );
  }

  if (!currentUser && !isAuthPage) { 
    return ( 
        <div className="flex items-center justify-center h-screen bg-background">
            <p className="text-lg text-foreground">Redirecting to login...</p>
        </div>
    );
  }
  
  if (isAuthPage) {
    return <>{children}</>;
  }

  const canAccessDataEntry = currentUser && 
                            currentRole && 
                            (currentRole === USER_ROLES_LIST[0] || // ADMIN
                             currentRole === USER_ROLES_LIST[1] || // TPI_INSPECTOR
                             currentRole === USER_ROLES_LIST[2]);   // FINAL_INSPECTOR

  return (
    <SidebarProvider defaultOpen>
      <Sidebar className="border-r" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <AppLogo className="size-8 text-primary" />
            <h1 className="text-xl font-semibold font-headline text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              InspectZen
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/dashboard">
                <SidebarMenuButton tooltip="Dashboard" isActive={pathname === '/dashboard'}>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            {canAccessDataEntry && (
              <SidebarMenuItem>
                <Link href="/data-entry">
                  <SidebarMenuButton tooltip="Data Entry" isActive={pathname === '/data-entry'}>
                    <FilePlus2 />
                    <span>Data Entry</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <Link href="/history">
                <SidebarMenuButton tooltip="History" isActive={pathname === '/history'}>
                  <HistoryIcon />
                  <span>History</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             {currentRole === 'ADMIN' && (
                <SidebarMenuItem>
                  <Link href="/admin">
                    <SidebarMenuButton tooltip="Admin Panel" isActive={pathname.startsWith('/admin')}>
                      <ShieldAlert />
                      <span>Admin Panel</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
          </SidebarMenu>
          
          <div className="mt-auto">
            <SidebarMenu>
                <SidebarMenuItem className="mt-4 pt-4 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
                    <span className="px-2 text-xs font-medium text-sidebar-foreground/70">PARTS</span>
                </SidebarMenuItem>
                {memoizedPartLinks.map(part => {
                  const IconComponent = part.icon;
                  return (
                    <SidebarMenuItem key={part.name}>
                      <Link href={`/reports/part/${part.slug}`}>
                        <SidebarMenuButton tooltip={part.name} variant="ghost" className="text-sidebar-foreground/80 hover:text-sidebar-foreground" isActive={pathname === `/reports/part/${part.slug}`}>
                            <IconComponent /> <span>{part.name}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}

                <SidebarMenuItem className="mt-4 pt-4 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
                    <span className="px-2 text-xs font-medium text-sidebar-foreground/70">INSPECTION STAGES</span>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/reports/material-inspection">
                    <SidebarMenuButton tooltip="Material Inspection" variant="ghost" className="text-sidebar-foreground/80 hover:text-sidebar-foreground" isActive={pathname === '/reports/material-inspection'}>
                        <SearchCheck /> <span>Material Inspection</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/reports/final-inspection">
                    <SidebarMenuButton tooltip="Final Inspection" variant="ghost" className="text-sidebar-foreground/80 hover:text-sidebar-foreground" isActive={pathname === '/reports/final-inspection'}>
                        <ClipboardCheck /> <span>Final Inspection</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/reports/tpi-inspection">
                    <SidebarMenuButton tooltip="TPI Inspection" variant="ghost" className="text-sidebar-foreground/80 hover:text-sidebar-foreground" isActive={pathname === '/reports/tpi-inspection'}>
                        <ShieldCheck /> <span>TPI Inspection</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Dispatch" variant="ghost" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
                        <Truck /> <span>Dispatch</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
          </div>

        </SidebarContent>
        <SidebarFooter className="p-4 flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
          {currentUser && userProfile ? (
            <>
              <div className="flex items-center gap-2 w-full group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png" alt={userProfile.name} data-ai-hint="user avatar" />
                  <AvatarFallback>{userProfile.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-medium text-sidebar-foreground">{userProfile.name || "User"}</span>
                  <span className="text-xs text-sidebar-foreground/70">
                    {isLoadingRole ? "Loading role..." : (currentRole ? USER_ROLES[currentRole] : "No role")}
                  </span>
                </div>
              </div>
              <Button variant="ghost" onClick={logout} className="w-full text-sidebar-foreground/80 hover:text-sidebar-foreground group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:p-2">
                <LogOut />
                <span className="group-data-[collapsible=icon]:hidden ml-2">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="w-full">
                <Button variant="ghost" className="w-full text-sidebar-foreground/80 hover:text-sidebar-foreground">
                    <KeyRound /> <span className="ml-2 group-data-[collapsible=icon]:hidden">Login</span>
                </Button>
              </Link>
               <Link href="/signup" className="w-full">
                <Button variant="ghost" className="w-full text-sidebar-foreground/80 hover:text-sidebar-foreground">
                    <UserPlus /> <span className="ml-2 group-data-[collapsible=icon]:hidden">Sign Up</span>
                </Button>
              </Link>
            </>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <h1 className="text-lg font-semibold text-foreground md:hidden">InspectZen</h1>
            <div className="flex items-center gap-2 ml-auto"> 
              {authLoading || isLoadingRole ? (
                 <Skeleton className="h-5 w-20" />
              ) : currentUser && currentRole ? (
                <>
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {USER_ROLES[currentRole]}
                  </span>
                </>
              ) : null }
            </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>InspectZen by nitinkoyale</title>
        <meta name="description" content="Parts Inspection Data Management for VINFAST" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4682B4" /> 
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <AppLayout>
            <>
              {children}
              <PwaUpdater /> 
            </>
          </AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
