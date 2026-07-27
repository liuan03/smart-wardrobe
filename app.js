// 智能穿搭 · 纯前端版（衣橱存 localStorage，生成用 Canvas）
const STORE_KEY = "wardrobe.items.v1";
const CATEGORIES = { top: "上衣", bottom: "下衣" };

const state = {
  closetFilter: "all",
  fitFilter: "all",
  selected: [null, null], // slot0=上衣, slot1=下衣（按类别自动归位）
  fitItemsById: {},
  editingId: null,
  closetSel: new Set(),
};

// ---------- 衣橱数据（localStorage） ----------
function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { return []; }
}
function saveItems(items) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}
let items = loadItems();

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- tab 切换 ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById(t.dataset.tab).classList.add("active");
    if (t.dataset.tab === "closet") loadCloset();
    if (t.dataset.tab === "fitting") loadFitGrid();
  });
});

// ---------- 上传（读入压缩后存 localStorage） ----------
const upFile = document.getElementById("upFile");
const upCount = document.getElementById("upCount");
function updateCount() {
  const n = upFile.files.length;
  upCount.textContent = n ? `已选择 ${n} 件` : "";
}
upFile.addEventListener("change", updateCount);

function compressImage(img, maxEdge = 1024, quality = 0.82) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const nw = Math.max(1, Math.round(img.naturalWidth * scale));
  const nh = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = nw; c.height = nh;
  c.getContext("2d").drawImage(img, 0, 0, nw, nh);
  return c.toDataURL("image/jpeg", quality);
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("upMsg");
  msg.textContent = "";
  const files = Array.from(upFile.files);
  if (!files.length) return;
  const category = document.getElementById("upCategory").value;
  const manualName = document.getElementById("upName").value.trim();
  let ok = 0, fail = 0;
  for (const f of files) {
    try {
      const img = await readImage(f);
      const data = compressImage(img);
      const name = manualName || (f.name.replace(/\.[^.]+$/, "") || "");
      items.push({ id: genId(), name, category, data });
      ok++;
    } catch (err) {
      fail++;
    }
  }
  saveItems(items);
  msg.textContent = `✅ 已存档 ${ok} 件` + (fail ? `，失败 ${fail} 件` : "");
  document.getElementById("upName").value = "";
  upFile.value = "";
  updateCount();
});

// ---------- 通用筛选 chip ----------
function renderFilters(containerId, current, onPick) {
  const el = document.getElementById(containerId);
  const list = [["all", "全部"], ...Object.entries(CATEGORIES)];
  el.innerHTML = list
    .map(([k, v]) => `<button class="chip ${k === current ? "active" : ""}" data-k="${k}">${v}</button>`)
    .join("");
  el.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => onPick(c.dataset.k))
  );
}

// ---------- 衣橱库 ----------
function loadCloset() {
  renderFilters("filters", state.closetFilter, (k) => {
    state.closetFilter = k;
    loadCloset();
  });
  const list = state.closetFilter === "all" ? items : items.filter((i) => i.category === state.closetFilter);
  const grid = document.getElementById("grid");
  if (!list.length) {
    grid.innerHTML = `<p style="color:var(--muted)">衣橱还是空的，先去「上传存档」吧。</p>`;
    updateClosetBar(list);
    return;
  }
  grid.innerHTML = list
    .map((it) => {
      const isEditing = state.editingId === it.id;
      const sel = state.closetSel.has(it.id) ? "sel" : "";
      if (isEditing) {
        const opts = Object.entries(CATEGORIES)
          .map(([k, v]) => `<option value="${k}" ${k === it.category ? "selected" : ""}>${v}</option>`)
          .join("");
        return `
    <div class="item editing ${sel}" data-id="${it.id}">
      <div class="edit-form">
        <input class="edit-name" value="${it.name || ""}" placeholder="名称" />
        <select class="edit-cat">${opts}</select>
        <div class="edit-actions">
          <button class="save" data-id="${it.id}">保存</button>
          <button class="cancel" data-id="${it.id}">取消</button>
        </div>
      </div>
    </div>`;
      }
      return `
    <div class="item ${sel}" data-id="${it.id}">
      <input type="checkbox" class="pickbox" data-id="${it.id}" ${sel ? "checked" : ""} />
      <button class="del" data-id="${it.id}" title="删除这件">×</button>
      <button class="edit" data-id="${it.id}" title="重命名 / 改分类">✎</button>
      <img src="${it.data}" alt="${it.name}" />
      <div class="meta">
        <span class="cat">${CATEGORIES[it.category] || it.category}</span>
        <div class="nm">${it.name || "未命名"}</div>
      </div>
    </div>`;
    })
    .join("");
  grid.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!confirm("确定删除这件衣物？")) return;
      items = items.filter((i) => i.id !== b.dataset.id);
      saveItems(items);
      state.closetSel.delete(b.dataset.id);
      loadCloset();
    })
  );
  grid.querySelectorAll(".edit").forEach((b) =>
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      state.editingId = b.dataset.id;
      loadCloset();
    })
  );
  grid.querySelectorAll(".cancel").forEach((b) =>
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      state.editingId = null;
      loadCloset();
    })
  );
  grid.querySelectorAll(".save").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const card = b.closest(".item");
      const id = b.dataset.id;
      const name = card.querySelector(".edit-name").value.trim();
      const category = card.querySelector(".edit-cat").value;
      const it = items.find((x) => x.id === id);
      if (it) { it.name = name; it.category = category; saveItems(items); }
      state.editingId = null;
      loadCloset();
    })
  );
  grid.querySelectorAll(".pickbox").forEach((c) =>
    c.addEventListener("change", () => {
      c.checked ? state.closetSel.add(c.dataset.id) : state.closetSel.delete(c.dataset.id);
      c.closest(".item").classList.toggle("sel", c.checked);
      updateClosetBar(list);
    })
  );
  updateClosetBar(list);
}

