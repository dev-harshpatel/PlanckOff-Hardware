'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  groupDoors,
  groupFrames,
  groupHardwareItems,
  applyPrices,
  type DoorPricingGroup,
  type HardwarePricingGroup,
  type PriceMap,
} from '@/utils/pricingGrouping';
import {
  transformFromFinalJson,
  transformHardwareSets,
  transformDoors,
} from '@/utils/hardwareTransformers';
import { filterHardwareExcludedDoors, filterSetsWithNoDoors } from '@/utils/reportFilters';
import type { CompanySettings } from '@/lib/db/companySettings';
import type { Door, HardwareSet } from '@/types';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const withProfit = (base: number, pctStr: string): number => {
  const p = parseFloat(pctStr);
  return isNaN(p) || p <= 0 ? base : base * (1 + p / 100);
};

interface PrintData {
  projectName: string;
  companySettings: CompanySettings | null;
  doorGroups: DoorPricingGroup[];
  frameGroups: DoorPricingGroup[];
  hardwareGroups: HardwarePricingGroup[];
  hwSetList: Array<{ name: string; doorCount: number }>;
  proposalDoorBase: number;
  proposalFrameBase: number;
  proposalHwBase: number;
  proposalDoorTotal: number;
  proposalFrameTotal: number;
  proposalHwTotal: number;
  proposalGrandTotal: number;
  extraExpenses: Array<{ id: string; delivery: string; total_price: number }>;
  extraExpensesTotal: number;
  taxRows: Array<{ id: string; description: string; tax_pct: number }>;
  taxSubtotal: number;
  totalAfterTax: number;
  doorAlloc: number;
  frameAlloc: number;
  hwAlloc: number;
  allocateExpenses: boolean;
  remarks: string;
  hideDoors: boolean;
  hideFrames: boolean;
  hideHardware: boolean;
  profitPct: { door: string; frame: string; hardware: string };
}

