export const CATEGORIES = ["Electrónica", "Hogar", "Ropa", "Alimentos", "Muebles", "Papelería", "Varios", "Otros"];
const KEY = "crud-productos";

const toNumber = (v) => (v === "" || v == null ? NaN : Number(v));

/** Convierte lo que viene del formulario (strings) en un producto tipado. */
export function normalize(raw) {
  return {
    name: String(raw.name ?? "").trim(),
    category: CATEGORIES.includes(raw.category) ? raw.category : "Otros",
    price: toNumber(raw.price),
    stock: toNumber(raw.stock),
    ...(raw.descripcion != null ? { descripcion: String(raw.descripcion).trim() } : {}),
  };
}

/** Devuelve un objeto { campo: mensaje }. Vacío = datos válidos. */
export function validate(data) {
  const errors = {};
  if (data.name.length < 2 || data.name.length > 60) errors.name = "El nombre debe tener entre 2 y 60 caracteres.";
  if (!Number.isFinite(data.price) || data.price < 0) errors.price = "Ingresá un precio válido (0 o más).";
  if (!Number.isInteger(data.stock) || data.stock < 0) errors.stock = "El stock debe ser un entero de 0 o más.";
  return errors;
}

/**
 * Lee el texto de un archivo JSON exportado y devuelve { products, skipped }.
 * Acepta una lista directa o el formato { products: [...] } que genera exportJSON().
 * Los productos inválidos se descartan; lanza Error si el archivo no sirve.
 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const list = Array.isArray(data) ? data : data?.products;
  if (!Array.isArray(list)) throw new Error("Formato no reconocido: se esperaba una lista de productos.");

  const products = [];
  let skipped = 0;
  for (const raw of list) {
    const src = raw && typeof raw === "object" ? raw : {};
    const item = normalize(src);
    if (Object.keys(validate(item)).length) {
      skipped++;
      continue;
    }
    products.push({
      id: typeof src.id === "string" && src.id ? src.id : crypto.randomUUID(),
      ...item,
      createdAt: Number.isFinite(src.createdAt) ? src.createdAt : Date.now(),
    });
  }
  if (!products.length) {
    throw new Error(skipped ? "Ningún producto del archivo es válido." : "El archivo no contiene productos.");
  }
  return { products, skipped };
}

/** El storage se inyecta para poder testear sin navegador. */
export function createStore(storage = globalThis.localStorage) {
  const read = () => {
    try {
      const data = JSON.parse(storage.getItem(KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return []; // JSON corrupto o storage no disponible
    }
  };
  const write = (list) => storage.setItem(KEY, JSON.stringify(list));

  return {
    getAll: read,
    getById: (id) => read().find((p) => p.id === id) ?? null,

    exportJSON: () =>
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), products: read() }, null, 2),

    /** mode "merge": suma/actualiza por id. mode "replace": descarta lo actual. */
    importMany(products, mode = "merge") {
      const byId = new Map((mode === "replace" ? [] : read()).map((p) => [p.id, p]));
      for (const p of products) byId.set(p.id, p);
      const list = [...byId.values()];
      write(list);
      return list.length;
    },

    create(data) {
      const product = { id: crypto.randomUUID(), ...data, createdAt: Date.now() };
      write([...read(), product]);
      return product;
    },

    update(id, data) {
      const list = read();
      const i = list.findIndex((p) => p.id === id);
      if (i === -1) return null;
      list[i] = { ...list[i], ...data };
      write(list);
      return list[i];
    },

    remove(id) {
      const list = read();
      const next = list.filter((p) => p.id !== id);
      if (next.length === list.length) return false;
      write(next);
      return true;
    },
  };
}
