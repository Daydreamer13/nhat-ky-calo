// photo.js — đọc ảnh từ máy ảnh/thư viện, xoay đúng chiều, thu nhỏ.
//   forAi:  JPEG cạnh dài 1280 px để gửi Claude (đủ rõ món ăn, nhẹ và rẻ)
//   keep:   JPEG cạnh dài 480 px để lưu trong nhật ký

const AI_EDGE = 1280, AI_QUALITY = 0.86;
const KEEP_EDGE = 480, KEEP_QUALITY = 0.72;

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    // Chỉ dùng ImageBitmap khi trình duyệt hiểu "from-image" (xoay theo EXIF). Safari trên iOS 15–16 không hiểu tuỳ chọn này,
    // mà gọi không kèm tuỳ chọn thì ảnh chụp dọc bị xoay ngang: để các máy đó rơi xuống cách đọc bằng <img> (luôn xoay đúng chiều).
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

function toJpeg(src, maxEdge, quality) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  if (!w || !h) throw new Error("empty image");
  const s = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; // ảnh PNG nền trong suốt → nền trắng
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", quality);
  c.width = c.height = 0; // trả bộ nhớ sớm trên máy yếu
  if (!url.startsWith("data:image/jpeg")) throw new Error("encode");
  return url;
}

/**
 * @returns {Promise<{ ai: { b64: string, mediaType: 'image/jpeg' }, keep: string }>}
 * Ném lỗi nếu trình duyệt không đọc được ảnh (ví dụ HEIC trên Android cũ).
 */
export async function prepareImage(file) {
  const src = await decode(file);
  try {
    const aiUrl = toJpeg(src, AI_EDGE, AI_QUALITY);
    const keep = toJpeg(src, KEEP_EDGE, KEEP_QUALITY);
    return { ai: { b64: aiUrl.slice(aiUrl.indexOf(",") + 1), mediaType: "image/jpeg" }, keep };
  } finally {
    if (src && typeof src.close === "function") src.close();
  }
}
