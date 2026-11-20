import { useState } from "react";
import { useApp } from "@/store";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { thangCua, tenThang, congThang } from "@/lib/format";
import { khoaKy, dsKy, tenKy } from "@/lib/ky";
import { cn } from "@/lib/utils";
import SanLuongTab from "./SanLuongTab";
import SanXuatKeHoach from "../kehoach/SanXuatKeHoach";

// Hộp Đặt mục tiêu có BỐN mục (anh Sỹ 20/11/2026): Kế hoạch nhập · Kế hoạch xuất (mục tiêu cảng theo loại hàng, hai hướng của bảng cũ) · Kế hoạch vận tải (= bảng Mục tiêu vận tải, trước nằm ở Thiết bị cơ giới › Kế hoạch dài hạn) · Kế hoạch sản xuất (bảng Tên hàng · Tổng, trước là tab của Kế hoạch tổng hợp › Kế hoạch dài hạn).
// Sản lượng thực tế có hai mục: Cảng nhập / xuất và Vận tải (bảng thực tế vận tải cũng chuyển từ Thiết bị cơ giới sang).
// Hai hộp của trang Mục tiêu sản lượng › Khai thác cảng, dùng lại các bảng cũ (SanLuongTab) nhưng mỗi hộp chỉ một bảng:
//   Đặt mục tiêu: mục tiêu sản lượng nhập / xuất theo loại hàng, theo THÁNG / QUÝ / NĂM (quản lý trở lên sửa; quý / năm nhập riêng, SQL 10);
//   Sản lượng thực tế: nhập sản lượng nhập / xuất thực tế theo ngày, mỗi ngày một dòng (nhập liệu trở lên).
const luu = (k, v) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };
const doc = (k, mac) => { try { return localStorage.getItem(k) || mac; } catch { return mac; } };
const KY = [["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]];
const RONG = "max-w-[min(1500px,calc(100vw-24px))]";

export function HopDatMucTieu({ thang0, onClose, onLuu }) {
  const { D } = useApp();
  const [kyLoai, setKyLoai] = useState(() => (["quy", "nam"].includes(doc("lg-mt-ky", "thang")) ? doc("lg-mt-ky", "thang") : "thang"));
  const [chon, setChon] = useState(() => ({ thang: thang0 || thangCua(D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) }));
  const hienTai = { thang: thangCua(D.now), quy: khoaKy("quy", D.now), nam: khoaKy("nam", D.now) };
  const dsChon = {
    thang: Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x)]),
    quy: dsKy("quy", D.now, 6, 3).map((x) => [x, tenKy("quy", x)]),
    nam: dsKy("nam", D.now, 3, 2).map((x) => [x, tenKy("nam", x)]),
  };
  const ky = chon[kyLoai];
  const [muc, setMuc] = useState("nhap"); // nhap | xuat | van_tai | san_xuat; các bảng mục tiêu luôn được dựng sẵn, chỉ ẩn / hiện, để chuyển mục không mất số đang gõ
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className={RONG} title="Đặt mục tiêu sản lượng" description="Kế hoạch nhập, kế hoạch xuất (theo loại hàng), kế hoạch vận tải (loại xe, Hòa Phát / Thuê ngoài) và kế hoạch sản xuất của tháng, quý hoặc năm. Chỉ Quản lý / Quản trị đặt mục tiêu.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border" role="tablist" aria-label="Kỳ mục tiêu">
          {KY.map(([k, ten]) => (
            <button key={k} type="button" role="tab" aria-selected={kyLoai === k} onClick={() => { setKyLoai(k); luu("lg-mt-ky", k); }}
              className={cn("h-7 px-3 text-xs font-medium transition-colors", kyLoai === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{ten}</button>))}
        </div>
        <NativeSelect className="h-7 w-48 text-xs" value={ky} onChange={(e) => setChon((o) => ({ ...o, [kyLoai]: e.target.value }))}
          options={dsChon[kyLoai].map(([x, ten]) => [x, ten + (x === hienTai[kyLoai] ? " (này)" : "")])} aria-label={KY.find(([k]) => k === kyLoai)[1]} />
      </div>
      <MucTab muc={muc} setMuc={setMuc} ds={[["nhap", "Kế hoạch nhập"], ["xuat", "Kế hoạch xuất"], ["van_tai", "Kế hoạch vận tải"], ["san_xuat", "Kế hoạch sản xuất"]]} />
      <div className={muc === "van_tai" || muc === "san_xuat" ? "hidden" : ""}><SanLuongTab nhom="cang" thang={ky} kyLoai={kyLoai} che="mucTieu" onLuu={onLuu} huongHien={muc === "xuat" ? "xuat" : "nhap"} /></div>
      <div className={muc === "van_tai" ? "" : "hidden"}><SanLuongTab nhom="van_tai" thang={ky} kyLoai={kyLoai} che="mucTieu" onLuu={onLuu} /></div>
      {muc === "san_xuat" && <SanXuatKeHoach kyLoai={kyLoai} ky={ky} />}
    </Dialog>
  );
}

// Thanh chọn mục của hộp (kiểu ô trượt như các nhóm nút khác)
function MucTab({ muc, setMuc, ds }) {
  return (
    <div className="mb-3 inline-flex gap-0.5 rounded-md bg-muted p-0.5 text-sm" role="tablist" aria-label="Mục">
      {ds.map(([k, ten]) => (
        <button key={k} type="button" role="tab" aria-selected={muc === k} onClick={() => setMuc(k)}
          className={cn("rounded px-3 py-1 font-medium transition-colors", muc === k ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground")}>{ten}</button>))}
    </div>
  );
}

export function HopThucTe({ thang0, onClose, onLuu }) {
  const { D } = useApp();
  const [thang, setThang] = useState(thang0 || thangCua(D.now));
  const [muc, setMuc] = useState("cang");
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className={RONG} title="Sản lượng thực tế" description="Nhập sản lượng thực tế theo ngày, mỗi ngày một dòng (tấn): cảng nhập / xuất, hoặc vận tải (kế hoạch sản xuất). Cột có mục tiêu hiện sẵn; loại hàng khác thì Thêm cột.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <NativeSelect className="h-7 w-48 text-xs" value={thang} onChange={(e) => setThang(e.target.value)} aria-label="Tháng"
          options={Array.from({ length: 13 }, (_, i) => congThang(thangCua(D.now), i - 6)).map((x) => [x, tenThang(x) + (x === thangCua(D.now) ? " (này)" : "")])} />
      </div>
      <MucTab muc={muc} setMuc={setMuc} ds={[["cang", "Cảng nhập / xuất"], ["van_tai", "Vận tải"]]} />
      <div className={muc === "cang" ? "" : "hidden"}><SanLuongTab nhom="cang" thang={thang} kyLoai="thang" che="thucTe" onLuu={onLuu} /></div>
      <div className={muc === "van_tai" ? "" : "hidden"}><SanLuongTab nhom="van_tai" thang={thang} kyLoai="thang" che="thucTe" onLuu={onLuu} /></div>
    </Dialog>
  );
}
