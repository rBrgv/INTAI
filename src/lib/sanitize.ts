/**
 * Input Sanitization Utilities
 * Protects against XSS attacks by sanitizing user input
 * 
 * Uses lazy loading to avoid ESM/CommonJS conflicts in serverless environments
 */

// Lazy load DOMPurify to avoid ESM/CommonJS conflicts in serverless environments
let DOMPurifyInstance: any = null;

// Simple regex-based sanitization for server-side (avoids ESM/CommonJS conflicts)
function simpleSanitize(text: string, allowedTags: string[] = []): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove all HTML tags if no allowed tags specified
  if (allowedTags.length === 0) {
    return text.replace(/<[^>]*>/g, '').trim();
  }
  
  // For allowed tags, we'll just strip script tags and dangerous attributes
  // This is a simplified version - for full sanitization, use DOMPurify in browser
  let sanitized = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
  
  return sanitized.trim();
}

async function getDOMPurify() {
  // In serverless environments, don't use DOMPurify - use simple sanitization
  if (typeof window === 'undefined') {
    return {
      sanitize: (text: string, options: any = {}) => {
        return simpleSanitize(text, options.ALLOWED_TAGS || []);
      }
    };
  }
  
  // In browser, use DOMPurify
  if (!DOMPurifyInstance) {
    try {
      const DOMPurify = (await import('isomorphic-dompurify')).default;
      DOMPurifyInstance = DOMPurify;
    } catch (error) {
      // Fallback to simple sanitization
      return {
        sanitize: (text: string, options: any = {}) => {
          return simpleSanitize(text, options.ALLOWED_TAGS || []);
        }
      };
    }
  }
  return DOMPurifyInstance;
}

// Sync version for browser use (only works in browser)
// Uses simple sanitization as fallback since DOMPurify requires async loading
function getDOMPurifySync() {
  if (typeof window === 'undefined') {
    throw new Error('getDOMPurifySync can only be used in browser environment');
  }
  
  // For client-side, use simple sanitization to avoid async loading issues
  // This is safe for display purposes and avoids ESM/CommonJS conflicts
  const sanitizer = {
    sanitize: (text: string, options: any = {}) => {
      if (!text || typeof text !== 'string') return '';
      
      // Use simple regex-based sanitization
      let sanitized = text;
      
      // Remove all HTML tags if no allowed tags specified
      if (!options.ALLOWED_TAGS || options.ALLOWED_TAGS.length === 0) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } else {
        // Remove script tags and dangerous attributes
        sanitized = sanitized
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+="[^"]*"/gi, '')
          .replace(/on\w+='[^']*'/gi, '')
          .replace(/javascript:/gi, '');
      }
      
      return sanitized;
    }
  };
  
  // Ensure we always return a valid object
  if (!sanitizer || typeof sanitizer.sanitize !== 'function') {
    throw new Error('Failed to initialize sanitizer');
  }
  
  return sanitizer;
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
  try {
    const DOMPurify = getDOMPurifySync();
    if (!DOMPurify || typeof DOMPurify.sanitize !== 'function') {
      // Fallback to simple sanitization
      return input.replace(/<[^>]*>/g, '').trim();
    }
    const sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    return sanitized.trim();
  } catch (error) {
    // Fallback to simple sanitization if DOMPurify fails
    console.warn('DOMPurify sanitization failed, using fallback:', error);
    return input.replace(/<[^>]*>/g, '').trim();
  }
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
  try {
    return sanitizeForStorageSync(content);
  } catch (error) {
    // Fallback to simple sanitization
    console.warn('Sanitization failed, using fallback:', error);
    return content.replace(/<[^>]*>/g, '').trim();
  }
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
  try {
    const DOMPurify = getDOMPurifySync();
    if (!DOMPurify || typeof DOMPurify.sanitize !== 'function') {
      // Fallback to simple sanitization
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');
    }
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: [],
    });
  } catch (error) {
    // Fallback to simple sanitization if DOMPurify fails
    console.warn('DOMPurify HTML sanitization failed, using fallback:', error);
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }
}

