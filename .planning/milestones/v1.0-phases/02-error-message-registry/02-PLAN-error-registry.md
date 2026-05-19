# Plan: Create Error Registry (constants/errors/)

**Phase:** 2 — Error Message Registry
**Goal:** Create the single source of truth for all user-facing error strings as five typed domain files plus a barrel export under `constants/errors/`.
**Requirements:** ERR-01, ERR-07
**Dependencies:** none

---

## Context

**Files to read before starting:**
- `F:\PlanckOff-Hardware\constants\auth.ts` — the `as const` pattern and export style to replicate exactly
- `F:\PlanckOff-Hardware\.planning\phases\02-error-message-registry\02-RESEARCH.md` — section 1 (domain audits) lists every string that must be covered; section 6 has the recommended `AppError` type and registry shape

**Key constraints:**
- Use `as const satisfies Record<string, AppError>` on every registry object (TypeScript 5.8.2 supports this)
- `AppError` interface goes in `constants/errors/index.ts` only — domain files import `type { AppError }` from `./index`
- Domain files use named exports only — no `export default`
- `index.ts` re-exports the `AppError` type, all domain registries by name, AND assembles the convenience `ERRORS` namespace object
- Code prefix convention: `AUTH_`, `DOOR_`, `HW_`, `PDF_`, `GEN_` (SCREAMING_SNAKE_CASE)
- 2-space indentation, single quotes, trailing commas — matches new codebase standard
- JSDoc comment on each exported constant explaining its domain
- `index.ts` is barrel-only — no logic

---

## Tasks

### Task 1: Create `constants/errors/index.ts` — AppError type + barrel

Create `F:\PlanckOff-Hardware\constants\errors\index.ts` with the following exact content:

```typescript
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
```

### Task 2: Create domain files — `auth.ts`, `general.ts`, `pdf.ts`

**`F:\PlanckOff-Hardware\constants\errors\auth.ts`**

Cover the strings identified in RESEARCH.md section 1a. Every string currently returned by `AuthContext.login()` and shown on the login form must have an entry:

```typescript
import type { AppError } from './index';

/**
 * Error registry for authentication flows — login, session, and access control.
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
    action: 'Check your credentials and try again.',
  },
  NETWORK_ERROR: {
    code: 'AUTH_NETWORK_ERROR',
    message: 'Network error. Please check your connection.',
    action: 'Try again in a moment.',
  },
  SESSION_FAILED: {
    code: 'AUTH_SESSION_FAILED',
    message: 'Sign-in failed. Please try again.',
  },
  LOGIN_FAILED: {
    code: 'AUTH_LOGIN_FAILED',
    message: 'Login failed.',
    action: 'Please try again.',
  },
  ACCESS_DENIED: {
    code: 'AUTH_ACCESS_DENIED',
    message: 'You do not have permission to access this page.',
  },
  SET_PASSWORD_FAILED: {
    code: 'AUTH_SET_PASSWORD_FAILED',
    message: 'Failed to set your password.',
    action: 'Please try again or contact your administrator.',
  },
  INVITE_FAILED: {
    code: 'AUTH_INVITE_FAILED',
    message: 'Failed to send the invitation.',
    action: 'Please try again.',
  },
  RESEND_INVITE_FAILED: {
    code: 'AUTH_RESEND_INVITE_FAILED',
    message: 'Failed to resend the invitation.',
    action: 'Please try again.',
  },
} as const satisfies Record<string, AppError>;
```

**`F:\PlanckOff-Hardware\constants\errors\general.ts`**

Cover generic fallbacks and shared patterns (network errors, validation, unknown). Used by ErrorBoundary and any catch-all handlers:

```typescript
import type { AppError } from './index';

/**
 * Error registry for generic / cross-domain error conditions.
 * Use GENERAL_ERRORS.UNEXPECTED as the catch-all fallback.
 */
export const GENERAL_ERRORS = {
  UNEXPECTED: {
    code: 'GEN_UNEXPECTED',
    message: 'Something went wrong.',
    action: 'Please reload the page or try again.',
  },
  NETWORK: {
    code: 'GEN_NETWORK',
    message: 'Network error. Please check your connection.',
    action: 'Try again in a moment.',
  },
  SERVER: {
    code: 'GEN_SERVER',
    message: 'A server error occurred.',
    action: 'Please try again. If the problem persists, contact support.',
  },
  UNAUTHORIZED: {
    code: 'GEN_UNAUTHORIZED',
    message: 'You are not authorised to perform this action.',
  },
  NOT_FOUND: {
    code: 'GEN_NOT_FOUND',
    message: 'The requested resource could not be found.',
  },
  REQUIRED_FIELD: {
    code: 'GEN_REQUIRED_FIELD',
    message: 'Please fill in all required fields.',
  },
  SAVE_FAILED: {
    code: 'GEN_SAVE_FAILED',
    message: 'Save failed.',
    action: 'Please try again.',
  },
  TIMEOUT: {
    code: 'GEN_TIMEOUT',
    message: 'The request timed out.',
    action: 'Please try again.',
  },
} as const satisfies Record<string, AppError>;
```

