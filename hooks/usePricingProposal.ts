import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePricingProposalParams {
  projectId: string;
  proposalDoorBase: number;
  proposalFrameBase: number;
  proposalHwBase: number;
}

const withProfit = (base: number, pctStr: string): number => {
  const p = parseFloat(pctStr);
  return isNaN(p) || p <= 0 ? base : base * (1 + p / 100);
};

export function usePricingProposal({
  projectId,
  proposalDoorBase,
  proposalFrameBase,
  proposalHwBase,
}: UsePricingProposalParams) {
  const [hiddenProposalTables, setHiddenProposalTables] = useState<Set<'doors' | 'frames' | 'hardware'>>(new Set());

  const [profitPct, setProfitPct] = useState<{ door: string; frame: string; hardware: string }>({
    door: '', frame: '', hardware: '',
  });
  const profitDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [allocateExpenses, setAllocateExpenses] = useState(false);
  const [taxRows, setTaxRows]                   = useState<Array<{ id: string; description: string; taxPct: string }>>([]);
  const [remarks, setRemarks]                   = useState('');
  const [extraExpenses, setExtraExpenses]        = useState<Array<{ id: string; delivery: string; totalPrice: string }>>([]);

  const latestProfitPct = useRef(profitPct);
  const latestAllocate  = useRef(false);
  const latestTaxRows   = useRef<Array<{ id: string; description: string; taxPct: string }>>([]);
  const latestRemarks   = useRef('');
  const expenseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taxDebounce     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/pricing-proposal`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        const { profit_door, profit_frame, profit_hardware, allocate_expenses } =
          json.data as { profit_door: number; profit_frame: number; profit_hardware: number; allocate_expenses: boolean };
        const next = {
          door:     profit_door     > 0 ? String(profit_door)     : '',
          frame:    profit_frame    > 0 ? String(profit_frame)    : '',
          hardware: profit_hardware > 0 ? String(profit_hardware) : '',
        };
        setProfitPct(next);
        latestProfitPct.current = next;
        setAllocateExpenses(allocate_expenses);
        latestAllocate.current = allocate_expenses;
        const r = (json.data as { remarks: string }).remarks ?? '';
        setRemarks(r);
        latestRemarks.current = r;
      })
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/proposal-expenses`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        setExtraExpenses(
          (json.data as Array<{ id: string; delivery: string; total_price: number }>).map(row => ({
            id:         row.id,
            delivery:   row.delivery,
            totalPrice: row.total_price > 0 ? String(row.total_price) : '',
          })),
        );
      })
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/proposal-tax-rows`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        const loaded = (json.data as Array<{ id: string; description: string; tax_pct: number }>).map(row => ({
          id:          row.id,
          description: row.description,
          taxPct:      row.tax_pct > 0 ? String(row.tax_pct) : '',
        }));
        setTaxRows(loaded);
        latestTaxRows.current = loaded;
      })
      .catch(console.error);
  }, [projectId]);

  const saveProposalSettings = useCallback(() => {
    if (profitDebounce.current) clearTimeout(profitDebounce.current);
    profitDebounce.current = setTimeout(() => {
      const toNum = (s: string) => Math.max(0, parseFloat(s) || 0);
      fetch(`/api/projects/${projectId}/pricing-proposal`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profit_door:       toNum(latestProfitPct.current.door),
          profit_frame:      toNum(latestProfitPct.current.frame),
          profit_hardware:   toNum(latestProfitPct.current.hardware),
          allocate_expenses: latestAllocate.current,
          remarks:           latestRemarks.current,
        }),
      }).catch(console.error);
    }, 800);
  }, [projectId]);

  const saveExpenses = useCallback((expenses: typeof extraExpenses) => {
    if (expenseDebounce.current) clearTimeout(expenseDebounce.current);
    expenseDebounce.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/proposal-expenses`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses: expenses.map((e, i) => ({
            sort_order:  i,
            delivery:    e.delivery,
            total_price: parseFloat(e.totalPrice) || 0,
          })),
        }),
      }).catch(console.error);
    }, 800);
  }, [projectId]);

  const saveTaxRows = useCallback((rows: typeof taxRows) => {
    if (taxDebounce.current) clearTimeout(taxDebounce.current);
    taxDebounce.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/proposal-tax-rows`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map((r, i) => ({
            sort_order:  i,
            description: r.description,
            tax_pct:     parseFloat(r.taxPct) || 0,
          })),
        }),
      }).catch(console.error);
    }, 800);
  }, [projectId]);

  const toggleProposalTable = useCallback((key: 'doors' | 'frames' | 'hardware') =>
    setHiddenProposalTables(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    }), []);

  const handleProfitChange = useCallback((key: 'door' | 'frame' | 'hardware', raw: string) => {
    setProfitPct(prev => {
      const next = { ...prev, [key]: raw };
      latestProfitPct.current = next;
      saveProposalSettings();
      return next;
    });
  }, [saveProposalSettings]);

  const handleAllocateChange = useCallback((val: boolean) => {
    setAllocateExpenses(val);
    latestAllocate.current = val;
    saveProposalSettings();
  }, [saveProposalSettings]);

  const handleAddTaxRow = useCallback(() => {
    setTaxRows(prev => {
      const next = [...prev, { id: crypto.randomUUID(), description: '', taxPct: '' }];
      latestTaxRows.current = next;
      saveTaxRows(next);
      return next;
    });
  }, [saveTaxRows]);

  const handleTaxRowChange = useCallback((id: string, field: 'description' | 'taxPct', value: string) => {
    setTaxRows(prev => {
      const next = prev.map(r => r.id === id ? { ...r, [field]: value } : r);
      latestTaxRows.current = next;
      saveTaxRows(next);
      return next;
    });
  }, [saveTaxRows]);

  const handleRemoveTaxRow = useCallback((id: string) => {
    setTaxRows(prev => {
      const next = prev.filter(r => r.id !== id);
      latestTaxRows.current = next;
      saveTaxRows(next);
      return next;
    });
  }, [saveTaxRows]);

  const handleRemarksChange = useCallback((val: string) => {
    setRemarks(val);
    latestRemarks.current = val;
    saveProposalSettings();
  }, [saveProposalSettings]);

  const handleAddExpense = useCallback(() => {
    setExtraExpenses(prev => {
      const next = [...prev, { id: crypto.randomUUID(), delivery: '', totalPrice: '' }];
      saveExpenses(next);
      return next;
    });
  }, [saveExpenses]);

  const handleExpenseChange = useCallback((id: string, field: 'delivery' | 'totalPrice', value: string) => {
    setExtraExpenses(prev => {
      const next = prev.map(e => e.id === id ? { ...e, [field]: value } : e);
      saveExpenses(next);
      return next;
    });
  }, [saveExpenses]);

  const handleRemoveExpense = useCallback((id: string) => {
    setExtraExpenses(prev => {
      const next = prev.filter(e => e.id !== id);
      saveExpenses(next);
      return next;
    });
  }, [saveExpenses]);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const proposalDoorTotal  = withProfit(proposalDoorBase,  profitPct.door);
  const proposalFrameTotal = withProfit(proposalFrameBase, profitPct.frame);
  const proposalHwTotal    = withProfit(proposalHwBase,    profitPct.hardware);

  const extraExpensesTotal = extraExpenses.reduce((sum, e) => sum + (parseFloat(e.totalPrice) || 0), 0);
  const proposalGrandTotal = proposalDoorTotal + proposalFrameTotal + proposalHwTotal;
  const taxSubtotal        = proposalGrandTotal + extraExpensesTotal;
  const totalTaxAmount     = taxRows.reduce((sum, r) => sum + taxSubtotal * (Math.max(0, parseFloat(r.taxPct) || 0) / 100), 0);
  const totalAfterTax      = taxSubtotal + totalTaxAmount;
  const doorAlloc  = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalDoorTotal  / proposalGrandTotal) : 0;
  const frameAlloc = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalFrameTotal / proposalGrandTotal) : 0;
  const hwAlloc    = allocateExpenses && proposalGrandTotal > 0 ? extraExpensesTotal * (proposalHwTotal    / proposalGrandTotal) : 0;

  return {
    hiddenProposalTables,
    toggleProposalTable,
    profitPct,
    allocateExpenses,
    taxRows,
    remarks,
    extraExpenses,
    handleProfitChange,
    handleAllocateChange,
    handleAddTaxRow,
    handleTaxRowChange,
    handleRemoveTaxRow,
    handleRemarksChange,
    handleAddExpense,
    handleExpenseChange,
    handleRemoveExpense,
    proposalDoorTotal,
    proposalFrameTotal,
    proposalHwTotal,
    extraExpensesTotal,
    proposalGrandTotal,
    taxSubtotal,
    totalAfterTax,
    doorAlloc,
    frameAlloc,
    hwAlloc,
  };
}
