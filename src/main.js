import "./styles.css";
import { CATEGORIES, createStore, normalize, parseImport, validate } from "./store.js";
import { downloadFile, paginate } from "./utils.js";

const store = createStore();
const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const els = {
  form: $("form"), title: $("form-title"), submit: $("submit"), cancel: $("cancel"),
  category: $("category"), rows: $("rows"), empty: $("empty"), summary: $("summary"),
  search: $("search"), sort: $("sort"), dialog: $("confirm"), confirmText: $("confirm-text"),
  notice: $("notice"), importFile: $("import-file"),
  importDialog: $("import-dialog"), importText: $("import-text"),
  pager: $("pager"), prev: $("prev"), next: $("next"), pageInfo: $("page-info"),
  detailId: $("detail-id"), descripcion: $("descripcion"), clock: $("clock"),
  searchBar: $("search-bar"),
};

let editingId = null;
let pendingDelete = null;
let pendingImport = null;
let selectedId = null;
let page = 1;
let noticeTimer;
const PAGE_SIZE = 10;

const SORTERS = {
  recent: (a, b) => b.createdAt - a.createdAt,
  name: (a, b) => a.name.localeCompare(b.name, "es"),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  stock: (a, b) => a.stock - b.stock,
};

/** Crea un elemento. */
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/* ---------- listado ---------- */
function render() {
  const all = store.getAll();
  const term = els.search.value.trim().toLowerCase();
  const sortKey = els.sort.value || "recent";
  const list = all
    .filter((p) => !term || p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
    .sort(SORTERS[sortKey] || SORTERS.recent);

  const view = paginate(list, page, PAGE_SIZE);
  page = view.page;
  els.rows.replaceChildren(...view.items.map((p, i) => rowFor(p, (view.page - 1) * PAGE_SIZE + i)));
  renderPager(view);

  els.summary.textContent = `Total de productos: ${all.length}`;
  renderEmpty(all.length, list.length);

  // If selected product is visible, show it in detail panel
  if (selectedId) {
    const p = store.getById(selectedId);
    if (p) showDetail(p);
  }
}

function renderPager({ page: current, totalPages }) {
  els.pager.hidden = totalPages <= 1;
  els.pageInfo.textContent = `Pág ${current}/${totalPages}`;
  els.prev.disabled = current <= 1;
  els.next.disabled = current >= totalPages;
}

function rowFor(p, globalIndex) {
  const displayId = String(globalIndex + 1).padStart(3, "0");
  const isSelected = p.id === selectedId;
  const tr = el("tr", { className: isSelected ? "selected" : "" },
    el("td", { textContent: isSelected ? ">" : " ", className: "cursor-col" }),
    el("td", { textContent: displayId }),
    el("td", { textContent: p.name }),
    el("td", { textContent: p.category }),
    el("td", { className: "num", textContent: money.format(p.price) }),
    el("td", { className: p.stock <= 5 ? "num low" : "num", textContent: String(p.stock) }),
  );
  tr.addEventListener("click", () => selectProduct(p.id));
  return tr;
}

function selectProduct(id) {
  selectedId = id;
  const p = store.getById(id);
  if (p) showDetail(p);
  // Re-render table to update cursor
  const all = store.getAll();
  const term = els.search.value.trim().toLowerCase();
  const sortKey = els.sort.value || "recent";
  const list = all
    .filter((pr) => !term || pr.name.toLowerCase().includes(term) || pr.category.toLowerCase().includes(term))
    .sort(SORTERS[sortKey] || SORTERS.recent);
  const view = paginate(list, page, PAGE_SIZE);
  els.rows.replaceChildren(...view.items.map((pr, i) => rowFor(pr, (view.page - 1) * PAGE_SIZE + i)));
}

function showDetail(p) {
  if (editingId) return; // Don't override if user is editing
  const f = els.form.elements;
  const all = store.getAll();
  const sortKey = els.sort.value || "recent";
  const sorted = [...all].sort(SORTERS[sortKey] || SORTERS.recent);
  const idx = sorted.findIndex((pr) => pr.id === p.id);
  els.detailId.value = idx >= 0 ? String(idx + 1).padStart(3, "0") : "---";
  f.name.value = p.name;
  f.category.value = p.category;
  f.price.value = p.price;
  f.stock.value = p.stock;
  els.descripcion.value = p.descripcion || "";
  els.title.textContent = "Detalle del Producto";
  els.submit.textContent = "[ Guardar ]";
  els.cancel.hidden = true;
}

function renderEmpty(total, shown) {
  els.empty.hidden = shown > 0;
  if (shown > 0) return;
  if (total === 0) {
    els.empty.replaceChildren(
      el("p", { textContent: "No hay productos cargados." }),
      el("button", { className: "crt-btn", type: "button", textContent: "[ Cargar datos de ejemplo ]", onclick: seed }),
    );
  } else {
    els.empty.replaceChildren(el("p", { textContent: "No hay resultados para la búsqueda." }));
  }
}

function seed() {
  [
    ["Monitor 24\"", "Electrónica", 189999, 8, "Monitor LED Full HD 24 pulgadas"],
    ["Teclado Mecánico", "Electrónica", 45999, 15, "Teclado mecánico switches blue"],
    ["Mouse Inalámbrico", "Electrónica", 12500, 25, "Mouse óptico inalámbrico 2.4GHz"],
    ["Auriculares", "Electrónica", 35000, 12, "Auriculares over-ear con micrófono"],
    ["Silla Gamer", "Muebles", 185000, 3, "Silla ergonómica reclinable"],
    ["Escritorio", "Muebles", 125000, 5, "Escritorio en L 150x120cm"],
    ["Lámpara LED", "Hogar", 18500, 20, "Lámpara de escritorio LED regulable"],
    ["Taza Star Wars", "Hogar", 4500, 42, "Taza cerámica 350ml con diseño"],
    ["Cuaderno", "Papelería", 3200, 60, "Cuaderno A4 120 hojas rayadas"],
    ["Mochila", "Varios", 28000, 10, "Mochila notebook 15.6\" impermeable"],
  ].forEach(([name, category, price, stock, descripcion]) =>
    store.create({ name, category, price, stock, descripcion })
  );
  selectedId = store.getAll().sort(SORTERS[els.sort.value || "recent"])[0]?.id || null;
  render();
}

/* ---------- formulario (alta y edición) ---------- */
function showErrors(errors) {
  els.form.querySelectorAll("[data-error]").forEach((span) => {
    const msg = errors[span.dataset.error] ?? "";
    span.textContent = msg;
    els.form.elements[span.dataset.error].toggleAttribute("aria-invalid", !!msg);
  });
}

function resetForm() {
  editingId = null;
  els.form.reset();
  showErrors({});
  els.title.textContent = "Detalle del Producto";
  els.submit.textContent = "[ Guardar ]";
  els.cancel.hidden = true;
  els.detailId.value = "---";
  els.descripcion.value = "";
  // Show selected product detail if any
  if (selectedId) {
    const p = store.getById(selectedId);
    if (p) showDetail(p);
  }
}

function startEdit(id) {
  const p = store.getById(id);
  if (!p) return;
  editingId = id;
  selectedId = id;
  const f = els.form.elements;
  const all = store.getAll();
  const sortKey = els.sort.value || "recent";
  const sorted = [...all].sort(SORTERS[sortKey] || SORTERS.recent);
  const idx = sorted.findIndex((pr) => pr.id === id);
  els.detailId.value = idx >= 0 ? String(idx + 1).padStart(3, "0") : "---";
  f.name.value = p.name;
  f.category.value = p.category;
  f.price.value = p.price;
  f.stock.value = p.stock;
  els.descripcion.value = p.descripcion || "";
  showErrors({});
  els.title.textContent = "Editar Producto";
  els.submit.textContent = "[ Guardar ]";
  els.cancel.hidden = false;
  f.name.focus();
  // re-render table to show cursor
  render();
}

function startNew() {
  editingId = null;
  selectedId = null;
  els.form.reset();
  showErrors({});
  els.detailId.value = "NUEVO";
  els.descripcion.value = "";
  els.title.textContent = "Nuevo Producto";
  els.submit.textContent = "[ Guardar ]";
  els.cancel.hidden = false;
  els.form.elements.name.focus();
  // re-render table to clear cursor
  render();
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = normalize(Object.fromEntries(new FormData(els.form)));
  data.descripcion = els.descripcion.value.trim();
  const errors = validate(data);
  showErrors(errors);
  if (Object.keys(errors).length) {
    els.form.elements[Object.keys(errors)[0]].focus();
    return;
  }
  if (editingId) {
    store.update(editingId, data);
    selectedId = editingId;
  } else {
    const created = store.create(data);
    selectedId = created.id;
  }
  resetForm();
  render();
});

