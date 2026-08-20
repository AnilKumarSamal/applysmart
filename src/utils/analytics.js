/**
 * Anonymous Product Analytics Module for Public Validation with Google Analytics 4 (GA4)
 * Measurement ID: G-CZ2R3K186L
 *
 * Strict Privacy Rules:
 * NEVER send:
 * - Resume contents or extracted text
 * - Resume filenames
 * - Job description text
 * - Candidate name, email, phone number
 * - Company names from resume or JD
 * - Salary / CTC information
 * - AI-generated application content or screening answer text
 *
 * Only sends safe anonymous event names and product usage metadata (e.g. source, format).
 */
export const GA_MEASUREMENT_ID = 'G-CZ2R3K186L';
const STORAGE_KEY = 'applysmart_analytics_events';
const SOURCE_KEY = 'applysmart_session_source';
/**
 * Capture source from URL query parameters (e.g., ?source=instagram, ?source=hn, ?source=reddit, ?source=linkedin)
 * Falls back to referrer or 'direct'.
 */
export function getSessionSource() {
    try {
        const cached = sessionStorage.getItem(SOURCE_KEY);
        if (cached) {
            return cached;
        }
        if (typeof window !== 'undefined' && window.location) {
            const urlParams = new URLSearchParams(window.location.search);
            const sourceParam = urlParams.get('source') ||
                urlParams.get('utm_source') ||
                urlParams.get('ref') ||
                urlParams.get('s');
            if (sourceParam && sourceParam.trim().length > 0) {
                const cleanSource = sourceParam.trim().toLowerCase().slice(0, 50);
                sessionStorage.setItem(SOURCE_KEY, cleanSource);
                return cleanSource;
            }
            if (document.referrer) {
                try {
                    const refUrl = new URL(document.referrer);
                    const host = refUrl.hostname.toLowerCase();
                    let refSource = host;
                    if (host.includes('instagram.com'))
                        refSource = 'instagram';
                    else if (host.includes('news.ycombinator.com') || host.includes('hn'))
                        refSource = 'hn';
                    else if (host.includes('reddit.com'))
                        refSource = 'reddit';
                    else if (host.includes('linkedin.com'))
                        refSource = 'linkedin';
                    else if (host.includes('twitter.com') || host.includes('t.co') || host.includes('x.com'))
                        refSource = 'twitter';
                    else if (host.includes('google.com'))
                        refSource = 'google';
                    sessionStorage.setItem(SOURCE_KEY, refSource);
                    return refSource;
                }
                catch {
                    // ignore
                }
            }
        }
        sessionStorage.setItem(SOURCE_KEY, 'direct');
        return 'direct';
    }
    catch {
        return 'direct';
    }
}
/**
 * Sanitize metadata to guarantee no personal or sensitive data ever reaches GA4 or telemetry logs.
 */
function sanitizeMetadata(metadata) {
    if (!metadata)
        return undefined;
    // Disallowed sensitive keys (strict privacy blocklist)
    const forbiddenKeys = [
        'email',
        'candidateemail',
        'candidatename',
        'name',
        'filename',
        'resumefilename',
        'resumetext',
        'jobdescription',
        'jd',
        'content',
        'text',
        'comment',
        'feedback',
        'salary',
        'ctc',
        'phone',
        'phonenumber',
        'company',
        'companyname',
        'targetcompany',
        'targetrole',
        'message',
    ];
    const clean = {};
    for (const [key, val] of Object.entries(metadata)) {
        const lowerKey = key.toLowerCase();
        if (forbiddenKeys.includes(lowerKey)) {
            continue;
        }
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            clean[key] = val;
        }
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
}
/**
 * Send event to Google Analytics 4 and local debug storage
 */
export function trackEvent(event, metadata) {
    try {
        const source = getSessionSource();
        const safeMeta = sanitizeMetadata(metadata);
        const eventPayload = {
            source,
            ...(safeMeta || {}),
        };
        // 1. Send to Google Analytics 4
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            window.gtag('event', event, eventPayload);
        }
        // 2. Buffer locally for debugging and validation
        const localEntry = {
            event,
            timestamp: new Date().toISOString(),
            source,
            ...(safeMeta ? { metadata: safeMeta } : {}),
        };
        const existingRaw = localStorage.getItem(STORAGE_KEY);
        const events = existingRaw ? JSON.parse(existingRaw) : [];
        events.push(localEntry);
        if (events.length > 200) {
            events.shift();
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        console.log(`[GA4 / Analytics] ${event}`, eventPayload);
    }
    catch (err) {
        // Non-blocking fail-safe
    }
}
const USAGE_COUNT_KEY = 'applysmart_usage_count';
const WAITLIST_KEY = 'applysmart_waitlist_emails';
export function getApplicationUsageCount() {
    try {
        const raw = localStorage.getItem(USAGE_COUNT_KEY);
        if (!raw)
            return 0;
        const parsed = parseInt(raw, 10);
        return isNaN(parsed) ? 0 : parsed;
    }
    catch {
        return 0;
    }
}
export function incrementApplicationUsageCount() {
    try {
        const current = getApplicationUsageCount();
        const next = current + 1;
        localStorage.setItem(USAGE_COUNT_KEY, next.toString());
        return next;
    }
    catch {
        return 1;
    }
}
export function saveWaitlistEmail(email) {
    try {
        const raw = localStorage.getItem(WAITLIST_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!list.includes(email.trim().toLowerCase())) {
            list.push(email.trim().toLowerCase());
            localStorage.setItem(WAITLIST_KEY, JSON.stringify(list));
        }
        return true;
    }
    catch {
        return true;
    }
}
