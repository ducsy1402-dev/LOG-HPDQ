// Bảng có dòng tổng cố định (.cao-bang) tự VỪA KHÍT màn hình (anh Sỹ 24/11/2026): trước đây chiều cao tối đa đặt cứng theo "100dvh − 410px" nên màn hình khác cỡ thì bảng thừa chỗ trống hoặc bị cắt dòng tổng.
// Cách làm: đo chỗ còn lại từ đầu bảng tới đáy vùng cuộn gần nhất (trang hoặc hộp thoại), trừ phần nội dung nằm dưới bảng (nút Thêm, ghi chú…), và đặt max-height cho bảng.
// Chạy lại khi đổi cỡ cửa sổ, bật / tắt toàn màn hình, hoặc nội dung trang thay đổi. Không cần sửa từng bảng: chỉ cần có class `cao-bang`.
const NHO_NHAT = 180;

function vungCuon(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.clientHeight > 0) return p;
  }
  return null; // cuộn cả trang
}

function tinh(el) {
  if (!el.isConnected || el.offsetParent === null) return;
  el.style.removeProperty("max-height");
  const sc = vungCuon(el), goc = document.scrollingElement || document.documentElement;
  const tuNhien = el.offsetHeight;
  const rect = el.getBoundingClientRect();
  const nhin = sc ? sc.clientHeight : window.innerHeight;
  const dau = sc ? rect.top - sc.getBoundingClientRect().top + sc.scrollTop : rect.top + goc.scrollTop;
  const tong = sc ? sc.scrollHeight : goc.scrollHeight;
  const duoi = Math.max(0, tong - (dau + tuNhien)); // nội dung nằm dưới bảng (kể cả lề)
  const chua = Math.floor(nhin - dau - duoi);
  if (tuNhien > chua) el.style.setProperty("max-height", Math.max(NHO_NHAT, chua) + "px", "important");
}

let cho = 0;
export function tinhLaiVuaManHinh() {
  if (cho) return;
  cho = requestAnimationFrame(() => { cho = 0; document.querySelectorAll(".cao-bang").forEach(tinh); });
}

let da = false;
export function batVuaManHinh() {
  if (da || typeof window === "undefined") return;
  da = true;
  window.addEventListener("resize", tinhLaiVuaManHinh);
  window.addEventListener("tmh-doi", tinhLaiVuaManHinh);
  new MutationObserver(tinhLaiVuaManHinh).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-state"] });
  tinhLaiVuaManHinh();
}
