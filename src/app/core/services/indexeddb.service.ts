import { Injectable } from '@angular/core';

export interface PendingOp {
  id: string;
  action:
    | 'insertTransaction'
    | 'deleteTransaction'
    | 'insertCategory'
    | 'updateCategory'
    | 'upsertBudget'
    | 'updateRule';
  payload: unknown;
  createdAt: string;
}

type DataStore = 'transactions' | 'categories' | 'budgets';

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private readonly dbName = 'finance_control_db';
  private readonly dbVersion = 3;

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          db.createObjectStore('transactions', { keyPath: 'id' });
          db.createObjectStore('categories', { keyPath: 'id' });
          db.createObjectStore('budgets', { keyPath: 'id' });
        }

        if (oldVersion < 2) {
          db.createObjectStore('pending_ops', { keyPath: 'id' });
        }

        if (oldVersion < 3) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: DataStore): Promise<T[]> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result ?? []) as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: DataStore, value: T): Promise<void> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(storeName: DataStore, key: string): Promise<void> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Ajustes del usuario (ej. regla 50/30/20), disponibles offline ---

  async getSetting<T>(id: string): Promise<T | undefined> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const request = db.transaction('settings', 'readonly').objectStore('settings').get(id);
      request.onsuccess = () => resolve((request.result as { value: T } | undefined)?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async putSetting<T>(id: string, value: T): Promise<void> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ id, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Pending operations queue (offline support) ---

  async addPendingOp(op: PendingOp): Promise<void> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_ops', 'readwrite');
      tx.objectStore('pending_ops').put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingOps(): Promise<PendingOp[]> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_ops', 'readonly');
      const request = tx.objectStore('pending_ops').getAll();
      request.onsuccess = () => resolve((request.result ?? []) as PendingOp[]);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePendingOp(id: string): Promise<void> {
    const db = await this.openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_ops', 'readwrite');
      tx.objectStore('pending_ops').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
