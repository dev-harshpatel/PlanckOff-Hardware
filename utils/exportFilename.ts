/**
 * Standardised export filename builder.
 *
 * Produces:  {project-name}-{report-type}-{YYYY-MM-DD}.{ext}
 *
 * Rules:
 *  - All segments are lower-cased.
 *  - Runs of non-alphanumeric characters are collapsed to a single hyphen.
 *  - Leading/trailing hyphens are trimmed from each segment.
 *  - When projectName is blank the segment is omitted (no leading hyphen).
 */

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildExportFilename(
  projectName: string,
  reportType: string,
  extension: string,
  date: Date = new Date(),
): string {
  const dateStr = date.toISOString().split('T')[0];
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;

  const parts: string[] = [];
  const safeProject = slugify(projectName);
  if (safeProject) parts.push(safeProject);
  parts.push(slugify(reportType));
  parts.push(dateStr);

  return `${parts.join('-')}.${ext}`;
}
