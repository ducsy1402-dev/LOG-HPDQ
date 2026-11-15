// Kiểm thử: cẩu tàu, phương thức định lượng / thuê ngoài, xe của phương án đi vào Dài hạn (Cảng và bãi), không vào Ngắn hạn
import { describe, it, expect } from "vitest";
import { tocDoGoiY, tinhPhuongAn } from "./phuongAn";
import { viecTauTuLinetime, viecBaiTuLinetime } from "./tauDaiHan";
import { duLieuBieuMau, phuongThucCua, thueNgoaiCua } from "./bieuMauPA";
import { calc12 } from "../thietbi/lib/plan";
import { tenGanCau, dsGanCau } from "./thietBi";
import { thietBiChuyen, tinhSoBo, xeGoiY } from "./phuongAn";

const t = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const iso = (...a) => new Date(t(...a)).toISOString();
const NOW = t(2026, 10, 30);

describe("Cẩu tàu", () => {
  it("năng suất cẩu tàu (số cẩu × t/h nhập tay) cộng vào tốc độ gợi ý", () => {
    const g = tocDoGoiY([{ ma: "QC06", nang_suat: "2000" }], { cau: ["QC06"], cau_tau: { so: 2, nang_suat: 800 }, gio_lam_ngay: 20, he_so: 0.5 });
    expect(g.tph).toBe(3600);
    expect(g.tanNgay).toBe(36000);
    expect(g.thieuCauTau).toBe(false);
  });
  it("chỉ có cẩu tàu; tick mà chưa nhập năng suất thì báo thiếu", () => {
    expect(tocDoGoiY([], { cau: [], cau_tau: { so: 2, nang_suat: 500 }, gio_lam_ngay: 22, he_so: 0.6 }).tanNgay).toBeCloseTo(13200, 6);
    const g = tocDoGoiY([], { cau: [], cau_tau: { so: 2, nang_suat: "" }, gio_lam_ngay: 22, he_so: 0.6 });
    expect(g.tanNgay).toBe(null);
    expect(g.thieuCauTau).toBe(true);
  });
});

describe("Phiếu in lấy theo phương án", () => {
  const v = { ten_tau: "A", ben_ma: "5", huong: "nhap", khoi_luong: 1000, etb: iso(2026, 11, 1) };
  const kqCua = (plan) => tinhPhuongAn(v, plan, { now: NOW });
  it("phương thức định lượng và thuê ngoài do người lập chọn; bỏ trống thì tự điền", () => {
    const tuDong = { ten: "A", toc_do: 1000, xe: [{ loai: "Xe ben", so_xe: 2, don_vi: "hoa_phat" }], diem: [], tb_khac: [] };
    const du0 = duLieuBieuMau(v, tuDong, kqCua(tuDong), { now: NOW });
    expect(du0.chung.dinh_luong).toBe("Đo mớn");
    expect(du0.thueNgoai).toBe("khong");
    const p = { ...tuDong, bieu_mau: { phuong_thuc: "eticket", thue_ngoai: "co_ncc" } };
    const du = duLieuBieuMau(v, p, kqCua(p), { now: NOW });
    expect(du.chung.dinh_luong).toBe("Theo etiket");
    expect(du.thueNgoai).toBe("co_ncc");
    const k = { ...tuDong, bieu_mau: { phuong_thuc: "khac", phuong_thuc_khac: "Cân bãi" } };
    expect(duLieuBieuMau(v, k, kqCua(k), { now: NOW }).chung.dinh_luong).toBe("Cân bãi");
  });
  it("phương án cũ (chữ tự do, đúng / sai) đổi về lựa chọn gần nhất; các ô chung cũ không còn ghi đè", () => {
    expect(phuongThucCua({ dinh_luong: "Theo cân" }).k).toBe("can");
    expect(phuongThucCua({ dinh_luong: "Đo mớn" }).k).toBe("mon");
    expect(phuongThucCua({ dinh_luong: "Cân điện tử tại cảng" }).k).toBe("can");
    expect(phuongThucCua({ dinh_luong: "Ước lượng" })).toEqual({ k: "khac", khac: "Ước lượng" });
    expect(thueNgoaiCua({ thue_ngoai: true })).toBe("co");
    expect(thueNgoaiCua({ thue_ngoai: false })).toBe("khong");
    const p = { ten: "A", toc_do: 1000, xe: [], diem: [], tb_khac: [], bieu_mau: { luong: "Kho-Toa-Tàu", loai_xe: "Tự gõ" } };
    expect(duLieuBieuMau(v, p, kqCua(p), { now: NOW }).chung.luong).toBe("Tàu - Xe - Bãi");
  });
});

