import { ZodError } from 'zod';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility function to check if a value is valid (non-null, non-undefined, non-empty, and non-whitespace).
 * Also excludes NaN.
 * @param value - The value to validate.
 * @returns `true` if the value is valid; otherwise, `false`.
 */
export function isValidValue(
  value: string | number | boolean | object | null | undefined | unknown | unknown[]
): boolean {
  // Check for null or undefined
  if (value == null) return false;

  // Check for NaN (only applicable to numbers)
  if (typeof value === 'number' && isNaN(value)) return false;

  // Check for empty string or string with only whitespace
  if (typeof value === 'string' && value.trim() === '') return false;

  // Check for empty array
  if (Array.isArray(value) && value.length === 0) return false;

  // Check for empty object
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
    return false;

  // If all checks pass, the value is considered valid
  return true;
}

export function log(
  message: string,
  data?: unknown,
  level: 'debug' | 'info' | 'warn' | 'error' = 'debug'
): void {
  console[level](message, data ? JSON.stringify(data) : '');
}

export function generateRandomString(length: number = 4): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

export function sanitizeWithKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Centralized provider credentials lookup
export function getEnvVar(name: string, defaultValue?: string): string {
  const v = process.env[name];
  if (!v) return defaultValue ?? '';
  return v;
}

export function getZodErrorMessage(error: ZodError): string {
  return JSON.parse(error.message)
    .map((err: { path: string[]; message: string }) => `Field ${err.path.join('.')} ${err.message}`)
    .join(', \n');
}

// Export API fetch utilities
export { apiFetch, apiFetchPaginated } from './api-fetch';