function updateClosetBar(list) {
  const allIds = list.map((i) => i.id);
  const n = state.closetSel.size;
  const delBtn = document.getElementById("delSel");
  delBtn.textContent = `删除选中 (${n})`;
  delBtn.disabled = n === 0;
  document.getElementById("closetTip").textContent = n ? "已选 " + n + " 件" : "";
  const selAll = document.getElementById("selAll");
  const allSelected = allIds.length > 0 && allIds.every((id) => state.closetSel.has(id));
  selAll.textContent = allSelected ? "取消全选" : "全选";
}

document.getElementById("selAll").addEventListener("click", () => {
  const list = state.closetFilter === "all" ? items : items.filter((i) => i.category === state.closetFilter);
  const allIds = list.map((i) => i.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => state.closetSel.has(id));
  if (allSelected) state.closetSel.clear();
  else allIds.forEach((id) => state.closetSel.add(id));
  loadCloset();
});

document.getElementById("delSel").addEventListener("click", () => {
  const n = state.closetSel.size;
  if (!n) return;
  if (!confirm(`确定删除选中的 ${n} 件衣物？`)) return;
  items = items.filter((i) => !state.closetSel.has(i.id));
  saveItems(items);
  state.closetSel.clear();
  loadCloset();
});

// ---------- 试衣间 ----------
function loadFitGrid() {
  renderFilters("fitFilters", state.fitFilter, (k) => {
    state.fitFilter = k;
    loadFitGrid();
  });
  const list = state.fitFilter === "all" ? items : items.filter((i) => i.category === state.fitFilter);
  state.fitItemsById = {};
  list.forEach((it) => { state.fitItemsById[it.id] = it; });
  const grid = document.getElementById("fitGrid");
  if (!list.length) {
    grid.innerHTML = `<p style="color:var(--muted)">没有可选衣物，先去上传。</p>`;
    return;
  }
  grid.innerHTML = list
    .map(
      (it) => `
    <div class="item ${state.selected.includes(it.id) ? "pick" : ""}" data-id="${it.id}">
      <img src="${it.data}" alt="${it.name}" />
      <div class="meta">
        <span class="cat">${CATEGORIES[it.category] || it.category}</span>
        <div class="nm">${it.name || "未命名"}</div>
      </div>
    </div>`
    )
    .join("");
  grid.querySelectorAll(".item").forEach((c) =>
    c.addEventListener("click", () => pickItem(c.dataset.id))
  );
}

function pickItem(id) {
  const item = state.fitItemsById[id];
  const slot = item && item.category === "bottom" ? 1 : 0; // 按类别自动归位
  if (state.selected[slot] === id) {
    state.selected[slot] = null;
  } else {
    state.selected[slot] = id;
  }
  renderSlots();
  loadFitGrid();
}

function renderSlots() {
  document.querySelectorAll(".slot").forEach((slot, i) => {
    const id = state.selected[i];
    if (id) {
      const item = items.find((x) => x.id === id);
      const src = item ? item.data : "";
      slot.innerHTML = `<img src="${src}" alt=""><button class="clear" data-slot="${i}">×</button>`;
    } else {
      slot.innerHTML = `<span class="slot-tip">${i === 0 ? "上衣框 · 点击下方任意「上衣」即可放入" : "下衣框 · 点击下方任意「下衣」即可放入"}</span>`;
    }
  });
  document.querySelectorAll(".slot .clear").forEach((b) =>
    b.addEventListener("click", () => {
      state.selected[+b.dataset.slot] = null;
      renderSlots();
      loadFitGrid();
    })
  );
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const ready = mode === "random" || (state.selected[0] && state.selected[1]);
  document.getElementById("genBtn").disabled = !ready;
}

// 切换模式
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const isRandom = mode === "random";
    const gen = document.getElementById("genBtn");
    gen.textContent = "穿搭生成";
    document.getElementById("fitHint").textContent = isRandom
      ? "随机模式：系统会从衣橱自动挑一件上衣 + 一件下衣，排版同上下版式。"
      : "";
    document.getElementById("fitGrid").style.opacity = isRandom ? "0.35" : "1";
    document.querySelector(".slots").style.opacity = isRandom ? "0.35" : "1";
    renderSlots();
  })
);