describe("Dài hạn: phương án đã duyệt hoặc phiếu chuyến (Bãi & Thiết bị), chia việc Cảng / việc bãi", () => {
  // Phiếu chuyến: 6 xe ben Hòa Phát + 3 nhà thầu, be hầm 1 xúc đào, hỗ trợ 1 xúc lật, hạ hàng 2 xúc lật (nhà thầu 1)
  const v = { id: 7, ten_tau: "TÀU A", ben_ma: "5", huong: "nhap", loai_hang: "Than", khoi_luong: 24000, cam_ket: 12000, etb: iso(2026, 11, 1, 8), etd: iso(2026, 11, 5),
    bai_kl: [{ bai: "Bãi A", khoi_luong: 24000, tb: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }, { loai: "Xúc lật", so: 1, don_vi: "nha_thau" }] }],
    xe_van_chuyen: [{ loai: "Xe ben", so: 6, don_vi: "hoa_phat" }, { loai: "Xe ben", so: 3, don_vi: "nha_thau" }],
    hot_vet: [{ viec: "be_ham", loai: "Xúc đào", so: 1, don_vi: "hoa_phat" }, { viec: "ho_tro", loai: "Xúc lật", so: 1, don_vi: "hoa_phat" }],
    vun_hang: [{ loai: "Xúc lật", so: 2, don_vi: "hoa_phat" }, { loai: "Xúc lật", so: 1, don_vi: "nha_thau" }] };
  // Phương án: 8 xe ben Hòa Phát + 2 nhà thầu, be hầm 2 xúc đào, hạ hàng 4 xúc lật, tốc độ 24.000 t/ngày từ 08:00 01/11
  const plan = { id: 1, ten: "A", trang_thai: "duyet", toc_do: 24000, khoi_dong: false, bat_dau: iso(2026, 11, 1, 8), bang_tai: null,
    xe: [{ loai: "Xe ben", so_xe: 8, don_vi: "hoa_phat" }, { loai: "Xe ben", so_xe: 2, don_vi: "nha_thau" }],
    diem: [{ bai: "Bãi B", khoi_luong: 24000, tb: [{ loai: "Xúc lật", so: 4, don_vi: "hoa_phat" }] }],
    tb_khac: [{ viec: "be_ham", loai: "Xúc đào", so: 2, don_vi: "hoa_phat" }] };
  const LD = { voyages: [v], plansOf: () => [plan], stopsOf: () => [], now: NOW };
  const opt = { now: NOW };

  it("đã duyệt phương án: thời gian theo phương án; số xe KHÔNG lấy từ phương án (nhập tay ở Timeline)", () => {
    expect(viecTauTuLinetime(LD, "Xe ben", opt).map((j) => [j.loai, j.so_xe_tay, j.nguon])).toEqual([["tau", null, "PA A (đã duyệt)"]]);
    expect(viecTauTuLinetime(LD, "Xúc đào", opt).map((j) => j.so_xe_tay)).toEqual([null]);
    expect(viecTauTuLinetime(LD, "Xúc lật", opt).map((j) => j.so_xe_tay)).toEqual([null]); // mọi tàu đều có dòng, kể cả đội phương án không dùng
    const bai = viecBaiTuLinetime(LD, "Xúc lật", opt);
    expect(bai[0]).toMatchObject({ loai: "bai", lt: 7, xe_ngay: 4, vi_tri: "Bãi B", tu_ngay: "2026-11-01", den_ngay: "2026-11-02" });
    expect(new Date(bai[0].den).getTime()).toBe(t(2026, 11, 2, 8)); // 24.000 t ÷ 24.000 t/ngày = 1 ngày
  });
  it("phương án chưa duyệt: thời gian theo ETB / cam kết, số xe để trống; việc bãi vẫn theo phiếu chuyến › Bãi & Thiết bị", () => {
    const L = { ...LD, plansOf: () => [{ ...plan, trang_thai: "nhap" }] };
    expect(viecTauTuLinetime(L, "Xe ben", opt).map((j) => [j.so_xe_tay, j.nguon])).toEqual([[null, "Bãi & thiết bị"]]);
    const bai = viecBaiTuLinetime(L, "Xúc lật", opt);
    expect(bai[0]).toMatchObject({ xe_ngay: 3, vi_tri: "Bãi A", tu_ngay: "2026-11-01" }); // 2 + 1 nhà thầu
    expect(new Date(bai[0].den).getTime()).toBe(t(2026, 11, 3, 8)); // theo cam kết 12.000 t/ngày: 2 ngày
  });
  it("chưa có phương án: tàu không lấy số xe từ phiếu chuyến; vun hàng → bãi theo phiếu chuyến", () => {
    const L2 = { ...LD, plansOf: () => [], voyages: [{ ...v, xe_van_chuyen: [{ loai: "Xe ben", so: 4, don_vi: "hoa_phat" }], hot_vet: [{ loai: "Xúc đào", so: 1, don_vi: "hoa_phat" }], vun_hang: [{ loai: "Xúc lật", so: 3, don_vi: "hoa_phat" }] }] };
    expect(viecTauTuLinetime(L2, "Xe ben", opt)[0].so_xe_tay).toBe(null);
    const bai = viecBaiTuLinetime(L2, "Xúc lật", opt);
    expect(bai[0].xe_ngay).toBe(3);
    expect(new Date(bai[0].den).getTime()).toBe(t(2026, 11, 3, 8)); // theo cam kết 12.000 t/ngày: 2 ngày
  });
  it("lưới ca: việc bãi của chuyến tàu chỉ tính các ca giao với khoảng thời gian của tàu", () => {
    const params = { p: { bd: "2026-11-01T00:00", gioN: 8, caLen: 12, nShifts: 6, moc: "2026-11-01T00:00", ramp1: 0.6, ramp2: 0.85, ramp3: 0.6, capCang: 0, capBai: 5, flag: 1, daoTao: 1 }, prod: [] };
    const job = { id: "lt-bai-1", loai: "bai", ten: "Hạ hàng", doi: "Xúc đào", xe_ngay: 2, xe_dem: 2, tu: iso(2026, 11, 1, 10), den: iso(2026, 11, 2, 9), tu_ngay: "2026-11-01", den_ngay: "2026-11-02" };
    const R = calc12(params, [job], "Xúc đào");
    expect(R.fixed[0].cnt).toEqual([2, 2, 2, 0, 0, 0]); // CA ngày 1/11, đêm 1/11, ngày 2/11 (08–20 giao với 08:00–09:00); đêm 2/11 thì không
  });
});