**`F:\PlanckOff-Hardware\constants\errors\pdf.ts`**

Cover export failures from RESEARCH.md section 1e:

```typescript
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
```

### Task 3: Create domain files — `doors.ts`, `hardware.ts`

**`F:\PlanckOff-Hardware\constants\errors\doors.ts`**

Cover every throw string from `DatabaseView.tsx`, `csvParser.ts`, and `xlsxParser.ts` identified in RESEARCH.md section 1c. Duplicate strings (e.g., "CSV file must contain a header row" appears twice) become one entry:

```typescript
import type { AppError } from './index';

/**
 * Error registry for door schedule CRUD, import, and validation operations.
 */
export const DOOR_ERRORS = {
  LOAD_FAILED: {
    code: 'DOOR_LOAD_FAILED',
    message: 'Failed to load the door database.',
    action: 'Please refresh the page.',
  },
  UPDATE_FAILED: {
    code: 'DOOR_UPDATE_FAILED',
    message: 'Failed to update the door.',
    action: 'Please try again.',
  },
  CREATE_FAILED: {
    code: 'DOOR_CREATE_FAILED',
    message: 'Failed to create the door.',
    action: 'Please try again.',
  },
  DELETE_FAILED: {
    code: 'DOOR_DELETE_FAILED',
    message: 'Failed to delete the door.',
    action: 'Please try again.',
  },
  REVIEW_FAILED: {
    code: 'DOOR_REVIEW_FAILED',
    message: 'Failed to review the door.',
    action: 'Please try again.',
  },
  COLUMN_NAME_REQUIRED: {
    code: 'DOOR_COLUMN_NAME_REQUIRED',
    message: 'Please enter a column name.',
  },
  CSV_EMPTY: {
    code: 'DOOR_CSV_EMPTY',
    message: 'CSV file must contain a header row and at least one data row.',
  },
  CSV_MISSING_COLUMNS: {
    code: 'DOOR_CSV_MISSING_COLUMNS',
    message: 'CSV is missing required columns.',
    action: 'Check that your file includes all mandatory column headers.',
  },
  CSV_NO_VALID_DATA: {
    code: 'DOOR_CSV_NO_VALID_DATA',
    message: 'Could not parse any valid door data from the CSV.',
    action: 'Check that the file format is correct and try again.',
  },
  CSV_MISSING_SET_NAME: {
    code: 'DOOR_CSV_MISSING_SET_NAME',
    message: 'CSV is missing the required "Set Name" column.',
  },
  EXCEL_EMPTY: {
    code: 'DOOR_EXCEL_EMPTY',
    message: 'Excel file appears to be empty or in an unsupported format.',
  },
  EXCEL_MISSING_COLUMNS: {
    code: 'DOOR_EXCEL_MISSING_COLUMNS',
    message: 'Excel file is missing required columns.',
    action: 'Check that your file includes all mandatory column headers.',
  },
  EXCEL_NO_VALID_DATA: {
    code: 'DOOR_EXCEL_NO_VALID_DATA',
    message: 'Could not parse any valid door data from the Excel file.',
    action: 'Check that the file format is correct and try again.',
  },
  EXCEL_NO_HARDWARE_SETS: {
    code: 'DOOR_EXCEL_NO_HARDWARE_SETS',
    message: 'Could not find any valid hardware sets in the Excel file.',
  },
} as const satisfies Record<string, AppError>;
```

**`F:\PlanckOff-Hardware\constants\errors\hardware.ts`**

Cover every string from `useProjectUploads.ts`, `useHardwareSetsManager.ts`, `docxParser.ts`, and `useProjectData.ts` identified in RESEARCH.md section 1d:

```typescript
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
```

---

## Verification

- [ ] `constants/errors/` directory contains exactly 6 files: `index.ts`, `auth.ts`, `doors.ts`, `hardware.ts`, `pdf.ts`, `general.ts`
- [ ] TypeScript compiler accepts every domain file: run `npx tsc --noEmit` from the project root — no new errors introduced
- [ ] `import { ERRORS } from '@/constants/errors'` resolves and `ERRORS.AUTH.INVALID_CREDENTIALS.message` is the string `'Invalid email or password.'`
- [ ] Every domain file exports its registry with the correct name (`AUTH_ERRORS`, `DOOR_ERRORS`, `HARDWARE_ERRORS`, `PDF_ERRORS`, `GENERAL_ERRORS`)
- [ ] No `export default` in any of the 6 files
- [ ] All entries in each domain registry map to a string identified in RESEARCH.md section 1 (no invented codes)
