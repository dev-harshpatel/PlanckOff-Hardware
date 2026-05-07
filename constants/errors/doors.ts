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
