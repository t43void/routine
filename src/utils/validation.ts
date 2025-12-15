/**
 * Security validation utilities following OWASP Top 10 best practices
 */

// Input length limits (prevent DoS attacks)
export const MAX_LENGTHS = {
  USERNAME: 50,
  EMAIL: 255,
  PASSWORD: 128,
  TITLE: 200,
  DESCRIPTION: 5000,
  QUOTE: 1000,
  AUTHOR: 100,
  CHALLENGE_TITLE: 200,
  CHALLENGE_DESCRIPTION: 2000,
} as const;

// Numeric limits
export const NUMERIC_LIMITS = {
  HOURS_WORKED: { min: 0.01, max: 24 },
  TARGET_HOURS: { min: 0.01, max: 24 },
  TARGET_VALUE: { min: 1, max: 1000000 },
} as const;

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters but allow markdown
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > MAX_LENGTHS.EMAIL) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength (OWASP recommendations)
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (password.length > MAX_LENGTHS.PASSWORD) {
    errors.push(`Password must be less than ${MAX_LENGTHS.PASSWORD} characters`);
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123'];
  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate username
 */
export function validateUsername(username: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
    return { valid: false, errors };
  }
  
  const trimmed = username.trim();
  
  if (trimmed.length < 3) {
    errors.push('Username must be at least 3 characters');
  }
  
  if (trimmed.length > MAX_LENGTHS.USERNAME) {
    errors.push(`Username must be less than ${MAX_LENGTHS.USERNAME} characters`);
  }
  
  // Only allow alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate hours worked
 */
export function validateHours(hours: number | string): {
  valid: boolean;
  value: number | null;
  error: string | null;
} {
  const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
  
  if (isNaN(numHours)) {
    return { valid: false, value: null, error: 'Hours must be a valid number' };
  }
  
  if (numHours < NUMERIC_LIMITS.HOURS_WORKED.min) {
    return {
      valid: false,
      value: null,
      error: `Hours must be at least ${NUMERIC_LIMITS.HOURS_WORKED.min}`,
    };
  }
  
  if (numHours > NUMERIC_LIMITS.HOURS_WORKED.max) {
    return {
      valid: false,
      value: null,
      error: `Hours cannot exceed ${NUMERIC_LIMITS.HOURS_WORKED.max} per day`,
    };
  }
  
  // Round to 2 decimal places
  const rounded = Math.round(numHours * 100) / 100;
  
  return { valid: true, value: rounded, error: null };
}

/**
 * Validate and sanitize text input
 */
export function validateText(
  text: string,
  fieldName: string,
  maxLength: number,
  required = false
): {
  valid: boolean;
  value: string | null;
  error: string | null;
} {
  if (!text && required) {
    return { valid: false, value: null, error: `${fieldName} is required` };
  }
  
  if (!text) {
    return { valid: true, value: '', error: null };
  }
  
  if (text.length > maxLength) {
    return {
      valid: false,
      value: null,
      error: `${fieldName} must be less than ${maxLength} characters`,
    };
  }
  
  const sanitized = sanitizeInput(text);
  
  return { valid: true, value: sanitized, error: null };
}

/**
 * Validate UUID format (prevent injection)
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get or create a session identifier
 * This persists for the browser session only
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('rate_limit_session_id');
  if (!sessionId) {
    // Generate a unique session ID
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('rate_limit_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Rate limiting helper (client-side check, per session)
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  isAllowed(identifier?: string): boolean {
    // Use session ID if no identifier provided, or combine with identifier
    const sessionId = getSessionId();
    const key = identifier ? `${sessionId}_${identifier}` : sessionId;
    
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true;
  }
  
  reset(identifier?: string): void {
    const sessionId = getSessionId();
    const key = identifier ? `${sessionId}_${identifier}` : sessionId;
    this.requests.delete(key);
  }
  
  // Reset all requests for the current session
  resetSession(): void {
    const sessionId = getSessionId();
    const keysToDelete: string[] = [];
    this.requests.forEach((_, key) => {
      if (key.startsWith(sessionId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.requests.delete(key));
  }
}

// Export rate limiters for different operations
export const rateLimiters = {
  signUp: new RateLimiter(3, 15 * 60 * 1000), // 3 signups per 15 minutes
  signIn: new RateLimiter(5, 15 * 60 * 1000), // 5 signins per 15 minutes
  logCreation: new RateLimiter(10, 60 * 1000), // 10 logs per minute
  friendRequest: new RateLimiter(5, 60 * 1000), // 5 requests per minute
};

