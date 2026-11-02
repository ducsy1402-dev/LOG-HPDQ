// Tên bến hiển thị như màn hình phần mềm tàu: B01…B11, BTL (bến 1A Tàu Lai), HH2, HH3, 6CTH, 7CTH
export const tenBen = (ma) => (ma == null ? "" : /^\d+$/.test(ma) ? "B" + String(ma).padStart(2, "0") : ma === "1A" ? "BTL" : ma);

// Thứ tự bến dọc tuyến (Danh mục › Cầu bến, cột thứ tự): để ghi tàu cập hai bến theo đúng chiều tuyến, VD "B07/08" chứ không "B08/07".
// store gọi datThuTuBen mỗi lần tải danh mục bến.
let THU_TU = new Map();
export const datThuTuBen = (berths) => { THU_TU = new Map((berths || []).map((b) => [String(b.ma), +b.thu_tu || 0])); };
const truocSau = (a, b) => (THU_TU.get(String(a)) ?? 0) - (THU_TU.get(String(b)) ?? 0) || String(a).localeCompare(String(b), undefined, { numeric: true });
// Hai bến theo chiều tuyến; bỏ phần chữ đầu trùng nhau ở bến sau: B07/08, HH2/3, B03/05
export function noiHaiBen(a, b, ten = tenBen) {
  if (!b) return ten(a);
  const [x, y] = [a, b].sort(truocSau), tx = ten(x), ty = ten(y), p = /^[A-Za-z]+/.exec(tx)?.[0] || "";
  return p && ty.startsWith(p) && /^\d/.test(ty.slice(p.length)) ? `${tx}/${ty.slice(p.length)}` : `${tx}/${ty}`;
}
// Tên bến của chuyến: một bến (B05) hoặc hai bến khi có bến phụ (B07/08)
export const tenBenChuyen = (v) => (v?.ben_ma ? noiHaiBen(v.ben_ma, v.ben_phu) : "");
// Vị trí mét của tàu trên tuyến bến như bảng kế hoạch: "(230–397)"; chưa ghi vị trí thì ""
export const viTriChu = (x, loa) => (x == null || x === "" || !Number.isFinite(+x) ? "" : `(${Math.round(+x)}–${+loa > 0 ? Math.round(+x + +loa) : "?"})`);
