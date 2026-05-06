import React, { useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PrinterIcon } from '../shared/icons';
import type { MergedHardwareSet, MergedDoor, HardwareItem } from '@/lib/db/hardware';

interface SubmittalGeneratorProps {
  finalJson: MergedHardwareSet[];
  projectName: string;
}

interface SetGroup {
  /** Fingerprint of normalized hardware items — used for deduplication */
  fingerprint: string;
  /** All set names sharing identical items */
  setNames: string[];
  /** Canonical hardware items list */
  items: HardwareItem[];
  /** All door tags across merged sets */
  doorTags: string[];
  /** Total quantity of doors (sum of QUANTITY per door) */
  totalQuantity: number;
}

function itemsFingerprint(items: HardwareItem[]): string {
  const normalized = [...items]
    .sort((a, b) => (a.item || '').localeCompare(b.item || ''))
    .map(item => ({
      n: (item.item || '').trim().toLowerCase(),
      q: item.qty,
      m: (item.manufacturer || '').trim().toLowerCase(),
      f: (item.finish || '').trim().toLowerCase(),
      d: (item.description || '').trim().toLowerCase(),
    }));
  return JSON.stringify(normalized);
}

function doorQuantity(door: MergedDoor): number {
  const raw = door.sections?.door?.['QUANTITY'] ?? String(door.quantity ?? 1);
  return parseInt(raw) || 1;
}

const SubmittalGenerator: React.FC<SubmittalGeneratorProps> = ({ finalJson, projectName }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const groups = useMemo<SetGroup[]>(() => {
    const map = new Map<string, SetGroup>();

    for (const set of finalJson) {
      if (!set.hardwareItems?.length) continue;

      const fp = itemsFingerprint(set.hardwareItems);

      if (!map.has(fp)) {
        map.set(fp, {
          fingerprint: fp,
          setNames: [],
          items: set.hardwareItems,
          doorTags: [],
          totalQuantity: 0,
        });
      }

      const group = map.get(fp)!;

      if (!group.setNames.includes(set.setName)) {
        group.setNames.push(set.setName);
      }

      for (const door of set.doors) {
        group.doorTags.push(String(door.doorTag));
        group.totalQuantity += doorQuantity(door);
      }
    }

    // Preserve finalJson insertion order — this matches the door schedule sheet sequence.
    return Array.from(map.values());
  }, [finalJson]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Submittal_Package_${projectName.replace(/\s+/g, '_')}`,
  });

  const setsWithDoors = groups.filter(g => g.doorTags.length > 0);
  const emptyGroups = groups.filter(g => g.doorTags.length === 0);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">
      {/* Toolbar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>
            <span className="font-semibold text-[var(--text)]">{setsWithDoors.length}</span>
            {' '}unique hardware set{setsWithDoors.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="font-semibold text-[var(--text)]">
              {groups.reduce((s, g) => s + g.totalQuantity, 0)}
            </span>
            {' '}total door openings
          </span>
          {emptyGroups.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              · {emptyGroups.length} set{emptyGroups.length !== 1 ? 's' : ''} with no doors assigned
            </span>
          )}
        </div>
        <button
          onClick={handlePrint}
          disabled={groups.length === 0}
          className="flex items-center gap-2 bg-[var(--primary-action)] text-[var(--text-inverted)] px-4 py-2 rounded-md hover:bg-[var(--primary-action-hover)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PrinterIcon className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--text-muted)]">
            <p className="text-sm font-medium">No hardware sets found in final JSON</p>
            <p className="text-xs mt-1">Run the merge pipeline first to generate the submittal package.</p>
          </div>
        </div>
      )}

      {/* Printable preview */}
      {groups.length > 0 && (
        <div className="flex-1 overflow-auto p-2">
          <div ref={componentRef}>
            {/* Print-specific font import */}
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
              @media print {
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                @page { size: A4; margin: 12mm 14mm; }
                .page-break { page-break-after: always; break-after: page; }
                body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
              }
              .submittal-root { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
            `}</style>

            <div className="submittal-root max-w-[900px] mx-auto">
              {setsWithDoors.map((group, idx) => (
                <div
                  key={group.fingerprint}
                  className={`bg-white${idx < setsWithDoors.length - 1 ? ' page-break' : ''}`}
                  style={{ minHeight: '1050px', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}
                >
                  {/* ── Top accent bar ── */}
                  <div style={{ height: 4, background: '#1e293b', borderRadius: 2, marginBottom: 28 }} />

                  {/* ── Page header ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, borderBottom: '2px solid #1e293b', paddingBottom: 18 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>
                        Hardware Set Submittal
                      </p>
                      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1.2, margin: 0 }}>
                        {group.setNames.join(', ')}
                      </h1>
                      {group.setNames.length > 1 && (
                        <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                          {group.setNames.length} sets with identical specifications — combined
                        </p>
                      )}
                      <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                        {projectName}
                      </p>
                    </div>

                    {/* Quantity badge */}
                    <div style={{ textAlign: 'right', marginLeft: 24, flexShrink: 0 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Total Qty</p>
                      <div style={{
                        fontSize: 52, fontWeight: 900, color: '#0f172a', lineHeight: 1,
                        background: '#f1f5f9', borderRadius: 8, padding: '8px 20px', display: 'inline-block',
                      }}>
                        {group.totalQuantity}
                      </div>
                    </div>
                  </div>

                  {/* ── Two-column body ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, flex: 1 }}>

                    {/* Left: Hardware items */}
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 12 }}>
                        Hardware Items ({group.items.length})
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', width: 28 }}>Qty</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Item</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', width: 70 }}>Mfr</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', width: 50 }}>Finish</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 8px', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>{item.qty}</td>
                              <td style={{ padding: '7px 8px', verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.item}</div>
                                {item.description && (
                                  <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>{item.description}</div>
                                )}
                              </td>
                              <td style={{ padding: '7px 8px', color: '#64748b', fontSize: 10, verticalAlign: 'top' }}>{item.manufacturer || '—'}</td>
                              <td style={{ padding: '7px 8px', color: '#64748b', fontSize: 10, verticalAlign: 'top' }}>{item.finish || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Notes */}
                      {finalJson.find(s => s.setName === group.setNames[0])?.notes && (
                        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8fafc', borderLeft: '3px solid #cbd5e1', borderRadius: '0 4px 4px 0' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 4 }}>Notes</p>
                          <p style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                            {finalJson.find(s => s.setName === group.setNames[0])?.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Door openings */}
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 12 }}>
                        Door Openings ({group.doorTags.length})
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {group.doorTags.slice(0, 120).map((tag, i) => (
                          <span key={i} style={{
                            padding: '2px 8px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                            borderRadius: 4, fontSize: 10, fontFamily: 'monospace', color: '#334155', fontWeight: 500,
                          }}>
                            {tag}
                          </span>
                        ))}
                        {group.doorTags.length > 120 && (
                          <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', alignSelf: 'center' }}>
                            +{group.doorTags.length - 120} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Footer ── */}
                  <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                    <span>Generated by PlanckOff Estimating · {projectName}</span>
                    <span>Page {idx + 1} of {setsWithDoors.length}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmittalGenerator;
