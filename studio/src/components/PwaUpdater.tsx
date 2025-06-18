
"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function PwaUpdater() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.workbox !== undefined) {
      // The window.workbox call is for Next PWA plugin, which we are not using here.
      // Standard service worker registration:
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          // Optional: Listen for updates to the service worker
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available and will be used when all 
                    // tabs for this page are closed.
                    console.log('New content is available and will be used when all tabs for this page are closed.');
                    // You can show a toast to the user to refresh the page
                    toast({
                      title: "App Update Available",
                      description: "A new version of the app is available. Close all tabs or refresh to update.",
                      duration: 10000, // Keep it visible for a bit longer
                    });
                  } else {
                    // Content is cached for offline use.
                    console.log('Content is cached for offline use.');
                     toast({
                      title: "App Ready Offline",
                      description: "The app is now ready to be used offline.",
                    });
                  }
                }
              };
            }
          };
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, [toast]);

  return null; // This component does not render anything
}