describe("Thiết bị gắn của cẩu", () => {
  it("bỏ chữ (cẩu cảng) khi hiện / lưu", () => {
    expect(tenGanCau("Mâm từ (cẩu cảng)")).toBe("Mâm từ");
    expect(dsGanCau(["Ngáng", "Nhóp (cẩu cảng)", ""])).toEqual(["Ngáng", "Nhóp"]);
  });
  it("phiếu in: công nghệ xếp dỡ = cẩu + thiết bị gắn; chuyến / phương án đều đọc được", () => {
    const v = { ten_tau: "A", ben_ma: "5", huong: "nhap", khoi_luong: 1000, etb: iso(2026, 11, 1), cau_gan: ["Gầu ngoạm"] };
    const plan = { ten: "A", toc_do: 1000, xe: [], diem: [], tb_khac: [], cau: ["SC05"], cau_gan: ["Mâm từ", "Ngáng"] };
    const du = duLieuBieuMau(v, plan, tinhPhuongAn(v, plan, { now: NOW }), { now: NOW });
    expect(du.luot[0].cn).toBe("Cầu bờ - Mâm từ + Ngáng");
    expect(thietBiChuyen(v, []).cauGan).toEqual(["Gầu ngoạm"]);
    expect(thietBiChuyen(v, [{ ...plan, id: 1, trang_thai: "duyet" }]).cauGan).toEqual(["Mâm từ", "Ngáng"]);
  });
});

