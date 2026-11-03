import { beforeEach, describe, expect, it } from "vitest";
import { createStore, normalize, parseImport, validate } from "./store.js";

/** Storage falso en memoria con la misma interfaz que localStorage. */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const valid = { name: "Mate", category: "Hogar", price: 1000, stock: 3 };

describe("normalize", () => {
  it("limpia espacios y convierte números", () => {
    expect(normalize({ name: "  Mate ", category: "Hogar", price: "10.5", stock: "3" }))
      .toEqual({ name: "Mate", category: "Hogar", price: 10.5, stock: 3 });
  });
  it("usa 'Otros' con categorías desconocidas", () => {
    expect(normalize({ ...valid, category: "Inventada" }).category).toBe("Otros");
  });
  it("trata campos vacíos como NaN, no como 0", () => {
    const n = normalize({ name: "x", price: "", stock: "" });
    expect(n.price).toBeNaN();
    expect(n.stock).toBeNaN();
  });
});

describe("validate", () => {
  it("acepta datos correctos", () => expect(validate(valid)).toEqual({}));
  it("rechaza nombre corto", () => expect(validate({ ...valid, name: "a" })).toHaveProperty("name"));
  it("rechaza precio negativo o vacío", () => {
    expect(validate({ ...valid, price: -1 })).toHaveProperty("price");
    expect(validate({ ...valid, price: NaN })).toHaveProperty("price");
  });
  it("rechaza stock decimal o negativo", () => {
    expect(validate({ ...valid, stock: 1.5 })).toHaveProperty("stock");
    expect(validate({ ...valid, stock: -2 })).toHaveProperty("stock");
  });
  it("acepta precio y stock en cero", () => {
    expect(validate({ ...valid, price: 0, stock: 0 })).toEqual({});
  });
});

describe("store", () => {
  let storage, store;
  beforeEach(() => {
    storage = fakeStorage();
    store = createStore(storage);
  });

  it("empieza vacío", () => expect(store.getAll()).toEqual([]));

  it("create agrega un producto con id y fecha", () => {
    const p = store.create(valid);
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBeTypeOf("number");
    expect(store.getAll()).toHaveLength(1);
  });

  it("persiste entre instancias (simula recargar la página)", () => {
    const p = store.create(valid);
    expect(createStore(storage).getById(p.id)).toMatchObject(valid);
  });

  it("update modifica solo los campos enviados", () => {
    const p = store.create(valid);
    store.update(p.id, { ...valid, price: 2000 });
    expect(store.getById(p.id)).toMatchObject({ name: "Mate", price: 2000, createdAt: p.createdAt });
  });

  it("update de un id inexistente devuelve null", () => {
    expect(store.update("nope", valid)).toBeNull();
  });

  it("remove elimina y avisa si no existía", () => {
    const p = store.create(valid);
    expect(store.remove(p.id)).toBe(true);
    expect(store.remove(p.id)).toBe(false);
    expect(store.getAll()).toEqual([]);
  });

  it("ignora JSON corrupto en el storage", () => {
    expect(createStore(fakeStorage({ "crud-productos": "{roto" })).getAll()).toEqual([]);
  });

  it("ignora datos que no son un array", () => {
    expect(createStore(fakeStorage({ "crud-productos": '{"a":1}' })).getAll()).toEqual([]);
  });
});

describe("validate (límites)", () => {
  it("rechaza nombres de más de 60 caracteres", () => {
    expect(validate({ ...valid, name: "a".repeat(61) })).toHaveProperty("name");
  });
});

describe("parseImport", () => {
  it("acepta el formato exportado { products: [...] }", () => {
    const text = JSON.stringify({ version: 1, products: [{ ...valid, id: "a1", createdAt: 5 }] });
    expect(parseImport(text)).toEqual({ products: [{ id: "a1", ...valid, createdAt: 5 }], skipped: 0 });
  });
  it("acepta una lista directa y genera id y fecha si faltan", () => {
    const { products } = parseImport(JSON.stringify([valid]));
    expect(products[0].id).toBeTruthy();
    expect(products[0].createdAt).toBeTypeOf("number");
  });
  it("descarta productos inválidos y los cuenta", () => {
    const text = JSON.stringify([valid, { name: "x", price: -5, stock: 1 }, null, 42]);
    const res = parseImport(text);
    expect(res.products).toHaveLength(1);
    expect(res.skipped).toBe(3);
  });
  it("lanza error con JSON roto", () => {
    expect(() => parseImport("{roto")).toThrow("JSON válido");
  });
  it("lanza error con un formato que no es lista", () => {
    expect(() => parseImport('{"a":1}')).toThrow("Formato no reconocido");
  });
  it("lanza error si no queda ningún producto válido", () => {
    expect(() => parseImport("[]")).toThrow("no contiene productos");
    expect(() => parseImport('[{"name":""}]')).toThrow("Ningún producto");
  });
});

describe("exportar / importar en el store", () => {
  it("ida y vuelta: lo exportado se puede importar igual", () => {
    const a = createStore(fakeStorage());
    a.create(valid);
    a.create({ ...valid, name: "Termo" });
    const { products } = parseImport(a.exportJSON());
    const b = createStore(fakeStorage());
    b.importMany(products, "replace");
    expect(b.getAll()).toEqual(a.getAll());
  });
  it("merge conserva lo existente y actualiza por id", () => {
    const s = createStore(fakeStorage());
    const p = s.create(valid);
    s.importMany([{ ...p, price: 999 }, { id: "nuevo", ...valid, name: "Otro", createdAt: 1 }], "merge");
    expect(s.getAll()).toHaveLength(2);
    expect(s.getById(p.id).price).toBe(999);
  });
  it("replace descarta lo anterior", () => {
    const s = createStore(fakeStorage());
    s.create(valid);
    s.importMany([{ id: "z", ...valid, createdAt: 1 }], "replace");
    expect(s.getAll().map((p) => p.id)).toEqual(["z"]);
  });
  it("replace elimina ids repetidos dentro del archivo", () => {
    const s = createStore(fakeStorage());
    const dup = { id: "z", ...valid, createdAt: 1 };
    expect(s.importMany([dup, dup], "replace")).toBe(1);
  });
});
