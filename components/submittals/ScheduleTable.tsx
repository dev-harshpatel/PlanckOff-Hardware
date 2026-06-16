import React from 'react';
import type { MergedDoor } from '@/lib/db/hardware';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScheduleSection = 'basic_information' | 'door' | 'frame' | 'hardware';

export interface ScheduleCol {
  key: string;
  section: ScheduleSection;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function scheduleFormatLabel(key: string): string {
  return key
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ScheduleTableProps {
  columns: ScheduleCol[];
  doors: MergedDoor[];
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ columns, doors }) => (
  <table className="sched-table">
    <thead>
      <tr>
        {columns.map((col, ci) => (
          <th key={ci} className="sched-col-hdr">
            {scheduleFormatLabel(col.key)}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {doors.map((door, di) => (
        <tr key={di}>
          {columns.map((col, ci) => {
            const data = (door.sections?.[col.section] ?? {}) as Record<string, string>;
            const val = (data[col.key] ?? '').trim() || '-';
            return (
              <td
                key={ci}
                className={
                  col.key === 'DOOR TAG' ? 'sched-tag'
                  : val === '-' ? 'sched-muted'
                  : ''
                }
              >
                {val}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table>
);

export default ScheduleTable;
