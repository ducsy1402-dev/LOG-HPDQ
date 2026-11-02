import { useEffect, useState } from "react";
import { Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useApp } from "@/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MucIcon, PageHead, Empty } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tenBen, tenBenChuyen } from "./cang/BangTauBen";
import { useThietBi } from "@/thietbi/Host";
import { useKho } from "./kho/useKho";
import { HopTQ } from "./tongquan/khung";
import { TheThietBi, HopThietBi } from "./tongquan/ThietBiTQ";
import { TheTau, HopTau } from "./tongquan/TauTQ";
import { TheKho, HopKho } from "./tongquan/KhoTQ";
import { TheKhoiLuong, HopKhoiLuong } from "./tongquan/KhoiLuongTQ";

// Tổng quan điều hành: một màn hình gồm các thẻ tóm tắt (thiết bị, tàu, kho, thưởng phạt, khối lượng, tiến độ).
// Bấm vào thẻ mở hộp biểu đồ / bảng chi tiết; trong hộp có nút mở trang đầy đủ.
export default function TongQuan({ go }) {
  const { D, quyen, reload, busy } = useApp();
  const tb = useThietBi();
  const [mo, setMo] = useState(null);
  const lamMoi = () => { reload(); tb?.reload?.(false); };
  const dong = () => setMo(null);
  const coKho = quyen.kho?.co || quyen.coCang;
  const THE = [
    quyen.coThietBi && ["thiet-bi", TheThietBi, HopThietBi],
    quyen.coCang && ["tau", TheTau, HopTau],
    coKho && ["kho", TheKho, HopKho],
    quyen.coCang && ["khoi-luong", TheKhoiLuong, HopKhoiLuong],
  ].filter(Boolean);
  const Hop = THE.find((t) => t[0] === mo)?.[2];

  return (
    <>
      <PageHead title="Tổng quan điều hành" desc={<NhanCapNhat />}>
        <Button size="sm" variant="outline" onClick={lamMoi} disabled={busy} title="Tải lại dữ liệu ngay"><RefreshCw className={busy ? "animate-spin" : ""} />Tải lại</Button>
      </PageHead>
      <DaiCanhBao onMo={() => setMo("canh-bao")} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {THE.map(([k, The]) => <The key={k} onMo={() => setMo(k)} sqlChua={!D.coSql15} />)}
      </div>
      {!THE.length && <Empty>Tài khoản chưa được cấp quyền xem phần nào.</Empty>}
      {Hop && <Hop onClose={dong} go={go} />}
      {mo === "canh-bao" && <HopCanhBao onClose={dong} />}
    </>
  );
}

// "Cập nhật đến hh:mm:ss": lần gần nhất biết dữ liệu còn mới (số cũ nhất của phần Cảng / Kho và phần Thiết bị).
// Có SQL 23 thì web hỏi thay đổi mỗi 10 giây và chỉ tải lại khi có người sửa; chưa có thì tải lại đầy đủ mỗi 1 phút.
function NhanCapNhat() {
  const { capNhatRef, cheDoRef } = useApp();
  const tb = useThietBi();
  const [, ve] = useState(0);
  useEffect(() => { const id = setInterval(() => ve((x) => x + 1), 5000); return () => clearInterval(id); }, []);
  const luc = Math.min(capNhatRef.current, tb?.capNhatRef?.current ?? Infinity);
  const d = new Date(luc), p2 = (n) => String(n).padStart(2, "0");
  const nhanh = cheDoRef.current === "dau-van-tay" && (tb?.cheDoRef?.current ?? "dau-van-tay") === "dau-van-tay";
  return `Cập nhật đến ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} · ${nhanh ? "tự kiểm tra thay đổi mỗi 10 giây" : "tự tải lại mỗi 1 phút"} · bấm vào thẻ để xem biểu đồ và chi tiết`;
}

