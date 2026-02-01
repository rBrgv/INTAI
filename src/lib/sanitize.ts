/**
 * Input Sanitization Utilities
 * Protects against XSS attacks by sanitizing user input
 */

// DOMPurify is loaded dynamically to avoid server-side bundling issues with jsdom
// import DOMPurify from 'isomorphic-dompurify'; 

/**
 * Sanitize text by stripping all HTML tags
 * Use for plain text fields that should not contain HTML
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  // Strip all HTML tags using regex (lighter than dompurify for server usage)
  return text.replace(/<[^>]*>?/gm, '');
}

/**
 * Sanitize HTML content, allowing safe HTML tags
 * Use for content that may contain formatting (e.g., DOCX converted to HTML)
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (!html || typeof html !== 'string') {
    return '';
  }
  // Dynamic import to avoid ESM/jsdom issues on server start
  const DOMPurify = (await import('isomorphic-dompurify')).default;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize content for display in UI
 * Strips all HTML and returns plain text safe for rendering
 */
export function sanitizeForDisplay(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  return sanitizeText(content);
}

/**
 * Sanitize user input before storing in database
 * Ensures no malicious scripts are stored
 */
export function sanitizeForStorage(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Strip HTML and trim whitespace
  return sanitizeText(input).trim();
}