// ---------- Canvas 抠图与拼接 ----------
function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

function cornerBg(d, w, h) {
  const s = Math.max(4, Math.min(w, h) >> 5);
  const pts = [[0, 0], [0, w - s], [h - s, 0], [h - s, w - s]];
  const rs = [], gs = [], bs = [];
  for (const [y, x] of pts) {
    for (let yy = 0; yy < s; yy++) {
      for (let xx = 0; xx < s; xx++) {
        const i = ((y + yy) * w + (x + xx)) * 4;
        rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
      }
    }
  }
  rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  const m = rs.length >> 1;
  return [rs[m], gs[m], bs[m]];
}

// 四角采样去背景 + 紧裁，返回裁剪后的 canvas（RGBA）
function processGarment(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cx = c.getContext("2d");
  cx.drawImage(img, 0, 0);
  const imgData = cx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const bg = cornerBg(d, w, h);
  const tol = 28 * 28; // 欧式距离平方阈值
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
      const dist2 = dr * dr + dg * dg + db * db;
      if (dist2 < tol) {
        d[i + 3] = 0; // 背景透明
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  cx.putImageData(imgData, 0, 0);
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w, maxX + pad);
  maxY = Math.min(h, maxY + pad);
  const cw = maxX - minX, ch = maxY - minY;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

function fitToWidth(src, tw) {
  const w = src.width, h = src.height;
  if (w <= 0) return src;
  const scale = tw / w;
  const nw = tw, nh = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = nw; c.height = nh;
  c.getContext("2d").drawImage(src, 0, 0, nw, nh);
  return c;
}

async function compose(topItem, bottomItem, title) {
  const g1 = processGarment(await loadImg(topItem.data));
  const g2 = processGarment(await loadImg(bottomItem.data));
  const W = 1000, H = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#f9f7f3");
  grad.addColorStop(1, "#f1eee9");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1c1b19";
  ctx.font = '54px "Noto Serif SC", "Cormorant Garamond", serif';
  ctx.fillText(title, W / 2, 70);
  ctx.fillStyle = "#8a857c";
  ctx.font = '26px "Inter", sans-serif';
  ctx.fillText(new Date().toLocaleString("zh-CN"), W / 2, 128);

  const TARGET_W = 480, AVAILABLE_H = H - 280;
  let g1f = fitToWidth(g1, TARGET_W);
  let g2f = fitToWidth(g2, TARGET_W);
  let total = g1f.height + g2f.height;
  if (total > AVAILABLE_H) {
    const scale = AVAILABLE_H / total;
    g1f = fitToWidth(g1, Math.max(1, Math.round(TARGET_W * scale)));
    g2f = fitToWidth(g2, Math.max(1, Math.round(TARGET_W * scale)));
    total = g1f.height + g2f.height;
  }
  const top_y1 = Math.max(180, (H - total) / 2);
  const top_y2 = top_y1 + g1f.height;
  ctx.drawImage(g1f, (W - g1f.width) / 2, top_y1);
  ctx.drawImage(g2f, (W - g2f.width) / 2, top_y2);

  ctx.fillStyle = "#3c3b39";
  ctx.font = '28px "Inter", sans-serif';
  ctx.fillText("上衣 - " + (topItem.name || "未命名"), W / 2, top_y1 - 26);
  ctx.fillText("下衣 - " + (bottomItem.name || "未命名"), W / 2, top_y2 + g2f.height + 30);

  return canvas;
}

document.getElementById("genBtn").addEventListener("click", async () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const result = document.getElementById("result");
  const tops = items.filter((i) => i.category === "top");
  const bottoms = items.filter((i) => i.category === "bottom");
  let topItem, bottomItem;

  if (mode === "random") {
    if (!tops.length || !bottoms.length) {
      result.className = "result empty";
      result.textContent = "❌ 衣橱里需要至少一件上衣和一件下衣才能随机搭配";
      return;
    }
    topItem = tops[Math.floor(Math.random() * tops.length)];
    bottomItem = bottoms[Math.floor(Math.random() * bottoms.length)];
    state.selected = [topItem.id, bottomItem.id];
    renderSlots();
    loadFitGrid();
  } else {
    topItem = items.find((i) => i.id === state.selected[0]);
    bottomItem = items.find((i) => i.id === state.selected[1]);
    if (!topItem || !bottomItem) {
      result.className = "result empty";
      result.textContent = "❌ 请先选好上衣和下衣";
      return;
    }
  }

  result.className = "result";
  result.textContent = "生成中…";
  try {
    const canvas = await compose(topItem, bottomItem, mode === "random" ? "随机穿搭" : "穿搭效果图");
    result.innerHTML = `<img src="${canvas.toDataURL("image/png")}" alt="穿搭效果图" />`;
  } catch (e) {
    result.className = "result empty";
    result.textContent = "❌ 生成失败：" + (e && e.message ? e.message : e);
  }
});

// ---------- 初始化 ----------
renderSlots();
