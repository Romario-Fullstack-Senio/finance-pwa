import { Budget, Category, DEFAULT_RULE, Transaction } from '../models/finance.models';
import { applyRule, emptySummary, expensesByCategory, summarizeByMonth } from './finance-stats';

const category = (id: string, kind: Category['kind']): Category => ({
  id,
  name: id,
  color: '#000000',
  kind,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const categories = [
  category('rent', 'fixed'),
  category('food', 'variable'),
  category('salary', 'income'),
  category('savings', 'savings'),
];

let seq = 0;
const tx = (
  type: Transaction['type'],
  amount: number,
  categoryId: string,
  date: string,
): Transaction => ({
  id: `tx-${++seq}`,
  type,
  amount,
  categoryId,
  date,
  createdAt: `${date}T12:00:00.000Z`,
  updatedAt: `${date}T12:00:00.000Z`,
});

const transactions = [
  tx('income', 4_000_000, 'salary', '2026-09-01'),
  tx('expense', 1_500_000, 'rent', '2026-09-05'),
  tx('expense', 700_000, 'food', '2026-09-10'),
  tx('expense', 100_000, 'deleted-category', '2026-09-11'),
  tx('saving', 600_000, 'savings', '2026-09-30'),
  tx('income', 4_000_000, 'salary', '2026-10-01'),
];

describe('summarizeByMonth', () => {
  const summaries = summarizeByMonth(transactions, categories);
  const september = summaries.get('2026-09')!;

  it('separa gastos fijos y variables', () => {
    expect(september.fixed).toBe(1_500_000);
    // Una categoría que ya no existe cuenta como variable
    expect(september.variable).toBe(800_000);
    expect(september.expense).toBe(2_300_000);
  });

  it('no cuenta el ahorro como gasto y calcula lo disponible', () => {
    expect(september.saved).toBe(600_000);
    expect(september.available).toBe(4_000_000 - 2_300_000 - 600_000);
  });

  it('agrupa por mes', () => {
    expect([...summaries.keys()].sort()).toEqual(['2026-09', '2026-10']);
    expect(summaries.get('2026-10')!.income).toBe(4_000_000);
  });
});

describe('applyRule', () => {
  const september = summarizeByMonth(transactions, categories).get('2026-09')!;

  it('calcula metas sobre el ingreso del mes', () => {
    const [needs, wants, savings] = applyRule(september, DEFAULT_RULE);
    expect(needs).toMatchObject({ target: 2_000_000, actual: 1_500_000, status: 'ok' });
    expect(wants).toMatchObject({ target: 1_200_000, actual: 800_000, status: 'ok' });
    expect(savings).toMatchObject({ target: 800_000, actual: 600_000, status: 'short' });
    expect(savings.actualPct).toBe(15);
  });

  it('marca cuando un gasto supera la meta', () => {
    const [needs] = applyRule(september, { needs: 30, wants: 50, savings: 20 });
    expect(needs).toMatchObject({ target: 1_200_000, status: 'over' });
  });

  it('cumple la meta de ahorro cuando la alcanza', () => {
    const [, , savings] = applyRule(september, { needs: 50, wants: 35, savings: 15 });
    expect(savings.status).toBe('ok');
  });

  it('sin ingresos no hay porcentajes reales', () => {
    const lines = applyRule(emptySummary('2026-11'), DEFAULT_RULE);
    expect(lines.every((line) => line.actualPct === null && line.target === 0)).toBe(true);
  });
});

describe('expensesByCategory', () => {
  const budgets: Budget[] = [
    { id: 'b1', categoryId: 'food', month: '2026-09', limit: 600_000, updatedAt: '' },
    { id: 'b2', categoryId: 'rent', month: '2026-08', limit: 1_000_000, updatedAt: '' },
  ];

  it('ordena por gasto e incluye la participación y el presupuesto del mes', () => {
    const rows = expensesByCategory(transactions, categories, budgets, '2026-09');
    expect(rows.map((r) => r.category.id)).toEqual(['rent', 'food']);
    expect(rows[0].budget).toBeNull();
    expect(rows[1]).toMatchObject({ spent: 700_000, budget: 600_000 });
    expect(rows[0].share).toBeCloseTo(1_500_000 / 2_300_000);
  });

  it('muestra categorías con presupuesto aunque no tengan gasto', () => {
    const rows = expensesByCategory(transactions, categories, budgets, '2026-08');
    expect(rows).toEqual([
      expect.objectContaining({ spent: 0, budget: 1_000_000, share: 0 }),
    ]);
  });
});
