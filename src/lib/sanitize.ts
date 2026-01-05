/**
 * Input Sanitization Utilities
 * Protects against XSS attacks by sanitizing user input
 * 
 * Uses lazy loading to avoid ESM/CommonJS conflicts in serverless environments
 */

// Lazy load DOMPurify to avoid ESM/CommonJS conflicts in serverless environments
let DOMPurifyInstance: any = null;

async function getDOMPurify() {
  if (!DOMPurifyInstance) {
    // In browser, try to load synchronously first (works fine there)
    if (typeof window !== 'undefined') {
      try {
        const DOMPurify = require('isomorphic-dompurify').default;
        DOMPurifyInstance = DOMPurify;
        return DOMPurifyInstance;
      } catch {
        // Fall through to async import
      }
    }
    // In serverless/server, use dynamic import
    const DOMPurify = (await import('isomorphic-dompurify')).default;
    DOMPurifyInstance = DOMPurify;
  }
  return DOMPurifyInstance;
}

// Sync version for browser use (only works in browser)
function getDOMPurifySync() {
  if (typeof window === 'undefined') {
    throw new Error('getDOMPurifySync can only be used in browser environment');
  }
  if (!DOMPurifyInstance) {
    DOMPurifyInstance = require('isomorphic-dompurify').default;
  }
  return DOMPurifyInstance;
}

/**
 * Sanitize text by stripping all HTML tags
 * Use for plain text fields that should not contain HTML
 */
export async function sanitizeText(text: string): Promise<string> {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const DOMPurify = await getDOMPurify();
  // Strip all HTML and return plain text
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize HTML content, allowing safe HTML tags
 * Use for content that may contain formatting (e.g., DOCX converted to HTML)
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (!html || typeof html !== 'string') {
    return '';
  }
  const DOMPurify = await getDOMPurify();
  // Allow safe HTML tags but sanitize dangerous content
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize content for display in UI
 * Strips all HTML and returns plain text safe for rendering
 */
export async function sanitizeForDisplay(content: string): Promise<string> {
  if (!content || typeof content !== 'string') {
    return '';
  }
  return sanitizeText(content);
}

/**
 * Sanitize user input before storing in database
 * Ensures no malicious scripts are stored
 */
export async function sanitizeForStorage(input: string): Promise<string> {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Strip HTML and trim whitespace
  const sanitized = await sanitizeText(input);
  return sanitized.trim();
}

/**
 * Sync version for browser use only
 * Use this in client components that need synchronous sanitization
 */
export function sanitizeForStorageSync(input: string): string {
  if (typeof window === 'undefined') {
    throw new Error('sanitizeForStorageSync can only be used in browser environment. Use sanitizeForStorage in server code.');
  }
  if (!input || typeof input !== 'string') {
    return '';
  }
  const DOMPurify = getDOMPurifySync();
  const sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  return sanitized.trim();
}

/**
 * Sync version for browser use only
 */
export function sanitizeForDisplaySync(content: string): string {
  if (typeof window === 'undefined') {
    throw new Error('sanitizeForDisplaySync can only be used in browser environment. Use sanitizeForDisplay in server code.');
  }
  if (!content || typeof content !== 'string') {
    return '';
  }
  return sanitizeForStorageSync(content);
}

/**
 * Sync version for browser use only
 */
export function sanitizeHtmlSync(html: string): string {
  if (typeof window === 'undefined') {
    throw new Error('sanitizeHtmlSync can only be used in browser environment. Use sanitizeHtml in server code.');
  }
  if (!html || typeof html !== 'string') {
    return '';
  }
  const DOMPurify = getDOMPurifySync();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: [],
  });
}

