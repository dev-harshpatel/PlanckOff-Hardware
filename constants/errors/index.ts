/**
 * AppError — shape for every entry in the error registry.
 * `code`    — machine-readable identifier (SCREAMING_SNAKE_CASE, domain-prefixed)
 * `message` — user-facing sentence shown in toasts and ErrorDisplay
 * `action`  — optional follow-up hint shown as secondary text
 */
export interface AppError {
  code: string;
  message: string;
  action?: string;
}

export { AUTH_ERRORS } from './auth';
export { DOOR_ERRORS } from './doors';
export { HARDWARE_ERRORS } from './hardware';
export { PDF_ERRORS } from './pdf';
export { GENERAL_ERRORS } from './general';

import { AUTH_ERRORS } from './auth';
import { DOOR_ERRORS } from './doors';
import { HARDWARE_ERRORS } from './hardware';
import { PDF_ERRORS } from './pdf';
import { GENERAL_ERRORS } from './general';

/**
 * Convenience namespace. Import as `import { ERRORS } from '@/constants/errors'`
 * then reference as `ERRORS.AUTH.INVALID_CREDENTIALS`, `ERRORS.DOORS.CSV_EMPTY`, etc.
 */
export const ERRORS = {
  AUTH: AUTH_ERRORS,
  DOORS: DOOR_ERRORS,
  HARDWARE: HARDWARE_ERRORS,
  PDF: PDF_ERRORS,
  GENERAL: GENERAL_ERRORS,
} as const;
