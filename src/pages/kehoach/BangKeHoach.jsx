import { useMemo, useState } from "react";
import { ClipboardPaste, Plus, X } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChonGo } from "@/components/ui/combobox";
import { so, docSo, plain } from "@/lib/format";
import { KE_HOACH, dongKeHoach, tongDong, r2 } from "@/lib/keHoachTH";
import HopPhanKho from "./HopPhanKho";
import HopPhanXe from "./HopPhanXe";
import HopDanKeHoach from "./HopDanKeHoach";

// Bảng của một bản kế hoạch (dùng chung cho xuất bán, sản xuất, nhập mua):
//   • xuất bán  : Tên hàng · Tổng · Đường bộ · Đường biển;  bấm Tổng → hộp Xuất kho, bấm Bộ / Biển → hộp Phân xe
//   • sản xuất  : Tên hàng · Tổng;                           bấm Tổng → hộp Nhập kho (nhập tổng ngay trong hộp)
//   • nhập mua  : Tên hàng · Tổng · Đường bộ · Đường biển;  bấm Tổng → hộp Nhập kho, bấm Biển → hộp Phân xe (Bộ chỉ nhập khối lượng)
// Mỗi bảng có nút Dán nhanh / Excel, dòng thêm đủ các trường của bảng (hàng đã có thì cập nhật số), nút xóa hàng khỏi kế hoạch. Kỳ lập kế hoạch: Tháng / Quý / Năm.
export default function BangKeHoach({ loai, ky, nhanKy, data, kho, sua, dsHang, loaiXe, onLuu }) {
  const { api, run } = useApp();
  const cfg = KE_HOACH[loai], bb = cfg.boBien;
  const [pop, setPop] = useState(null); // { hang, kieu: "kho" | "bo" | "bien", neo }
  const [dan, setDan] = useState(false);
  const [them, setThem] = useState({ hang: "", bo: "", bien: "", tong: "" });
  const dong = useMemo(() => dongKeHoach(data?.th, loai), [data, loai]);
  const cong = dong.reduce((s, x) => ({ bo: s.bo + x.bo, bien: s.bien + x.bien, tong: s.tong + x.tong }), { bo: 0, bien: 0, tong: 0 });
  const bam = (hang, kieu) => (e) => setPop({ hang, kieu, neo: e.currentTarget });
  // Hàm vẽ (không phải component): nếu là component khai báo trong hàm này thì mỗi lần vẽ lại nút bị tạo mới và ô neo của hộp nhỏ bị gỡ khỏi trang
  const so1 = (x, kieu, gt, dam) => (
    <button type="button" onClick={bam(x.hang, kieu)} title={kieu === "kho" ? cfg.tenKho : kieu === "bien" && cfg.xeBien || kieu === "bo" && cfg.xeBo ? "Phân xe" : "Sửa khối lượng"}
      className={`ml-auto flex h-8 min-w-[6rem] items-center justify-end rounded-md border border-transparent px-2 tabular-nums transition-colors hover:border-input hover:bg-accent ${dam ? "font-semibold" : ""} ${pop?.hang === x.hang && pop?.kieu === kieu ? "border-primary bg-primary/10" : ""}`}>
      {gt > 0 ? so(gt, 0) : <span className="text-muted-foreground">—</span>}
    </button>);
  const ghi1 = (hang, bo, bien, tong) => (bb ? { hang, bo: r2(bo), bien: r2(bien), tong: r2(bo + bien) } : { hang, bo: 0, bien: 0, tong: r2(tong) });
  const them1 = async () => {
    const hang = them.hang.trim(); if (!hang) return;
    const bo = docSo(them.bo) || 0, bien = docSo(them.bien) || 0, tong = docSo(them.tong) || 0;
    if (bb ? !(bo + bien > 0) : !(tong > 0)) return;
    if (await run(() => api.luuKhDong(loai, ky, { ghi: [ghi1(hang, bo, bien, tong)] }), `Đã lưu ${hang} vào ${cfg.ten.toLowerCase()}`)) { setThem({ hang: "", bo: "", bien: "", tong: "" }); onLuu(); }
  };
  const xoa1 = async (hang) => { if (await run(() => api.luuKhDong(loai, ky, { xoa: [hang] }), `Đã bỏ ${hang} khỏi ${cfg.ten.toLowerCase()}`)) { setPop(null); onLuu(); } };
  const dongPop = pop ? dong.find((x) => plain(x.hang) === plain(pop.hang)) : null;
  const sua1 = sua;
  const thL = "text-right";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{cfg.ten} · {nhanKy} (tấn)</span>
        <Button size="sm" variant="outline" className="ml-auto" disabled={!sua} onClick={() => setDan(true)}><ClipboardPaste />Dán nhanh / Excel</Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="tbl w-full text-sm">
          <thead><tr><th className="text-left">Tên hàng</th><th className={thL}>Tổng (t)</th>{bb && <><th className={thL}>{loai === "nhap_mua" ? "Nhập đường bộ (t)" : "Đường bộ (t)"}</th><th className={thL}>{loai === "nhap_mua" ? "Nhập đường biển (t)" : "Đường biển (t)"}</th></>}<th className="w-8" /></tr></thead>
          <tbody>
            {dong.map((x) => (
              <tr key={x.hang}>
                <td className="font-medium">{x.hang}</td>
                <td>{so1(x, "kho", x.tong, true)}</td>
                {bb && <><td>{so1(x, "bo", x.bo)}</td><td>{so1(x, "bien", x.bien)}</td></>}
                <td className="text-center">{sua1 && <button type="button" onClick={() => xoa1(x.hang)} className="rounded p-1 text-muted-foreground hover:text-bad" title="Bỏ hàng khỏi kế hoạch" aria-label={`Bỏ ${x.hang}`}><X className="h-4 w-4" /></button>}</td>
              </tr>))}
            {!dong.length && <tr><td colSpan={bb ? 5 : 3} className="py-6 text-center text-muted-foreground">Chưa có {cfg.ten.toLowerCase()} {nhanKy.toLowerCase()}. Thêm hàng ở dòng bên dưới hoặc bấm Dán nhanh / Excel.</td></tr>}
          </tbody>
          <tfoot><tr className="font-semibold"><td>Cộng</td><td className="pr-4 text-right tabular-nums">{so(cong.tong, 0)}</td>{bb && <><td className="pr-4 text-right tabular-nums">{so(cong.bo, 0)}</td><td className="pr-4 text-right tabular-nums">{so(cong.bien, 0)}</td></>}<td /></tr></tfoot>
        </table>
      </div>
      {sua && (
        <div className="mt-2 grid items-center gap-2" style={{ gridTemplateColumns: bb ? "minmax(160px,1fr) 7rem 7rem 7rem auto" : "minmax(160px,1fr) 8rem auto" }}>
          <ChonGo value={them.hang} onChange={(x) => setThem((o) => ({ ...o, hang: x }))} options={dsHang} placeholder="Tên hàng" />
          {bb ? (
            <>
              <Input className="text-right tabular-nums text-muted-foreground" disabled tabIndex={-1} value={(docSo(them.bo) || 0) + (docSo(them.bien) || 0) ? so((docSo(them.bo) || 0) + (docSo(them.bien) || 0), 0) : ""} placeholder="Tổng" aria-label="Tổng (tự cộng)" />
              <Input className="text-right tabular-nums" inputMode="decimal" value={them.bo} placeholder="Đường bộ" onChange={(e) => setThem((o) => ({ ...o, bo: e.target.value }))} />
              <Input className="text-right tabular-nums" inputMode="decimal" value={them.bien} placeholder="Đường biển" onChange={(e) => setThem((o) => ({ ...o, bien: e.target.value }))} />
            </>) : <Input className="text-right tabular-nums" inputMode="decimal" value={them.tong} placeholder="Tổng" onChange={(e) => setThem((o) => ({ ...o, tong: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && them1()} />}
          <Button size="sm" variant="outline" disabled={!them.hang.trim()} onClick={them1}><Plus />Thêm hàng</Button>
        </div>)}
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">
        {loai === "xuat_ban" && <>Bấm số <b>Đường bộ</b> / <b>Đường biển</b> để sửa khối lượng và phân xe (Hòa Phát / Thuê ngoài, loại xe tùy chọn); bấm số <b>Tổng</b> (= bộ + biển) để phân bổ xuất kho về từng bãi – gian / lô đang chứa hàng.</>}
        {loai === "san_xuat" && <>Bấm số <b>Tổng</b> để sửa khối lượng và phân bổ nhập kho về từng bãi – gian / lô theo tỉ lệ sức chứa.</>}
        {loai === "nhap_mua" && <>Bấm số <b>Nhập đường bộ</b> để sửa khối lượng; bấm <b>Nhập đường biển</b> để sửa khối lượng và phân xe; bấm số <b>Tổng</b> (= bộ + biển) để phân bổ nhập kho về từng bãi – gian / lô.</>}
        {" "}Thêm hàng đã có trong bảng thì cập nhật số của hàng đó.
      </p>
      {pop && dongPop && (pop.kieu === "kho"
        ? <HopPhanKho key={`k|${pop.hang}`} neo={pop.neo} onDong={() => setPop(null)} loai={loai} ky={ky} hang={dongPop.hang} tong={dongPop.tong} tongSua={!bb} kho={kho} khoRows={(data?.kho || []).filter((r) => r.loai === loai && plain(r.hang) === plain(dongPop.hang))} sua={sua} onLuu={onLuu} />
        : <HopPhanXe key={`x|${pop.hang}|${pop.kieu}`} neo={pop.neo} onDong={() => setPop(null)} loai={loai} ky={ky} hang={dongPop.hang} hinh={pop.kieu} dong={dongPop} xe={data?.xe || []} loaiXe={loaiXe} sua={sua} onLuu={onLuu} />)}
      {dan && <HopDanKeHoach loai={loai} ky={ky} nhanKy={nhanKy} onClose={() => setDan(false)} onLuu={onLuu} />}
    </div>
  );
}
