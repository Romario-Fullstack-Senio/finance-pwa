import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { httpError } from '../errors.ts';

interface TransactionBody {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

interface CategoryBody {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface BudgetBody {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  updatedAt: string;
}

const id = { type: 'string', minLength: 1, maxLength: 64 } as const;
const timestamp = { type: 'string', format: 'date-time' } as const;
const money = { type: 'number', exclusiveMinimum: 0, maximum: 999999999999.99 } as const;

const transactionSchema = {
  body: {
    type: 'object',
    required: ['id', 'type', 'amount', 'categoryId', 'date', 'createdAt', 'updatedAt'],
    properties: {
      id,
      type: { type: 'string', enum: ['income', 'expense'] },
      amount: money,
      categoryId: id,
      note: { type: 'string', maxLength: 500 },
      date: { type: 'string', format: 'date' },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
};

const categorySchema = {
  body: {
    type: 'object',
    required: ['id', 'name', 'color', 'createdAt'],
    properties: {
      id,
      name: { type: 'string', minLength: 1, maxLength: 60 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      createdAt: timestamp,
    },
  },
};

const budgetSchema = {
  body: {
    type: 'object',
    required: ['id', 'categoryId', 'month', 'limit', 'updatedAt'],
    properties: {
      id,
      categoryId: id,
      month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      limit: money,
      updatedAt: timestamp,
    },
  },
};

function isForeignKeyViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23503';
}

/**
 * Sincronización offline-first: los inserts son idempotentes (on conflict do nothing)
 * porque el cliente reintenta las operaciones pendientes hasta recibir respuesta.
 */
export async function financeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/finance/snapshot', async (request) => {
    const uid = request.user.sub;
    const [categories, transactions, budgets] = await Promise.all([
      pool.query(
        `select id, name, color, created_at as "createdAt"
         from categories where user_id = $1 order by created_at`,
        [uid],
      ),
      pool.query(
        `select id, type, amount, category_id as "categoryId", note, date,
                created_at as "createdAt", updated_at as "updatedAt"
         from transactions where user_id = $1 order by date desc, created_at desc`,
        [uid],
      ),
      pool.query(
        `select id, category_id as "categoryId", month, amount_limit as "limit",
                updated_at as "updatedAt"
         from budgets where user_id = $1`,
        [uid],
      ),
    ]);

    return {
      categories: categories.rows,
      transactions: transactions.rows.map(({ note, ...row }) => (note === null ? row : { ...row, note })),
      budgets: budgets.rows,
    };
  });

  app.post<{ Body: TransactionBody }>(
    '/finance/transactions',
    { schema: transactionSchema },
    async (request, reply) => {
      const tx = request.body;
      try {
        await pool.query(
          `insert into transactions
             (user_id, id, type, amount, category_id, note, date, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (user_id, id) do nothing`,
          [
            request.user.sub,
            tx.id,
            tx.type,
            tx.amount,
            tx.categoryId,
            tx.note ?? null,
            tx.date,
            tx.createdAt,
            tx.updatedAt,
          ],
        );
      } catch (err) {
        if (isForeignKeyViolation(err)) throw httpError(409, 'La categoría no existe.');
        throw err;
      }
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: string } }>('/finance/transactions/:id', async (request, reply) => {
    await pool.query('delete from transactions where user_id = $1 and id = $2', [
      request.user.sub,
      request.params.id,
    ]);
    return reply.code(204).send();
  });

  app.post<{ Body: CategoryBody }>(
    '/finance/categories',
    { schema: categorySchema },
    async (request, reply) => {
      const category = request.body;
      await pool.query(
        `insert into categories (user_id, id, name, color, created_at)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, id) do nothing`,
        [request.user.sub, category.id, category.name.trim(), category.color, category.createdAt],
      );
      return reply.code(204).send();
    },
  );

  app.put<{ Body: BudgetBody }>('/finance/budgets', { schema: budgetSchema }, async (request, reply) => {
    const budget = request.body;
    try {
      // Una operación encolada offline no pisa un presupuesto actualizado después
      await pool.query(
        `insert into budgets (user_id, id, category_id, month, amount_limit, updated_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id, category_id, month) do update
           set id = excluded.id,
               amount_limit = excluded.amount_limit,
               updated_at = excluded.updated_at
           where budgets.updated_at <= excluded.updated_at`,
        [
          request.user.sub,
          budget.id,
          budget.categoryId,
          budget.month,
          budget.limit,
          budget.updatedAt,
        ],
      );
    } catch (err) {
      if (isForeignKeyViolation(err)) throw httpError(409, 'La categoría no existe.');
      throw err;
    }
    return reply.code(204).send();
  });
}