// Gom cảnh báo các phần: Cảng (chuông), Kho, Thiết bị (sự kiện quá hạn / hỏng lâu)
function useCanhBao() {
  const { D, quyen } = useApp();
  const kho = useKho();
  const tb = useThietBi()?.D;
  const cang = quyen.coCang ? D.alerts : [];
  const khoDs = quyen.kho?.co || quyen.coCang ? kho?.canh || [] : [];
  const tbDs = quyen.coThietBi && tb ? tb.open.flatMap((e) => tb.flags(e).filter((f) => f.tone === "bad").map((f) => ({ muc: "warn", nd: `${e.ma_xe} (${tb.vmap[e.ma_xe]?.doi || ""}): ${f.label}${e.mo_ta ? ` · ${e.mo_ta}` : ""}` }))) : [];
  return { cang, kho: khoDs, tb: tbDs, tong: cang.length + khoDs.length + tbDs.length, khan: [...cang, ...khoDs].filter((a) => a.muc === "bad").length };
}

// Một dòng cảnh báo đầu trang: số khẩn / cảnh báo từng phần, bấm để xem danh sách
function DaiCanhBao({ onMo }) {
  const cb = useCanhBao();
  if (!cb.tong) return <div className="mb-3 flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok"><Bell className="h-4 w-4" />Không có cảnh báo cần xử lý.</div>;
  const Phan = ({ ten, ds }) => !ds.length ? null : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="text-muted-foreground">{ten}</span>
      <b className={cn("tabular-nums", ds.some((a) => a.muc === "bad") ? "text-bad" : "text-warn")}>{ds.length}</b></span>);
  return (
    <button type="button" onClick={onMo} className={cn("mb-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent", cb.khan ? "border-bad/40 bg-bad/5" : "border-warn/40 bg-warn/5")}>
      <span className={cn("inline-flex items-center gap-1.5 font-semibold", cb.khan ? "text-bad" : "text-warn")}><Bell className="h-4 w-4" />{cb.tong} cảnh báo{cb.khan ? ` · ${cb.khan} khẩn` : ""}</span>
      <Phan ten="Tàu" ds={cb.cang} /><Phan ten="Kho bãi" ds={cb.kho} /><Phan ten="Thiết bị" ds={cb.tb} />
      <span className="ml-auto inline-flex items-center text-xs text-primary">Xem danh sách<ChevronRight className="h-3.5 w-3.5" /></span>
    </button>
  );
}

function HopCanhBao({ onClose }) {
  const { setVoyageMo } = useApp();
  const cb = useCanhBao();
  const Ds = ({ ds, onBam }) => ds.length ? (
    <div className="grid max-h-[60vh] gap-0.5 overflow-y-auto">
      {[...ds].sort((a, b) => (a.muc === "bad" ? 0 : 1) - (b.muc === "bad" ? 0 : 1)).map((a, i) => {
        const Tag = onBam ? "button" : "div";
        return (
          <Tag key={a.id ?? i} onClick={onBam && (() => onBam(a))} className={cn("flex items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm", onBam && "hover:bg-accent")}>
            <MucIcon muc={a.muc} className="mt-0.5" />
            <span className="min-w-0">{a.voyage ? <><b>{a.voyage.ten_tau}</b>{a.voyage.ben_ma && <span className="text-muted-foreground"> · {tenBenChuyen(a.voyage)}</span>}<span className="block text-xs text-muted-foreground">{a.nd}</span></> : a.nd}</span>
          </Tag>);
      })}
    </div>) : <Empty>Không có cảnh báo.</Empty>;
  const dau = cb.cang.length ? "cang" : cb.kho.length ? "kho" : "tb";
  return (
    <HopTQ title="Cảnh báo cần xử lý" description={`${cb.tong} cảnh báo · ${cb.khan} khẩn · bấm cảnh báo tàu để mở phiếu chuyến`} onClose={onClose}>
      <Tabs defaultValue={dau}>
        <TabsList>
          <TabsTrigger value="cang">Tàu ({cb.cang.length})</TabsTrigger>
          <TabsTrigger value="kho">Kho bãi ({cb.kho.length})</TabsTrigger>
          <TabsTrigger value="tb">Thiết bị ({cb.tb.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="cang"><Ds ds={cb.cang} onBam={(a) => setVoyageMo(a.voyage.id)} /></TabsContent>
        <TabsContent value="kho"><Ds ds={cb.kho} /></TabsContent>
        <TabsContent value="tb"><Ds ds={cb.tb} /></TabsContent>
      </Tabs>
    </HopTQ>
  );
}
