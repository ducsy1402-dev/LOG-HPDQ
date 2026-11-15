// Kiểm thử: Chiến dịch vận chuyển (Thiết bị cơ giới › Kế hoạch & báo cáo › Chiến dịch)
// Số liệu 4 trường hợp lấy đúng từ "File tính toán tham khảo.xlsx" của anh Sỹ.
import { describe, it, expect } from "vitest";
import { tinhLyThuyet, phuongAn, moPhong, moPhongCD, taoLich, tuyenMoi, caMacDinh, gioLamCa, bangCa, tomTat, thuSoXe } from "../thietbi/lib/chienDich";

// TG chạy 0,4 giờ = 4 km đi 20 km/h + 4 km về 20 km/h; TG xếp (giờ) = tải ÷ năng suất điểm xếp
const goc = (them) => tuyenMoi(1, { quang_duong: 4, toc_do_co_hang: 20, toc_do_khong_tai: 20, tg_phu: 0, tai_chuyen: 27, ns_vun: 0, ...them });
const nsXep = (gio) => 27 / gio;
const CA = caMacDinh(); // 12 giờ, nghỉ 60 phút → 11 giờ định mức

describe("Công thức theo file Excel", () => {
  it("giờ làm định mức 11 giờ / ca", () => expect(gioLamCa(CA)).toBe(11));

  it("1 · ưu tiên năng suất dỡ", () => {
    const ly = tinhLyThuyet(goc({ uu_tien: "do", so_diem_do: 2, tg_do: 10, ns_xep: nsXep(0.13333333333333333), khoi_luong: 5000 }), CA);
    expect(ly.T).toBeCloseTo(0.7, 6);
    expect(ly.A).toBeCloseTo(8.4, 6);
    expect(ly.Cx).toBeCloseTo(1.6, 6);
    expect(ly.ns).toBeCloseTo(324, 6);
    expect(5000 / ly.ns).toBeCloseTo(15.432098765, 6);
  });

  it("2 · ưu tiên năng suất xếp", () => {
    const ly = tinhLyThuyet(goc({ uu_tien: "xep", so_diem_xep: 2, ns_xep: nsXep(0.18333333333333332), tg_do: 10, khoi_luong: 2500 }), CA);
    expect(ly.T).toBeCloseTo(0.75, 6);
    expect(ly.A).toBeCloseTo(8.181818, 5);
    expect(ly.Cd).toBeCloseTo(1.818181, 5);
    expect(ly.ns).toBeCloseTo(294.545454, 4);
  });

  it("3 · ưu tiên số xe vận chuyển", () => {
    const ly = tinhLyThuyet(goc({ uu_tien: "xe", so_xe: 10, ns_xep: nsXep(0.15), tg_do: 10, khoi_luong: 5000 }), CA);
    expect(ly.Cd).toBeCloseTo(2.325581, 5);
    expect(ly.Cx).toBeCloseTo(2.093023, 5);
    expect(ly.ns).toBeCloseTo(376.744186, 4);
    expect(5000 / ly.ns).toBeCloseTo(13.271604, 5);
  });

  it("4 · ưu tiên thời gian làm hàng", () => {
    const ly = tinhLyThuyet(goc({ uu_tien: "tg", thoi_han: 11, don_vi_han: "gio", ns_xep: nsXep(0.18333333333333332), tg_do: 10, khoi_luong: 3240 }), CA);
    expect(ly.ns).toBeCloseTo(294.545454, 4);
    expect(ly.A).toBeCloseTo(8.181818, 5);
    expect(ly.Cd).toBeCloseTo(1.818181, 5);
    expect(ly.Cx).toBeCloseTo(2, 6);
    // thời hạn 1 ca = 11 giờ làm
    const ly2 = tinhLyThuyet(goc({ uu_tien: "tg", thoi_han: 1, don_vi_han: "ca", ns_xep: nsXep(0.18333333333333332), tg_do: 10, khoi_luong: 3240 }), CA);
    expect(ly2.ns).toBeCloseTo(ly.ns, 6);
  });

  it("thiếu số liệu thì báo lỗi, không tính", () => {
    expect(tinhLyThuyet(goc({ khoi_luong: "" }), CA).loi.length).toBeGreaterThan(0);
    expect(phuongAn(goc({ ns_xep: 0 }), CA).loi.length).toBeGreaterThan(0);
  });
});

describe("Phương án làm tròn và nút thắt", () => {
  const t = goc({ uu_tien: "do", so_diem_do: 2, tg_do: 10, ns_xep: nsXep(0.13333333333333333), khoi_luong: 5000, ns_vun: 400 });
  it("làm tròn lên: 9 xe, 2 điểm xếp, nút thắt ở điểm dỡ, xe phải chờ", () => {
    const pa = phuongAn(t, CA);
    expect([pa.A, pa.Cx, pa.Cd]).toEqual([9, 2, 2]);
    expect(pa.nutThat).toBe("do");
    expect(pa.ns).toBeCloseTo(324, 6);
    expect(pa.gianCach).toBeCloseTo(5, 6);   // 2 xe liên tiếp trên tuyến cách 5 phút
    expect(pa.gcDo).toBeCloseTo(10, 6);      // tại mỗi điểm dỡ cách 10 phút
    expect(pa.cho * 60).toBeCloseTo(3, 6);   // 9 xe: mỗi vòng chờ 3 phút
    expect(pa.soXeVun).toBe(1);
  });
  it("sửa tay 8 xe: nút thắt chuyển sang số xe", () => {
    const pa = phuongAn({ ...t, chon: { so_xe: 8 } }, CA);
    expect(pa.A).toBe(8);
    expect(pa.nutThat).toBe("xe");
    expect(pa.ns).toBeCloseTo((8 / 0.7) * 27, 6);
    expect(pa.cho).toBeCloseTo(0, 9);
  });
  it("thử số xe: thêm xe quá nút thắt không tăng năng suất", () => {
    const pa = phuongAn(t, CA), ds = thuSoXe(t, CA, pa);
    const a9 = ds.find((x) => x.A === 9), a12 = ds.find((x) => x.A === 12);
    expect(a12.ns).toBeCloseTo(a9.ns, 6);
  });
});

