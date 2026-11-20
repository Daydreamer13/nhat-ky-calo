// store.js — lưu dữ liệu ngay trên điện thoại bằng IndexedDB.
//   kv:     profile · settings · meta · favs
//   days:   'YYYY-MM-DD' → { meals, weight?, water?, tg?, td? }
//   photos: mã ảnh → data URL (JPEG thu nhỏ)
// Nếu trình duyệt chặn IndexedDB (chế độ riêng tư cũ…), dùng bộ nhớ tạm + localStorage (không lưu ảnh).

const DB_NAME = "nhat-ky-calo";
const DB_VERSION = 1;
const LS_FALLBACK = "nhat-ky-calo.fallback.v1";

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error("IndexedDB")); });
// Lỗi của một yêu cầu nổi lên tới giao dịch TRƯỚC khi giao dịch bị huỷ, lúc đó tx.error còn trống: lấy lỗi của chính yêu cầu ấy
// (nhờ vậy mới phân biệt được "bộ nhớ đầy" với "mất kết nối").
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = (ev) => rej(tx.error || (ev && ev.target && ev.target.error) || new Error("IndexedDB")); tx.onabort = () => rej(tx.error || new Error("IndexedDB abort")); });

/** Máy hết chỗ lưu (khác với mất kết nối tới kho dữ liệu). */
export const isQuotaError = (e) => !!e && (e.name === "QuotaExceededError" || e.code === 22);
/** Lỗi báo ra khi kết nối tới kho dữ liệu đã mất và mở lại cũng không được: chỉ còn cách tải lại app. */
function lostError(cause) {
  const e = new Error("IndexedDB: mất kết nối, mở lại không được");
  e.name = "StoreLost";
  e.cause = cause;
  return e;
}

