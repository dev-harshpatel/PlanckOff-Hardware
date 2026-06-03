/**
 * Standardised export filename builder.
 *
 * Produces:  RFQ-{PROJECT_NAME}-{REPORT_TYPE}.{ext}
 *
 * Rules:
 *  - All segments are upper-cased.
 *  - Runs of non-alphanumeric characters are collapsed to a single underscore.
 *  - Leading/trailing underscores are trimmed from each segment.
 *  - When projectName is blank the segment is omitted (no extra hyphen).
 */

function toUpperUnderscore(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildExportFilename(
  projectName: string,
  reportType: string,
  extension: string,
  _date?: Date,
): string {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;

  const parts: string[] = ['RFQ'];
  const safeProject = toUpperUnderscore(projectName);
  if (safeProject) parts.push(safeProject);
  parts.push(toUpperUnderscore(reportType));

  return `${parts.join('-')}.${ext}`;
}
