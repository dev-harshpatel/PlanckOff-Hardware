/**
 * JSON schemas for structured output (OpenAI-format json_schema).
 *
 * Wrapped in an object (not top-level array) because OpenAI-format json_schema
 * response_format requires the root to be an object.
 * Kept flat — no $ref, no anyOf — for Gemini via OpenRouter compatibility.
 */

export const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sets'],
  properties: {
    sets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['setName', 'hardwareItems'],
        properties: {
          setName: {
            type: 'string',
            description: 'Hardware set identifier. Named codes: "AD01b", "SE02a.W", "CA01". Simple numbers: "1", "2", "3". NEVER include column header text — output only the identifier value, never "SET DOOR TYPE 1" or "SET 1", just "1".',
          },
          hardwareItems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['qty', 'item', 'manufacturer', 'description', 'finish'],
              properties: {
                qty:          { type: 'integer' },
                item:         { type: 'string' },
                manufacturer: { type: 'string' },
                description:  { type: 'string' },
                finish:       { type: 'string' },
              },
            },
          },
          notes: {
            type: 'string',
            description: 'Any notes or special instructions for this hardware set',
          },
        },
      },
    },
  },
};

// Schema for the dedicated matrix/checkbox transcription call (Format F).
export const MATRIX_SCHEMA = {
  type: 'object',
  required: ['isMatrix', 'doorNumbers', 'valueRows', 'checkboxRows', 'columnNotes', 'products'],
  properties: {
    isMatrix: {
      type: 'boolean',
      description: 'true ONLY if at least one image is a matrix/checkbox door hardware schedule: door numbers as COLUMN headers, hardware item names as ROW labels, and a grid of checkboxes in the body. false for any other table layout.',
    },
    doorNumbers: {
      type: 'array',
      items: { type: 'string' },
      description: 'Every door number column header, left to right, exactly as printed (e.g. "101a", "201", "EX211").',
    },
    valueRows: {
      type: 'array',
      description: 'Rows whose cells contain printed VALUES instead of checkboxes (e.g. a LOCKSET row with codes F82/F84/F86 under each door). values must be aligned to doorNumbers by index; use "" for doors with no value.',
      items: {
        type: 'object',
        required: ['label', 'values'],
        properties: {
          label: { type: 'string', description: 'Row label exactly as printed, e.g. "LOCKSET"' },
          values: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    checkboxRows: {
      type: 'array',
      description: 'Rows whose cells are checkboxes. One entry per row, in top-to-bottom order, INCLUDING rows with zero checked boxes.',
      items: {
        type: 'object',
        required: ['label', 'checkedDoors'],
        properties: {
          label: { type: 'string', description: 'Row label exactly as printed, e.g. "CARD READER"' },
          checkedDoors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Door numbers whose checkbox is CHECKED (filled/shaded/ticked/X) in this row. Empty array if none.',
          },
        },
      },
    },
    columnNotes: {
      type: 'array',
      description: 'Door columns that carry a note spanning their cells instead of checkboxes (e.g. "EXISTING - PROVIDE NEW LOCK SET ONLY" printed vertically).',
      items: {
        type: 'object',
        required: ['door', 'note'],
        properties: {
          door: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
    products: {
      type: 'array',
      description: 'Entries from the product legend table (e.g. "DOOR HARDWARE PRODUCTS") mapping row labels to product specs. Empty array if no legend is visible.',
      items: {
        type: 'object',
        required: ['label', 'description'],
        properties: {
          label: { type: 'string', description: 'Row label as it appears in the legend, e.g. "LOCKSET (F82)" or "BUTTS"' },
          manufacturer: { type: 'string', description: 'Manufacturer name if identifiable, e.g. "SCHLAGE", "IVES", "LCN", else ""' },
          description: { type: 'string', description: 'The product specification text, e.g. "ND SERIES LEVER - SCHLAGE RHO"' },
          finish: { type: 'string', description: 'Finish code if printed, e.g. "626AM", else ""' },
        },
      },
    },
  },
};

// Schema for the focused value-row re-read (e.g. the LOCKSET code row).
export const VALUE_ROW_SCHEMA = {
  type: 'object',
  required: ['values'],
  properties: {
    values: {
      type: 'array',
      description: 'One entry per door-number column, strictly left to right.',
      items: {
        type: 'object',
        required: ['door', 'value'],
        properties: {
          door: { type: 'string', description: 'Door number from the header, exactly as printed' },
          value: { type: 'string', description: 'The printed value in that door\'s cell, "" if blank' },
        },
      },
    },
  },
};