export default function ProposalPrintPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const hideDoors    = searchParams.get('hideDoors')    === '1';
  const hideFrames   = searchParams.get('hideFrames')   === '1';
  const hideHardware = searchParams.get('hideHardware') === '1';

  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await fetch(`/api/projects/${id}/pricing-proposal/print-data`, {
          credentials: 'include',
        });
        if (!res.ok) { setError('Failed to load proposal data.'); return; }
        const json = await res.json() as { data: Record<string, unknown> };
        const d = json.data;

        // Build prices map
        const priceMap: PriceMap = new Map();
        for (const row of (d.pricingRows as Array<{ category: string; group_key: string; unit_price: number }>) ?? []) {
          priceMap.set(`${row.category}:${row.group_key}`, row.unit_price);
        }

        // Build doors + hardware sets
        let doors: Door[] = [];
        let hardwareSets: HardwareSet[] = [];

        const finalJson = d.finalJson as Parameters<typeof transformFromFinalJson>[0] | null;
        if (finalJson && finalJson.length > 0) {
          const { hardwareSets: mergedSets, doors: mergedDoors } = transformFromFinalJson(finalJson);
          doors = mergedDoors;
          hardwareSets = filterSetsWithNoDoors(mergedSets, filterHardwareExcludedDoors(mergedDoors));
        } else if (d.hardwareExtracted) {
          const sets = transformHardwareSets(d.hardwareExtracted as Parameters<typeof transformHardwareSets>[0]);
          const allDoors = d.doorScheduleJson
            ? transformDoors(d.doorScheduleJson as Parameters<typeof transformDoors>[0], sets)
            : [];
          doors = allDoors;
          hardwareSets = filterSetsWithNoDoors(sets, filterHardwareExcludedDoors(allDoors));
        }

        // Compute groups
        const rawDoorGroups     = groupDoors(doors);
        const rawFrameGroups    = groupFrames(doors);
        const rawHwGroups       = groupHardwareItems(hardwareSets, doors);
        const doorGroups        = applyPrices(rawDoorGroups,  priceMap, 'door');
        const frameGroups       = applyPrices(rawFrameGroups, priceMap, 'frame');
        const hardwareGroups    = applyPrices(rawHwGroups,    priceMap, 'hardware');

        // hw set list
        const hwSetList = hardwareSets.map(s => {
          const setName = s.name.toLowerCase();
          const doorCount = doors.filter(door => {
            const assigned = door.assignedHardwareSet?.name?.trim().toLowerCase();
            const provided = door.providedHardwareSet?.trim().toLowerCase();
            return assigned === setName || provided === setName;
          }).length;
          return { name: s.name, doorCount };
        }).filter(s => s.doorCount > 0);

        // Proposal totals
        const profit = d.proposalProfit as { profit_door: number; profit_frame: number; profit_hardware: number; allocate_expenses: boolean; remarks: string };
        const profitPct = {
          door:     profit.profit_door     > 0 ? String(profit.profit_door)     : '',
          frame:    profit.profit_frame    > 0 ? String(profit.profit_frame)    : '',
          hardware: profit.profit_hardware > 0 ? String(profit.profit_hardware) : '',
        };

        const proposalDoorBase  = doorGroups.reduce((s, g) => s + g.totalPrice, 0);
        const proposalFrameBase = frameGroups.reduce((s, g) => s + g.totalPrice, 0);
        const proposalHwBase    = hardwareGroups.reduce((s, g) => s + g.totalPrice, 0);

        const proposalDoorTotal  = withProfit(proposalDoorBase,  profitPct.door);
        const proposalFrameTotal = withProfit(proposalFrameBase, profitPct.frame);
        const proposalHwTotal    = withProfit(proposalHwBase,    profitPct.hardware);
        const proposalGrandTotal = proposalDoorTotal + proposalFrameTotal + proposalHwTotal;

        const extraExpenses   = (d.extraExpenses as Array<{ id: string; delivery: string; total_price: number }>) ?? [];
        const extraExpensesTotal = extraExpenses.reduce((s, e) => s + e.total_price, 0);
        const taxRows         = (d.taxRows as Array<{ id: string; description: string; tax_pct: number }>) ?? [];
        const taxSubtotal     = proposalGrandTotal + extraExpensesTotal;
        const totalTaxAmount  = taxRows.reduce((s, r) => s + taxSubtotal * (Math.max(0, r.tax_pct) / 100), 0);
        const totalAfterTax   = taxSubtotal + totalTaxAmount;
        const allocateExpenses = profit.allocate_expenses;
        const doorAlloc  = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalDoorTotal  / proposalGrandTotal) : 0;
        const frameAlloc = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalFrameTotal / proposalGrandTotal) : 0;
        const hwAlloc    = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalHwTotal    / proposalGrandTotal) : 0;

        setData({
          projectName:     String(d.projectName ?? ''),
          companySettings: d.companySettings as CompanySettings | null,
          doorGroups, frameGroups, hardwareGroups, hwSetList,
          proposalDoorBase, proposalFrameBase, proposalHwBase,
          proposalDoorTotal, proposalFrameTotal, proposalHwTotal,
          proposalGrandTotal,
          extraExpenses, extraExpensesTotal,
          taxRows, taxSubtotal, totalAfterTax,
          doorAlloc, frameAlloc, hwAlloc,
          allocateExpenses,
          remarks: profit.remarks ?? '',
          hideDoors, hideFrames, hideHardware,
          profitPct,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error.');
      }
    }

    void load();
  }, [id, hideDoors, hideFrames, hideHardware]);

  if (error) {
    return (
      <div className="proposal-print-root" style={{ padding: '40px', fontFamily: 'sans-serif', color: '#c00' }}>
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="proposal-print-root" style={{ padding: '40px', fontFamily: 'sans-serif', color: '#666' }}>
        Loading…
      </div>
    );
  }

  const {
    projectName, companySettings: co,
    doorGroups, frameGroups, hardwareGroups, hwSetList,
    proposalDoorBase, proposalFrameBase, proposalHwBase,
    proposalDoorTotal, proposalFrameTotal, proposalHwTotal,
    proposalGrandTotal,
    extraExpenses, extraExpensesTotal,
    taxRows, taxSubtotal, totalAfterTax,
    doorAlloc, frameAlloc, hwAlloc,
    allocateExpenses, remarks,
    profitPct,
  } = data;

  const grandLabel = allocateExpenses && extraExpensesTotal > 0
    ? `${fmt.format(proposalGrandTotal)} + ${fmt.format(extraExpensesTotal)} exp.`
    : '';

  const summaryRows = [
    { label: 'Doors',    base: proposalDoorBase,  total: proposalDoorTotal  + doorAlloc,  pct: profitPct.door     },
    { label: 'Frames',   base: proposalFrameBase, total: proposalFrameTotal + frameAlloc, pct: profitPct.frame    },
    { label: 'Hardware', base: proposalHwBase,    total: proposalHwTotal    + hwAlloc,    pct: profitPct.hardware },
  ];

  return (
    <div
      className="proposal-print-root"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        color: '#1e2330',
        background: '#fff',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '24px 0',
        fontSize: '13px',
        lineHeight: '1.5',
      }}
    >
      {/* Company header */}
      {co?.companyName && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            {co.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={co.logoUrl}
                alt={co.companyName}
                style={{ height: '64px', maxWidth: '200px', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{co.companyName}</div>
              {(co.websiteUrl || co.email) && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {[co.websiteUrl, co.email].filter(Boolean).join('  ·  ')}
                </div>
              )}
              {co.phone && <div style={{ fontSize: '11px', color: '#64748b' }}>{co.phone}</div>}
              {[co.address, co.province, co.country].filter(Boolean).join(', ') && (
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {[co.address, co.province, co.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0 0' }} />
        </div>
      )}

      {/* Proposal label + project name */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px' }}>
          Proposal
        </div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          {projectName || 'Untitled Project'}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          Prepared on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0 0' }} />
      </div>

      {/* Pricing Summary */}
      <Section title="Pricing Summary">
        <Table
          head={['Category', 'Base Cost', 'Total']}
          rows={[
            ...summaryRows.map(r => [r.label, fmt.format(r.base), <strong key="t">{fmt.format(r.total)}</strong>]),
            [<strong key="gl">Grand Total</strong>, grandLabel, <strong key="gt">{fmt.format(proposalGrandTotal + (allocateExpenses ? extraExpensesTotal : 0))}</strong>],
          ]}
          colAlign={['left', 'right', 'right']}
          lastRowHighlight
        />
      </Section>

      {/* Doors */}
      {!data.hideDoors && doorGroups.length > 0 && (
        <Section title="Doors">
          <Table
            head={['Description', 'Total Qty']}
            rows={[
              ...doorGroups.map(g => [g.description, g.totalQty]),
              [<strong key="tl">Total</strong>, <strong key="tv">{doorGroups.reduce((s, g) => s + g.totalQty, 0)}</strong>],
            ]}
            colAlign={['left', 'right']}
            lastRowHighlight
          />
        </Section>
      )}

      {/* Frames */}
      {!data.hideFrames && frameGroups.length > 0 && (
        <Section title="Frames">
          <Table
            head={['Description', 'Total Qty']}
            rows={[
              ...frameGroups.map(g => [g.description, g.totalQty]),
              [<strong key="tl">Total</strong>, <strong key="tv">{frameGroups.reduce((s, g) => s + g.totalQty, 0)}</strong>],
            ]}
            colAlign={['left', 'right']}
            lastRowHighlight
          />
        </Section>
      )}

      {/* Hardware */}
      {!data.hideHardware && hwSetList.length > 0 && (
        <Section title="Hardware">
          <Table
            head={['Hardware Set', 'Doors Used In']}
            rows={hwSetList.map(s => [s.name, s.doorCount])}
            colAlign={['left', 'right']}
          />
        </Section>
      )}

      {/* Extra Expenses */}
      {extraExpenses.length > 0 && (
        <Section title="Extra Expenses">
          <Table
            head={['Description', 'Total Price']}
            rows={[
              ...extraExpenses.map(e => [e.delivery || '—', fmt.format(e.total_price)]),
              [<strong key="tl">Total</strong>, <strong key="tv">{fmt.format(extraExpensesTotal)}</strong>],
            ]}
            colAlign={['left', 'right']}
            lastRowHighlight
          />
        </Section>
      )}

      {/* Tax */}
      <Section title="Tax">
        <Table
          head={['Description', 'Amount']}
          rows={[
            ['Pricing Summary Total', fmt.format(proposalGrandTotal)],
            ['Extra Expense Total',   fmt.format(extraExpensesTotal)],
            [<strong key="stl">Subtotal</strong>, <strong key="stv">{fmt.format(taxSubtotal)}</strong>],
            ...taxRows.map(r => {
              const amt = taxSubtotal * (Math.max(0, r.tax_pct) / 100);
              return [`${r.description || '(Tax)'}${r.tax_pct ? ` (${r.tax_pct}%)` : ''}`, fmt.format(amt)];
            }),
            [<strong key="tatl">Total After Tax</strong>, <strong key="tatv">{fmt.format(totalAfterTax)}</strong>],
          ]}
          colAlign={['left', 'right']}
          lastRowHighlight
        />
      </Section>

      {/* Remarks */}
      {remarks.trim() && (
        <Section title="Remarks">
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', whiteSpace: 'pre-wrap' }}>{remarks}</p>
        </Section>
      )}

      <style>{`
        html, body { background: #fff !important; }
        @media print {
          html, body { margin: 0; background: #fff !important; }
        }
        @page { margin: 18mm 12mm; size: A4 portrait; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '10px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

type CellContent = React.ReactNode;

function Table({
  head,
  rows,
  colAlign,
  lastRowHighlight = false,
}: {
  head: string[];
  rows: CellContent[][];
  colAlign: Array<'left' | 'right' | 'center'>;
  lastRowHighlight?: boolean;
}) {
  const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    color: '#fff',
    background: '#2d3c64',
    borderBottom: '1px solid #1e2a4a',
    whiteSpace: 'nowrap',
  };
  const tdStyle = (align: string, isLast: boolean, colIdx: number): React.CSSProperties => ({
    padding: '8px 12px',
    fontSize: '12px',
    textAlign: align as 'left' | 'right' | 'center',
    borderBottom: '1px solid #e2e8f0',
    background: isLast ? '#ebf0fc' : colIdx % 2 === 0 ? '#fff' : '#f8fafc',
    color: '#1e2330',
    verticalAlign: 'middle',
  });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} style={{ ...thStyle, textAlign: colAlign[i] ?? 'left', width: i === 0 ? 'auto' : '140px' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => {
          const isLast = lastRowHighlight && ri === rows.length - 1;
          return (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={tdStyle(colAlign[ci] ?? 'left', isLast, ri)}>
                  {cell}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