describe("Số xe tự tính ở phiếu chuyến và khung xem nhanh", () => {
  const cranes = [{ ma: "SC01", nang_suat: "1000" }];
  const v = { id: 1, ten_tau: "A", huong: "xuat", khoi_luong: 24000, cam_ket: 12000, etb: iso(2026, 11, 1), cau: ["SC01"], cau_tau: { so: 2, nang_suat: 500 }, xe_van_chuyen: [{ loai: "Xe đầu kéo", tai_trong: 80, chuyen_ca: 5, so: null, don_vi: "nha_thau" }] };
  it("tốc độ theo cẩu + cẩu tàu: (1000 + 2 × 500) × 22 × 0,6 = 26.400 t/ngày → 13.200 t/ca → ÷ (80 × 5) = 33 xe", () => {
    const kq = tinhSoBo(v, { cranes, now: NOW });
    expect(kq.tanCa).toBeCloseTo(13200, 6);
    expect(xeGoiY(kq.tanCa, { tai_trong: 80, chuyen_ca: 5 })).toBe(33);
    expect(kq.xe[0].so).toBe(33);
  });
  it("chưa có cẩu: theo cam kết (12.000 t/ngày → 6.000 t/ca → 15 xe)", () => {
    const kq = tinhSoBo({ ...v, cau: [], cau_tau: null }, { cranes, now: NOW });
    expect(kq.tanCa).toBeCloseTo(6000, 6);
    expect(kq.xe[0].so).toBe(15);
  });
  it("khung xem nhanh: chuyến chưa có phương án hiện số xe cụ thể; có phương án để trống số xe cũng hiện số tính ra", () => {
    expect(thietBiChuyen(v, [], { cranes, now: NOW }).xe[0].so).toBe(33);
    expect(thietBiChuyen(v, []).xe[0].so).toBe(null); // không có ngữ cảnh: giữ nguyên
    const p = { id: 5, ten: "A", trang_thai: "duyet", gio_lam_ngay: 22, he_so: 0.6, khoi_dong: false, cau: ["SC01"], cau_tau: { so: 2, nang_suat: 500 }, xe: [{ loai: "Xe đầu kéo", tai_trong: 80, chuyen_ca: 5, so_xe: null, don_vi: "nha_thau" }], diem: [], tb_khac: [] };
    const tb = thietBiChuyen(v, [p], { cranes, now: NOW });
    expect(tb.xe[0].so).toBe(33);
    expect(tb.cauTau).toEqual({ so: 2, nang_suat: 500 });
  });
});

describe("Hệ số ca (chỉ một số đội xe dùng, có ô tick Áp dụng)", () => {
  const p = { bd: "2026-11-01T00:00", gioN: 8, caLen: 12, nShifts: 4, moc: "2026-11-01T00:00", ramp1: 0.5, ramp2: 0.5, ramp3: 0.5, capCang: 10, capBai: 0, flag: 1, daoTao: 1 };
  const tau = { id: "lt-1", lt: 1, loai: "tau", ten: "T", hang: "Than", vi_tri: "B1", khoi_luong: 20000, nang_suat: 500, bat_dau: iso(2026, 11, 1, 8), so_xe_tay: 8, doi: "Xe ben" };
  it("đội gốc Xúc đào mặc định áp dụng hệ số; đội khác mặc định không (mọi ca 100%)", () => {
    const goc = calc12({ p, prod: [] }, [{ ...tau, doi: "Xúc đào" }], "Xúc đào");
    expect(goc.ves[0].cnt[0]).toBe(4); // 8 xe × 50% ở ca đầu
    const khac = calc12({ p, prod: [] }, [tau], "Xe ben");
    expect(khac.ves[0].cnt[0]).toBe(8);
  });
  it("tick Áp dụng ở đội khác thì dùng hệ số; bỏ tick ở đội gốc thì 100%", () => {
    const co = calc12({ p, prod: [], doi: { "Xe ben": { heSo: true } } }, [tau], "Xe ben");
    expect(co.ves[0].cnt[0]).toBe(4);
    const khong = calc12({ p: { ...p, heSo: false }, prod: [] }, [{ ...tau, doi: "Xúc đào" }], "Xúc đào");
    expect(khong.ves[0].cnt[0]).toBe(8);
  });
});

