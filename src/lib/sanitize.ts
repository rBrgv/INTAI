/**
 * Input Sanitization Utilities
 * Protects against XSS attacks by sanitizing user input
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize text by stripping all HTML tags
 * Use for plain text fields that should not contain HTML
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  // Strip all HTML and return plain text
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize HTML content, allowing safe HTML tags
 * Use for content that may contain formatting (e.g., DOCX converted to HTML)
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
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