describe("Lịch ca và mô phỏng", () => {
  it("ca 08h–20h, nghỉ 12h–13h: việc 2 giờ từ 11h xong lúc 14h", () => {
    const L = taoLich(CA), t = +new Date(2026, 10, 16, 11, 0);
    const r = L.chay(t, 2 * 3600e3, 0);
    expect(new Date(r.kt).getHours()).toBe(14);
    expect(r.manh.length).toBe(2);
  });
  it("nghỉ luân phiên 2 nhóm: xe lẻ nghỉ sau xe chẵn", () => {
    const L = taoLich({ ...CA, nghi: [{ id: "a", sau: 4, phut: 60, kieu: "luan", nhom: 2 }] });
    const w = L.cuaSo(+new Date(2026, 10, 16, 9, 0));
    expect(new Date(L.khoangNghi(w, 0)[0][0]).getHours()).toBe(12);
    expect(new Date(L.khoangNghi(w, 1)[0][0]).getHours()).toBe(13);
  });
  it("mô phỏng giao đủ khối lượng, không chồng xe ở điểm dỡ", () => {
    const t = goc({ uu_tien: "do", so_diem_do: 2, tg_do: 10, ns_xep: nsXep(0.13333333333333333), khoi_luong: 5000 });
    const pa = phuongAn(t, CA);
    const mp = moPhong(t, pa, CA, new Date(2026, 10, 16, 8, 0).toISOString());
    expect(mp.chuyen.length).toBe(Math.ceil(5000 / 27));
    expect(mp.tich[mp.tich.length - 1][1]).toBeCloseTo(5000, 6);
    // mỗi điểm dỡ: các lượt dỡ không chồng nhau
    for (let q = 0; q < pa.Cd; q++) {
      const ds = mp.chuyen.filter((c) => c.diemDo === q).sort((a, b) => a.bdo - b.bdo);
      for (let i = 1; i < ds.length; i++) expect(ds[i].bdo).toBeGreaterThanOrEqual(ds[i - 1].giao - 1);
    }
    // 15,4 giờ làm ≈ hơn 1 ca: phải sang ca 2 (20h)
    expect(mp.caKH.length).toBeGreaterThanOrEqual(2);
    const tongCa = mp.caKH.reduce((a, c) => a + c.kl, 0);
    expect(tongCa).toBeCloseTo(5000, 6);
  });
  it("nghỉ luân phiên: mỗi xe nghỉ đủ 60 phút / ca, điểm xếp không bị giữ khi xe nghỉ", () => {
    const ca = { ...CA, nghi: [{ id: "l", ten: "Ăn ca", sau: 4, phut: 60, kieu: "luan", nhom: 2 }] };
    const t = goc({ uu_tien: "do", so_diem_do: 2, tg_do: 10, ns_xep: nsXep(0.13333333333333333), khoi_luong: 3000 });
    const pa = phuongAn(t, ca);
    const mp = moPhong(t, pa, ca, new Date(2026, 10, 16, 8, 0).toISOString());
    for (let i = 0; i < pa.A; i++) {
      const nghi = mp.chuyen.filter((c) => c.xe === i).flatMap((c) => c.doan.filter(([k]) => k === "nghi"));
      expect(nghi.length).toBe(1);
      expect(nghi[0][2] - nghi[0][1]).toBe(3600e3);
    }
    // không có xe nào chờ điểm xếp quá 30 phút
    const choMax = Math.max(...mp.chuyen.flatMap((c) => c.doan.filter(([k]) => k === "cho").map(([, a, b2]) => b2 - a)));
    expect(choMax).toBeLessThan(30 * 60000);
  });
  it("nhiều tuyến: cộng khối lượng, báo cáo thực tế", () => {
    const cd = { bat_dau: new Date(2026, 10, 16, 8, 0).toISOString(), cau_hinh: CA, tuyen: [goc({ id: "a", khoi_luong: 2000 }), goc({ id: "b", khoi_luong: 3000, uu_tien: "xe", so_xe: 6 })] };
    const kq = moPhongCD(cd);
    expect(kq.tong.xe).toBe(kq.tuyen[0].pa.A + 6);
    expect(kq.tich[kq.tich.length - 1][1]).toBeCloseTo(5000, 6);
    const ca1 = kq.caKH[0];
    const tt = [{ tuyen_id: "a", ngay: ca1.ngay, ca: ca1.so, khoi_luong: 1000 }, { tuyen_id: "b", ngay: ca1.ngay, ca: ca1.so, khoi_luong: 1500 }];
    const rows = bangCa(kq, tt, null, ca1.e + 1);
    expect(rows[0].tt).toBe(2500);
    const tom = tomTat(kq, rows, kq.tongKL, ca1.e + 1);
    expect(tom.tt).toBe(2500);
    expect(tom.nhip).toBe(2500);
    expect(tom.duBao).toBeGreaterThan(ca1.e);
    expect(bangCa(kq, tt, "a", ca1.e + 1)[0].tt).toBe(1000);
  });
});