describe("Số xe sửa tay từng ca (xe_ca) cùng với số xe tự chạy", () => {
  it("ca nào có số sửa tay thì dùng số đó, các ca khác vẫn tự tính; cntAuto giữ số tự tính", () => {
    const p = { bd: "2026-11-01T00:00", gioN: 8, caLen: 12, nShifts: 4, moc: "2026-11-01T00:00", ramp1: 1, ramp2: 1, ramp3: 1, capCang: 10, capBai: 0, flag: 1, daoTao: 1 };
    const tau = { id: "lt-1", lt: 1, loai: "tau", ten: "T", hang: "Than", vi_tri: "B1", khoi_luong: 20000, nang_suat: 500, bat_dau: iso(2026, 11, 1, 8), so_xe_tay: 6, doi: "Xe ben" };
    const R0 = calc12({ p, prod: [] }, [tau], "Xe ben");
    const ca1 = R0.shifts[1].st.toISOString();
    const R = calc12({ p, prod: [] }, [{ ...tau, xe_ca: { [ca1]: 2 } }], "Xe ben");
    expect(R0.ves[0].cnt.slice(0, 3)).toEqual([6, 6, 6]);
    expect(R.ves[0].cnt.slice(0, 3)).toEqual([6, 2, 6]);
    expect(R.ves[0].cntAuto.slice(0, 3)).toEqual([6, 6, 6]);
    expect(R.shifts[1].cang).toBe(2);
  });
  it("tàu chưa có số xe nền vẫn nhận số xe nhập tay cho từng ca", () => {
    const p = { bd: "2026-11-01T00:00", gioN: 8, caLen: 12, nShifts: 4, moc: "2026-11-01T00:00", ramp1: 1, ramp2: 1, ramp3: 1, capCang: 10, capBai: 0, flag: 1, daoTao: 1 };
    const tau = { id: "lt-1", lt: 1, loai: "tau", ten: "T", hang: "Than", vi_tri: "B1", khoi_luong: 20000, nang_suat: 500, bat_dau: iso(2026, 11, 1, 8), so_xe_tay: null, doi: "Xe ben" };
    const ca0 = calc12({ p, prod: [] }, [tau], "Xe ben").shifts[0].st.toISOString();
    expect(calc12({ p, prod: [] }, [{ ...tau, xe_ca: { [ca0]: 3 } }], "Xe ben").ves[0].cnt[0]).toBe(3);
  });
});

describe("Việc bãi nhập tay có giờ chính xác (tu / den, SQL 15)", () => {
  it("chỉ các ca giao với khoảng giờ mới có số xe, không tròn theo ngày", () => {
    const p = { bd: "2026-11-01T00:00", gioN: 8, caLen: 12, nShifts: 6, moc: "2026-11-01T00:00", ramp1: 1, ramp2: 1, ramp3: 1, capCang: 0, capBai: 9, flag: 1, daoTao: 1 };
    // Tàu ở bến 02/11 08:00 → 04/11 03:12: ca N 02/11, Đ 02/11, N 03/11, Đ 03/11 (đến 08:00 04/11) có việc; N 04/11 08:00 thì không
    const job = { id: 7, loai: "bai", ten: "T - Than - 1000 t", doi: "Xúc đào", xe_ngay: 3, xe_dem: 3, tu_ngay: "2026-11-02", den_ngay: "2026-11-04", tu: iso(2026, 11, 2, 8), den: iso(2026, 11, 4, 3, 12) };
    const R = calc12({ p, prod: [] }, [job], "Xúc đào");
    expect(R.fixed[0].cnt).toEqual([0, 0, 3, 3, 3, 3]); // ca 0,1 = 01/11; ca 2.. = 02/11 N, 02/11 Đ, 03/11 N, 03/11 Đ
  });
});
