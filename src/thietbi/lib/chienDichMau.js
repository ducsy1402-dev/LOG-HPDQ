// Chiến dịch mẫu cho chế độ demo (?demo): bắt đầu 08:00 hôm qua, 2 tuyến chạy cùng lúc, thực tế các ca đã qua (≈ 85–105% kế hoạch)
import { caMacDinh, moPhongCD, tuyenMoi, nghiMoi } from "./chienDich";

export function chienDichMau(now = new Date()) {
  const bd = new Date(now); bd.setDate(bd.getDate() - 1); bd.setHours(8, 0, 0, 0);
  const ca = { ...caMacDinh(), nghi: [nghiMoi({ id: "n1", ten: "Nghỉ ăn ca", sau: 4, phut: 60, kieu: "luan", nhom: 2 })] };
  const cd = {
    id: 100, ten: "Hạ quặng tàu CAPE SEAGULL về bãi", bat_dau: bd.toISOString(), trang_thai: "dang_chay",
    ghi_chu: "Mẫu của bản demo: 2 tuyến chạy cùng lúc.", cau_hinh: ca,
    tuyen: [
      tuyenMoi(1, { id: "t1", ten: "Bến B10 → Bãi quặng A", hang: "Quặng sắt", diem_xep: "Bến B10 (phễu cẩu)", diem_do: "Bãi quặng A",
        khoi_luong: 24000, tai_chuyen: 27, quang_duong: 3.5, toc_do_co_hang: 20, toc_do_khong_tai: 25, tg_phu: 2,
        loai_xep: "Cẩu bốc", ns_xep: 220, tg_do: 8, loai_vun: "Xe xúc lật", ns_vun: 450, uu_tien: "do", so_diem_do: 3 }),
      tuyenMoi(2, { id: "t2", ten: "Bãi than C → Luyện cốc", hang: "Than", diem_xep: "Bãi than C", diem_do: "Kho than luyện cốc",
        khoi_luong: 9000, tai_chuyen: 30, quang_duong: 6, toc_do_co_hang: 25, toc_do_khong_tai: 30, tg_phu: 3,
        loai_xep: "Xe xúc", ns_xep: 180, tg_do: 10, loai_vun: "Xe ủi", ns_vun: 300, uu_tien: "xe", so_xe: 8 }),
    ],
    created_at: bd.toISOString(), updated_at: bd.toISOString(),
  };
  const kq = moPhongCD(cd);
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const thucTe = [];
  let id = 0;
  for (const c of kq.caKH) {
    if (c.e > +now) break;
    for (const t of cd.tuyen) {
      const k = c.tuyen[t.id];
      if (!k) continue;
      const f = 0.85 + rnd() * 0.2;
      thucTe.push({ id: ++id, chien_dich_id: cd.id, tuyen_id: t.id, ngay: c.ngay, ca: c.so, khoi_luong: Math.round(k.kl * f), so_chuyen: Math.round(k.chuyen * f), so_xe: k.xe - (rnd() < 0.3 ? 1 : 0), ghi_chu: f < 0.9 ? "1 xe hỏng giữa ca" : "" });
    }
  }
  return { list: [cd], thucTe };
}