function openDb() {
  return new Promise((resolve, reject) => {
    let r;
    try { r = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const name of ["kv", "days", "photos"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close(); // một tab khác nâng cấp: nhường
      resolve(db);
    };
    r.onerror = () => reject(r.error || new Error("IndexedDB"));
    r.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

/** Mở lại kết nối, chờ tối đa 5 giây (trên iPhone, sau khi mất kết nối có lúc lệnh mở treo mãi không trả lời). */
function reopenDb() {
  return new Promise((resolve, reject) => {
    let late = false;
    const timer = setTimeout(() => { late = true; reject(new Error("IndexedDB open timeout")); }, 5000);
    openDb().then(
      (d) => { if (late) { try { d.close(); } catch {} return; } clearTimeout(timer); resolve(d); },
      (e) => { if (!late) { clearTimeout(timer); reject(e); } },
    );
  });
}

// Dấu "kho vừa được ghi" (để ngoài kho chính, trong localStorage): tab Chrome và app trên màn hình chính của Android là hai bản
// của app dùng chung MỘT kho. Mỗi lần ghi xong vào "kv" hoặc "days", bản vừa ghi đổi dấu này; bản nào thấy dấu khác với dấu
// mình đã thấy lần cuối thì biết số liệu trong bộ nhớ của mình đã cũ và phải đọc lại kho trước khi ghi tiếp (state.refresh).
const REV_LS = "nhat-ky-calo.rev";
function revision() {
  let seen = null; // dấu bản này thấy lần cuối (lúc đọc kho, hoặc ngay sau lần ghi của chính nó)
  let behind = false; // bản này vừa ghi mà chưa đọc thay đổi của bản kia
  // Số lần bản này đã BẮT ĐẦU ghi (để biết có lần ghi nào chen vào giữa một lượt đọc lại). Đếm lúc bắt đầu chứ không đợi ghi
  // xong: lệnh ghi phát ra giữa lúc đang đọc lại chỉ xong SAU lượt đọc ấy, đếm lúc xong thì lượt đọc không biết mình đã thiếu.
  let started = 0;
  const read = () => { try { return localStorage.getItem(REV_LS); } catch { return null; } };
  const move = () => {
    if (read() !== seen) behind = true;
    try { localStorage.setItem(REV_LS, Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)); } catch {}
    // Nhớ đúng cái localStorage đang giữ, không phải cái vừa định ghi: localStorage bị chặn hay đầy thì bản này cũng
    // không bao giờ tự thấy mình "cũ" mãi mãi.
    seen = read();
  };
  return {
    /** Gọi NGAY TRƯỚC khi đọc toàn bộ kho: coi dấu hiện tại là "đã thấy". Trả về mốc để hỏi lại stale(mốc) sau khi đọc xong. */
    see() { seen = read(); behind = false; return started; },
    /**
     * Gọi NGAY TRƯỚC mỗi lần ghi (chưa biết thành hay bại). Đổi dấu luôn từ lúc này, không đợi ghi xong: bản kia vừa nhận kết quả
     * của một bữa đang tính sẽ thấy dấu đã đổi, đọc lại kho (lượt đọc ấy xếp hàng sau lần ghi này nên thấy nó) rồi mới ghi —
     * nếu đợi ghi xong mới đổi dấu, bản kia chép đè cả ngày bằng số liệu cũ trong đúng một hai mili-giây lần ghi còn dang dở.
     */
    begin() { started++; move(); },
    /** Gọi sau mỗi lần ghi thành công. */
    bump() { move(); },
    /** Số liệu trong bộ nhớ có thể đã cũ? since: mốc do see() trả về — có lần ghi nào (của chính bản này) bắt đầu từ lúc đó cũng tính. */
    stale(since) { return behind || read() !== seen || (since !== undefined && since !== started); },
    /** Lượt đọc lại không thành: vẫn còn cũ. */
    miss() { behind = true; },
  };
}

function idbStore(first) {
  // Kết nối có thể chết giữa chừng (iPhone dừng tiến trình nền khi app nằm lâu ở chế độ nền): không giữ cứng một kết nối.
  // db = null nghĩa là đã mất/đã đóng; lần dùng kế tiếp sẽ mở lại.
  let db = null, opening = null;
  const adopt = (d) => {
    d.onclose = () => { if (db === d) db = null; }; // trình duyệt tự đóng kết nối
    d.onversionchange = () => { d.close(); if (db === d) db = null; }; // một tab khác nâng cấp: nhường
    db = d;
    return d;
  };
  adopt(first);
  const conn = () => {
    if (db) return Promise.resolve(db);
    if (!opening) opening = reopenDb().then(adopt).finally(() => { opening = null; });
    return opening;
  };
  /**
   * Chạy fn(kết nối). Hỏng vì bất cứ lý do gì ngoài "bộ nhớ đầy": mở lại kết nối và thử thêm đúng MỘT lần
   * (mọi thao tác ở đây đều đọc, ghi/xoá theo khoá hoặc là một giao dịch trọn gói, nên làm lại không sinh trùng lặp).
   * Vẫn hỏng thì ném lỗi tên "StoreLost" để tầng trên báo người dùng tải lại app.
   */
  async function run(fn) {
    let used = null;
    try { used = await conn(); return await fn(used); } catch (e) {
      if (isQuotaError(e)) throw e;
      if (!used) throw lostError(e); // ngay việc mở lại kết nối cũng không được
      if (db === used) { db = null; try { used.close(); } catch {} }
      try { return await fn(await conn()); } catch (e2) {
        if (isQuotaError(e2)) throw e2;
        throw lostError(e2);
      }
    }
  }
  const rev = revision();
  // Ghi xong vào "kv" / "days" thì đổi dấu (ảnh thì không: ảnh không nằm trong bộ nhớ của bản nào, không ai ghi đè ai).
  const wrote = (store) => { if (store !== "photos") rev.bump(); };
  /** Một lần ghi: báo cho dấu biết NGAY lúc bắt đầu (xem revision), chạy như run(), xong thì đổi dấu. */
  const write = (store, fn) => { if (store !== "photos") rev.begin(); return run(fn).then(() => wrote(store)); };
  const put = (store, key, value) => write(store, async (d) => { const tx = d.transaction(store, "readwrite"); tx.objectStore(store).put(value, key); await done(tx); });
  const del = (store, key) => write(store, async (d) => { const tx = d.transaction(store, "readwrite"); tx.objectStore(store).delete(key); await done(tx); });
  return {
    mode: "idb",
    loadAll: () => run(async (d) => {
      const tx = d.transaction(["kv", "days"], "readonly");
      const kvS = tx.objectStore("kv"), dayS = tx.objectStore("days");
      const [kvKeys, kvVals, dayKeys, dayVals] = await Promise.all([req(kvS.getAllKeys()), req(kvS.getAll()), req(dayS.getAllKeys()), req(dayS.getAll())]);
      const kv = {}, days = {};
      kvKeys.forEach((k, i) => { kv[k] = kvVals[i]; });
      dayKeys.forEach((k, i) => { days[k] = dayVals[i]; });
      return { kv, days };
    }),
    setKV: (key, value) => put("kv", key, value),
    putDay: (key, day) => (day ? put("days", key, day) : del("days", key)),
    getPhoto: (id) => run((d) => req(d.transaction("photos", "readonly").objectStore("photos").get(id))).then((v) => v || null),
    putPhoto: (id, dataUrl) => put("photos", id, dataUrl),
    delPhoto: (id) => del("photos", id),
    photoIds: () => run((d) => req(d.transaction("photos", "readonly").objectStore("photos").getAllKeys())),
    allPhotos: () => run(async (d) => {
      const s = d.transaction("photos", "readonly").objectStore("photos");
      const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
      const out = {};
      keys.forEach((k, i) => { out[k] = vals[i]; });
      return out;
    }),
    /** Thay toàn bộ dữ liệu trong MỘT giao dịch: hoặc xong hết, hoặc giữ nguyên bản cũ. */
    replaceAll: ({ kv, days, photos }) => write("all", async (d) => {
      const tx = d.transaction(["kv", "days", "photos"], "readwrite");
      const kvS = tx.objectStore("kv"), dayS = tx.objectStore("days"), phS = tx.objectStore("photos");
      kvS.clear(); dayS.clear(); phS.clear();
      for (const [k, v] of Object.entries(kv || {})) kvS.put(v, k);
      for (const [k, v] of Object.entries(days || {})) dayS.put(v, k);
      for (const [k, v] of Object.entries(photos || {})) phS.put(v, k);
      await done(tx);
    }),
    /** Đọc thử một cái thật nhẹ để biết kết nối còn sống không (có tự mở lại như mọi thao tác khác). */
    ping: () => run((d) => req(d.transaction("kv", "readonly").objectStore("kv").count())).then(() => true),
    /** Dấu "kho vừa được ghi" — xem revision() ở trên. Chỉ kho IndexedDB mới có. */
    revSee: rev.see,
    revStale: rev.stale,
    revMiss: rev.miss,
  };
}

function memoryStore() {
  let state = { kv: {}, days: {} };
  const photos = {};
  try { const s = JSON.parse(localStorage.getItem(LS_FALLBACK) || "null"); if (s && s.kv && s.days) state = s; } catch {}
  const save = () => { try { localStorage.setItem(LS_FALLBACK, JSON.stringify(state)); } catch {} };
  return {
    mode: "memory",
    async loadAll() { return JSON.parse(JSON.stringify(state)); },
    async setKV(key, value) { state.kv[key] = value; save(); },
    async putDay(key, day) { if (day) state.days[key] = day; else delete state.days[key]; save(); },
    async getPhoto(id) { return photos[id] || null; },
    async putPhoto(id, dataUrl) { photos[id] = dataUrl; },
    async delPhoto(id) { delete photos[id]; },
    async photoIds() { return Object.keys(photos); },
    async allPhotos() { return { ...photos }; },
    async replaceAll({ kv, days, photos: ph }) {
      state = { kv: kv || {}, days: days || {} };
      for (const k of Object.keys(photos)) delete photos[k];
      Object.assign(photos, ph || {});
      save();
    },
    async ping() { return true; },
  };
}

// Dấu "máy này đã có nhật ký", để ngoài kho chính (localStorage) vì nó dùng đúng lúc kho chính không mở được.
const HAS_DIARY_LS = "nhat-ky-calo.has-data";
const UNSAVED_LS = "nhat-ky-calo.unsaved.v1"; // bản chép tạm những phần chưa ghi được (state.js): có nó cũng là có nhật ký
/** state.js gọi khi có hồ sơ (tạo mới, khôi phục, mở app) và khi xoá hết dữ liệu. */
export function markDiary(on) {
  try { if (on) localStorage.setItem(HAS_DIARY_LS, "1"); else localStorage.removeItem(HAS_DIARY_LS); } catch {}
}
function hasDiary() {
  try { return !!(localStorage.getItem(HAS_DIARY_LS) || localStorage.getItem(UNSAVED_LS)); } catch { return false; }
}

export async function openStore() {
  if (typeof indexedDB === "undefined") return memoryStore();
  try { return idbStore(await openDb()); } catch {}
  // Lần mở đầu hỏng: chờ một nhịp rồi thử thêm đúng một lần (có giới hạn 5 giây).
  await new Promise((r) => setTimeout(r, 400));
  try { return idbStore(await reopenDb()); } catch (e) {
    // Máy đã có nhật ký: KHÔNG lặng lẽ chuyển sang bộ nhớ tạm — app sẽ hiện màn hình làm quen như thể mất hết dữ liệu, trong khi
    // dữ liệu trên máy vẫn còn nguyên. Ném lỗi để app hiện "Chưa mở được app" kèm nút Tải lại.
    if (hasDiary()) throw e;
    return memoryStore(); // máy mới, trình duyệt chặn IndexedDB: dùng tạm bộ nhớ + localStorage như trước
  }
}

/** Xin trình duyệt đừng tự dọn dữ liệu của app. Đã được rồi thì không xin nữa; không được thì thôi (lần mở app sau xin lại). */
export async function askPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {}
  return false;
}
