import type { AppError } from './index';

/**
 * Error registry for hardware set CRUD, file upload, AI extraction, and processing.
 */
export const HARDWARE_ERRORS = {
  UPLOAD_FAILED: {
    code: 'HW_UPLOAD_FAILED',
    message: 'Upload failed.',
    action: 'Please try again.',
  },
  HARDWARE_PDF_FAILED: {
    code: 'HW_HARDWARE_PDF_FAILED',
    message: 'Hardware PDF upload failed.',
    action: 'Please try again.',
  },
  DOOR_SCHEDULE_FAILED: {
    code: 'HW_DOOR_SCHEDULE_FAILED',
    message: 'Door schedule upload failed.',
    action: 'Please try again.',
  },
  PDF_FILE_REQUIRED: {
    code: 'HW_PDF_FILE_REQUIRED',
    message: 'Please upload a PDF file for hardware sets.',
  },
  SERVER_ERROR: {
    code: 'HW_SERVER_ERROR',
    message: 'A server error occurred.',
    action: 'The request may have timed out. Please try again.',
  },
  PROCESSING_FAILED: {
    code: 'HW_PROCESSING_FAILED',
    message: 'File processing failed.',
    action: 'Please try again.',
  },
  ASSIGNMENT_FAILED: {
    code: 'HW_ASSIGNMENT_FAILED',
    message: 'Assignment failed.',
    action: 'Make sure both the hardware PDF and door schedule are uploaded.',
  },
  INVALID_RESPONSE: {
    code: 'HW_INVALID_RESPONSE',
    message: 'Server returned an invalid response.',
    action: 'Please try again.',
  },
  PREP_GENERATION_FAILED: {
    code: 'HW_PREP_GENERATION_FAILED',
    message: 'Prep generation failed.',
    action: 'Please try again.',
  },
  NO_PREP_DATA: {
    code: 'HW_NO_PREP_DATA',
    message: 'Server did not return prep data.',
    action: 'Please try again.',
  },
  DOCX_LIBRARY_MISSING: {
    code: 'HW_DOCX_LIBRARY_MISSING',
    message: 'The Word document processing library is not loaded.',
    action: 'Please refresh the page and try again.',
  },
  DOCX_READ_FAILED: {
    code: 'HW_DOCX_READ_FAILED',
    message: 'Could not read the provided Word document.',
    action: 'Make sure the file is a valid .docx file.',
  },
  TIMEOUT: {
    code: 'HW_TIMEOUT',
    message: 'File processing timed out.',
    action: 'Please try uploading again.',
  },
} as const satisfies Record<string, AppError>;
