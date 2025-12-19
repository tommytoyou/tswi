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
  const statusRef = useRef(status);
  const hasTrackedLogin = useRef(false);

  // Initialize session ID synchronously on first render
  if (typeof window !== 'undefined' && !sessionId.current) {
    sessionId.current = getOrCreateSessionId();
    console.log('[ActivityTracker] Initialized sessionId:', sessionId.current);
  }

  // Keep status ref updated
  useEffect(() => {
    statusRef.current = status;
    console.log('[ActivityTracker] Status changed:', status);
  }, [status]);

  // Track event function - defined BEFORE effects that use it
  const trackEvent = useCallback(async (options: TrackEventOptions) => {
    console.log('[ActivityTracker] trackEvent called:', options.eventType, 'status:', statusRef.current, 'sessionId:', sessionId.current);

    // Only track if authenticated (use ref to avoid stale closure)
    if (statusRef.current !== 'authenticated' || !sessionId.current) {
      console.log('[ActivityTracker] Skipping - not authenticated or no sessionId');
      return;
    }

    try {
      console.log('[ActivityTracker] Sending request to /api/activity/track');
      const response = await fetch('/api/activity/track', {
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
      const data = await response.json();
      console.log('[ActivityTracker] Response:', response.status, data);
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.error('[ActivityTracker] Failed to track activity:', error);
    }
  }, []);

  // Track session start (login) - only once per session
  useEffect(() => {
    console.log('[ActivityTracker] Login effect - status:', status, 'session:', !!session, 'hasTrackedLogin:', hasTrackedLogin.current);
    if (status === 'authenticated' && session && !hasTrackedLogin.current) {
      hasTrackedLogin.current = true;
      console.log('[ActivityTracker] Triggering login event');
      trackEvent({
        eventType: 'login',
        eventData: {},
      });
    }
  }, [status, session, trackEvent]);

  // Track page views
  useEffect(() => {
    console.log('[ActivityTracker] Page view effect - status:', status, 'pathname:', pathname, 'lastTracked:', lastTrackedPage.current);
    if (status === 'authenticated' && pathname && pathname !== lastTrackedPage.current) {
      lastTrackedPage.current = pathname;
      console.log('[ActivityTracker] Triggering page_view event for:', pathname);
      trackEvent({
        eventType: 'page_view',
        eventData: {
          page: pathname,
        },
      });
    }
  }, [pathname, status, trackEvent]);

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
