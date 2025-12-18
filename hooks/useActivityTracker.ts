'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { ActivityEventType, ActivityEventData } from '@/lib/types';

// Generate or retrieve session ID from sessionStorage
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  const SESSION_KEY = 'tswi_activity_session';
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    // Generate UUID v4
    sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

interface TrackEventOptions {
  eventType: ActivityEventType;
  eventData?: Partial<ActivityEventData>;
}

export function useActivityTracker() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const sessionId = useRef<string>('');
  const lastTrackedPage = useRef<string>('');
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Initialize session ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionId.current = getOrCreateSessionId();
    }
  }, []);

  // Track session start (login)
  useEffect(() => {
    if (status === 'authenticated' && session) {
      trackEvent({
        eventType: 'login',
        eventData: {},
      });
    }
  }, [status, session]);

  // Track page views
  useEffect(() => {
    if (status === 'authenticated' && pathname && pathname !== lastTrackedPage.current) {
      lastTrackedPage.current = pathname;

      trackEvent({
        eventType: 'page_view',
        eventData: {
          page: pathname,
        },
      });
    }
  }, [pathname, status]);

  // Track event function
  const trackEvent = useCallback(async (options: TrackEventOptions) => {
    // Only track if authenticated
    if (status !== 'authenticated' || !sessionId.current) {
      return;
    }

    try {
      await fetch('/api/activity/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: options.eventType,
          eventData: options.eventData || {},
          sessionId: sessionId.current,
        }),
      });
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.error('Failed to track activity:', error);
    }
  }, [status]);

  // Track tab switch with debouncing
  const trackTabSwitch = useCallback((tabName: string) => {
    const key = `tab_${tabName}`;

    // Clear existing timer
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Set new timer
    debounceTimers.current[key] = setTimeout(() => {
      trackEvent({
        eventType: 'tab_switch',
        eventData: {
          tab: tabName,
        },
      });
      delete debounceTimers.current[key];
    }, 500); // 500ms debounce
  }, [trackEvent]);

  // Track feature interaction with debouncing
  const trackFeatureInteraction = useCallback((featureName: string, metadata?: Record<string, any>) => {
    const key = `feature_${featureName}`;

    // Clear existing timer
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Set new timer
    debounceTimers.current[key] = setTimeout(() => {
      trackEvent({
        eventType: 'feature_interaction',
        eventData: {
          feature: featureName,
          metadata,
        },
      });
      delete debounceTimers.current[key];
    }, 1000); // 1s debounce for feature interactions
  }, [trackEvent]);

  // Track AI query
  const trackAIQuery = useCallback((query: string, tokensUsed?: number, model?: string, responseTime?: number) => {
    trackEvent({
      eventType: 'ai_query',
      eventData: {
        aiQuery: query.substring(0, 100), // Truncate to first 100 chars
        aiTokensUsed: tokensUsed,
        aiModel: model,
        aiResponseTime: responseTime,
      },
    });
  }, [trackEvent]);

  // Track logout
  const trackLogout = useCallback(() => {
    trackEvent({
      eventType: 'logout',
      eventData: {},
    });
  }, [trackEvent]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return {
    trackTabSwitch,
    trackFeatureInteraction,
    trackAIQuery,
    trackLogout,
    trackEvent,
  };
}
