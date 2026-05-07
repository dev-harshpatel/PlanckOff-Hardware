import type { AppError } from './index';

/**
 * Error registry for PDF and Excel export operations.
 */
export const PDF_ERRORS = {
  EXPORT_FAILED: {
    code: 'PDF_EXPORT_FAILED',
    message: 'Export failed.',
    action: 'Please try again.',
  },
  DOOR_SCHEDULE_EXPORT_FAILED: {
    code: 'PDF_DOOR_SCHEDULE_EXPORT_FAILED',
    message: 'Failed to export the Door Schedule.',
    action: 'Please try again.',
  },
  HARDWARE_SET_EXPORT_FAILED: {
    code: 'PDF_HARDWARE_SET_EXPORT_FAILED',
    message: 'Failed to export the Hardware Set report.',
    action: 'Please try again.',
  },
  SUBMITTAL_EXPORT_FAILED: {
    code: 'PDF_SUBMITTAL_EXPORT_FAILED',
    message: 'Failed to export the Submittal Package.',
    action: 'Please try again.',
  },
  PARSE_FAILED: {
    code: 'PDF_PARSE_FAILED',
    message: 'Failed to read the PDF file.',
    action: 'Make sure the file is a valid PDF and try again.',
  },
} as const satisfies Record<string, AppError>;
