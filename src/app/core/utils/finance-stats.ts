import { Budget, BudgetRule, Category, Transaction } from '../models/finance.models';

export interface MonthSummary {
  month: string;
  income: number;
  /** Gastos en categorías fijas (necesidades) */
  fixed: number;
  /** Gastos en categorías variables (deseos) */
  variable: number;
  /** fixed + variable; el ahorro no es gasto */
  expense: number;
  saved: number;
  /** Lo que queda sin asignar: ingresos − gastos − ahorro */
  available: number;
}

export function emptySummary(month: string): MonthSummary {
  return { month, income: 0, fixed: 0, variable: 0, expense: 0, saved: 0, available: 0 };
}

/**
 * Totales por mes ('YYYY-MM') en una sola pasada. Un gasto cuya categoría no es fija
 * (o ya no existe) cuenta como variable.
 */
export function summarizeByMonth(
  transactions: Transaction[],
  categories: Category[],
): Map<string, MonthSummary> {
  const kindById = new Map(categories.map((c) => [c.id, c.kind]));
  const summaries = new Map<string, MonthSummary>();

  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    let summary = summaries.get(month);
    if (!summary) {
      summary = emptySummary(month);
      summaries.set(month, summary);
    }
    if (tx.type === 'income') summary.income += tx.amount;
    else if (tx.type === 'saving') summary.saved += tx.amount;
    else if (kindById.get(tx.categoryId) === 'fixed') summary.fixed += tx.amount;
    else summary.variable += tx.amount;
  }

  for (const summary of summaries.values()) {
    summary.expense = summary.fixed + summary.variable;
    summary.available = summary.income - summary.expense - summary.saved;
  }
  return summaries;
}

export type RuleBucket = keyof BudgetRule;

export interface RuleLine {
  bucket: RuleBucket;
  /** Porcentaje de la regla */
  pct: number;
  /** Monto que pide la regla según los ingresos del mes */
  target: number;
  actual: number;
  /** Porcentaje real del ingreso; null si no hubo ingresos */
  actualPct: number | null;
  /** over: gastó más de lo que permite · short: ahorró menos de la meta */
  status: 'ok' | 'over' | 'short';
}

/** Necesidades = gastos fijos, deseos = gastos variables, ahorro = movimientos de ahorro */
export function applyRule(summary: MonthSummary, rule: BudgetRule): RuleLine[] {
  const actuals: Record<RuleBucket, number> = {
    needs: summary.fixed,
    wants: summary.variable,
    savings: summary.saved,
  };

  return (['needs', 'wants', 'savings'] as const).map((bucket) => {
    const pct = rule[bucket];
    const actual = actuals[bucket];
    const target = Math.round((summary.income * pct) / 100);
    const status =
      bucket === 'savings' ? (actual >= target ? 'ok' : 'short') : actual > target ? 'over' : 'ok';
    return {
      bucket,
      pct,
      target,
      actual,
      actualPct: summary.income > 0 ? (actual / summary.income) * 100 : null,
      status,
    };
  });
}

export interface CategorySpend {
  category: Category;
  spent: number;
  /** Fracción del gasto total del mes (0–1) */
  share: number;
  budget: number | null;
}

/** Gasto por categoría (fijas y variables) del mes, con su presupuesto si lo tiene */
export function expensesByCategory(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  month: string,
): CategorySpend[] {
  const spentById = new Map<string, number>();
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date.startsWith(month)) continue;
    spentById.set(tx.categoryId, (spentById.get(tx.categoryId) ?? 0) + tx.amount);
    total += tx.amount;
  }
  const budgetById = new Map(
    budgets.filter((b) => b.month === month).map((b) => [b.categoryId, b.limit]),
  );

  return categories
    .filter((c) => c.kind === 'fixed' || c.kind === 'variable')
    .map((category) => {
      const spent = spentById.get(category.id) ?? 0;
      return {
        category,
        spent,
        share: total > 0 ? spent / total : 0,
        budget: budgetById.get(category.id) ?? null,
      };
    })
    .filter((item) => item.spent > 0 || item.budget !== null)
    .sort((a, b) => b.spent - a.spent);
}
