// Magatzem local (IndexedDB). Les vendes es desen aquí abans de res: el servidor només les rep en sincronitzar.
import type { Anulacio, Caixa, Venda } from "../shared/venda";

/** 0 = pendent, 1 = sincronitzada, 2 = rebutjada pel servidor (es conserva i es mostra). */
export type EstatSync = 0 | 1 | 2;
export type AmbSync<T> = T & { sync: EstatSync; errors?: string[] };

const NOM = "glow";
const VERSIO = 1;
let connexio: Promise<IDBDatabase> | undefined;

function obre(): Promise<IDBDatabase> {
  connexio ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM, VERSIO);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("meta");
      db.createObjectStore("vendes", { keyPath: "id" }).createIndex("sync", "sync");
      db.createObjectStore("anulacions", { keyPath: "id" }).createIndex("sync", "sync");
      db.createObjectStore("caixes", { keyPath: "id" }).createIndex("sync", "sync");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return connexio;
}

function promesa<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transaccio<T>(magatzems: string[], mode: IDBTransactionMode, feina: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await obre();
  const t = db.transaction(magatzems, mode);
  const fet = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  const resultat = await feina(t);
  await fet;
  return resultat;
}

export async function llegeixMeta<T>(clau: string): Promise<T | undefined> {
  return transaccio(["meta"], "readonly", (t) => promesa(t.objectStore("meta").get(clau)) as Promise<T | undefined>);
}

export async function desaMeta(clau: string, valor: unknown): Promise<void> {
  await transaccio(["meta"], "readwrite", (t) => promesa(t.objectStore("meta").put(valor, clau)));
}

export async function tots<T>(magatzem: "vendes" | "anulacions" | "caixes"): Promise<AmbSync<T>[]> {
  return transaccio([magatzem], "readonly", (t) => promesa(t.objectStore(magatzem).getAll()) as Promise<AmbSync<T>[]>);
}

export async function desa<T extends { id: string }>(magatzem: "vendes" | "anulacions" | "caixes", registre: AmbSync<T>): Promise<void> {
  await transaccio([magatzem], "readwrite", (t) => promesa(t.objectStore(magatzem).put(registre)));
}

/** El registre tal com s'envia al servidor (sense l'estat de sincronització local). */
export function senseEstat<T extends object>(r: T): Omit<T, "sync" | "errors"> {
  const { sync: _s, errors: _e, ...resta } = r as any;
  return resta;
}

/**
 * Marca registres com a sincronitzats (o rebutjats) en una sola transacció.
 * Si `enviat` hi és i el registre ha canviat mentre s'enviava (p. ex. s'ha tancat la caixa),
 * no es marca: queda pendent i s'enviarà la versió nova a la volta següent.
 */
export async function marca(
  canvis: { magatzem: "vendes" | "anulacions" | "caixes"; id: string; sync: EstatSync; errors?: string[]; enviat?: object }[],
): Promise<void> {
  if (canvis.length === 0) return;
  await transaccio(["vendes", "anulacions", "caixes"], "readwrite", async (t) => {
    for (const c of canvis) {
      const s = t.objectStore(c.magatzem);
      const actual = await promesa(s.get(c.id));
      if (!actual) continue;
      if (c.enviat && JSON.stringify(senseEstat(actual)) !== JSON.stringify(c.enviat)) continue;
      s.put({ ...actual, sync: c.sync, errors: c.errors });
    }
  });
}

export async function pendents(): Promise<{ vendes: AmbSync<Venda>[]; anulacions: AmbSync<Anulacio>[]; caixes: AmbSync<Caixa>[] }> {
  return transaccio(["vendes", "anulacions", "caixes"], "readonly", async (t) => {
    const per = <T>(m: string) => promesa(t.objectStore(m).index("sync").getAll(0)) as Promise<AmbSync<T>[]>;
    const [vendes, anulacions, caixes] = await Promise.all([per<Venda>("vendes"), per<Anulacio>("anulacions"), per<Caixa>("caixes")]);
    vendes.sort((a, b) => a.creadaA.localeCompare(b.creadaA));
    return { vendes, anulacions, caixes };
  });
}