els.cancel.addEventListener("click", () => {
  resetForm();
  render();
});

/* ---------- eliminar con confirmación ---------- */
function askDelete(p) {
  pendingDelete = p;
  els.confirmText.textContent = `¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`;
  els.dialog.showModal();
}

els.dialog.addEventListener("close", () => {
  if (els.dialog.returnValue === "confirm" && pendingDelete) {
    store.remove(pendingDelete.id);
    if (editingId === pendingDelete.id) resetForm();
    if (selectedId === pendingDelete.id) {
      selectedId = null;
      resetForm();
    }
    render();
  }
  pendingDelete = null;
  els.dialog.returnValue = "";
});

/* ---------- exportar / importar ---------- */
function notify(msg, isError = false) {
  clearTimeout(noticeTimer);
  els.notice.textContent = msg;
  els.notice.className = isError ? "notice error-box" : "notice";
  els.notice.hidden = !msg;
  if (msg) noticeTimer = setTimeout(() => notify(""), 6000);
}

function doExport() {
  const count = store.getAll().length;
  if (!count) return notify("No hay productos para exportar.", true);
  downloadFile(`productos-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON());
  notify(`Se exportaron ${count} producto${count === 1 ? "" : "s"}.`);
}

function doImport() {
  els.importFile.click();
}

els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files[0];
  els.importFile.value = "";
  if (!file) return;
  try {
    pendingImport = parseImport(await file.text());
  } catch (err) {
    return notify(err.message, true);
  }
  const { products, skipped } = pendingImport;
  els.importText.textContent =
    `Se encontraron ${products.length} producto${products.length === 1 ? "" : "s"} válido${products.length === 1 ? "" : "s"}` +
    (skipped ? ` (${skipped} omitido${skipped === 1 ? "" : "s"} por datos inválidos)` : "") +
    ". ¿Cómo querés importarlos?";
  els.importDialog.showModal();
});

els.importDialog.addEventListener("close", () => {
  const mode = els.importDialog.returnValue;
  if (pendingImport && (mode === "merge" || mode === "replace")) {
    const total = store.importMany(pendingImport.products, mode);
    page = 1;
    resetForm();
    render();
    notify(`Importación lista. Ahora tenés ${total} producto${total === 1 ? "" : "s"}.`);
  }
  pendingImport = null;
  els.importDialog.returnValue = "";
});

/* ---------- menu system ---------- */
const menuMap = {
  "menu-archivo": "submenu-archivo",
  "menu-productos": "submenu-productos",
  "menu-edicion": "submenu-edicion",
  "menu-ayuda": "submenu-ayuda",
};

let openMenu = null;

function closeMenus() {
  document.querySelectorAll(".submenu.open").forEach((m) => m.classList.remove("open"));
  document.querySelectorAll(".menu-item.active").forEach((m) => m.classList.remove("active"));
  openMenu = null;
}

function positionSubmenu(menuItemId, submenuId) {
  const menuItem = $(menuItemId);
  const submenu = $(submenuId);
  const rect = menuItem.getBoundingClientRect();
  const menuBar = menuItem.parentElement.getBoundingClientRect();
  submenu.style.left = (rect.left - menuBar.left) + "px";
}

Object.entries(menuMap).forEach(([menuId, subId]) => {
  $(menuId).addEventListener("click", (e) => {
    e.stopPropagation();
    if (openMenu === subId) {
      closeMenus();
    } else {
      closeMenus();
      positionSubmenu(menuId, subId);
      $(subId).classList.add("open");
      $(menuId).classList.add("active");
      openMenu = subId;
    }
  });
});

document.addEventListener("click", closeMenus);
document.querySelectorAll(".submenu").forEach((m) => m.addEventListener("click", (e) => e.stopPropagation()));

// Menu actions
$("menu-export").addEventListener("click", () => { closeMenus(); doExport(); });
$("menu-import").addEventListener("click", () => { closeMenus(); doImport(); });
$("menu-nuevo").addEventListener("click", () => { closeMenus(); startNew(); });
$("menu-editar").addEventListener("click", () => { closeMenus(); if (selectedId) startEdit(selectedId); });
$("menu-eliminar").addEventListener("click", () => {
  closeMenus();
  if (selectedId) { const p = store.getById(selectedId); if (p) askDelete(p); }
});
$("menu-buscar").addEventListener("click", () => {
  closeMenus();
  els.searchBar.hidden = !els.searchBar.hidden;
  if (!els.searchBar.hidden) els.search.focus();
});
$("search-close").addEventListener("click", () => {
  els.searchBar.hidden = true;
  els.search.value = "";
  page = 1;
  render();
});

// Sort menu items
["recent", "name", "price-asc", "price-desc", "stock"].forEach((key) => {
  const menuItem = $("menu-sort-" + key);
  if (menuItem) {
    menuItem.addEventListener("click", () => {
      closeMenus();
      els.sort.value = key;
      page = 1;
      render();
    });
  }
});

/* ---------- keyboard shortcuts ---------- */
document.addEventListener("keydown", (e) => {
  // Don't capture if a dialog is open
  if (document.querySelector("dialog[open]")) return;

  switch (e.key) {
    case "F2":
      e.preventDefault();
      startNew();
      break;
    case "F3":
      e.preventDefault();
      if (selectedId) startEdit(selectedId);
      break;
    case "F4":
      e.preventDefault();
      if (selectedId) {
        const p = store.getById(selectedId);
        if (p) askDelete(p);
      }
      break;
    case "Escape":
      e.preventDefault();
      if (editingId) {
        resetForm();
        render();
      } else {
        closeMenus();
        if (!els.searchBar.hidden) {
          els.searchBar.hidden = true;
          els.search.value = "";
          page = 1;
          render();
        }
      }
      break;
  }
});

/* ---------- clock ---------- */
function updateClock() {
  const now = new Date();
  const d = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const t = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  els.clock.textContent = `${d}  ${t}`;
}

/* ---------- inicio ---------- */
els.category.replaceChildren(...CATEGORIES.map((c) => el("option", { value: c, textContent: c })));
els.search.addEventListener("input", () => { page = 1; render(); });
els.prev.addEventListener("click", () => { page--; render(); });
els.next.addEventListener("click", () => { page++; render(); });

updateClock();
setInterval(updateClock, 60000);

render();
