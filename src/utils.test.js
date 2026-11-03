import { describe, expect, it } from "vitest";
import { paginate } from "./utils.js";

const items = Array.from({ length: 20 }, (_, i) => i + 1);

describe("paginate", () => {
  it("devuelve la primera página", () => {
    expect(paginate(items, 1, 8)).toEqual({ items: [1, 2, 3, 4, 5, 6, 7, 8], page: 1, totalPages: 3 });
  });
  it("la última página puede tener menos elementos", () => {
    expect(paginate(items, 3, 8).items).toEqual([17, 18, 19, 20]);
  });
  it("ajusta páginas fuera de rango", () => {
    expect(paginate(items, 99, 8).page).toBe(3);
    expect(paginate(items, 0, 8).page).toBe(1);
  });
  it("una lista vacía tiene 1 página sin elementos", () => {
    expect(paginate([], 1, 8)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});
