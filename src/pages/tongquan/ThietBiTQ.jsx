import { useMemo } from "react";
import { Wrench } from "lucide-react";
import { useThietBi, TBCho } from "@/thietbi/Host";
import DoiXe from "@/thietbi/tabs/DoiXe";
import { NangLucDapUng } from "@/thietbi/tabs/plan/LongTerm";
import { rateTone } from "@/thietbi/lib/compute";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/common";
import { pct, ngayNam } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TheTQ, ThanhChong, HopTQ, MAU } from "./khung";

const laCau = (v) => v?.doi === "Cẩu";
const TONE_TB = { ok: "ok", warn: "warn", bad: "bad" };

// Số liệu thẻ Tình trạng thiết bị: xe di động, cẩu cảng, thiết bị gắn, sự kiện quá hạn
function useTongHopTB() {
  const tb = useThietBi();
  return useMemo(() => {
    const D = tb?.D;
    if (!D) return null;
    const xe = D.vehicles.filter((v) => !laCau(v)), cau = D.vehicles.filter(laCau);
    const s = D.summarize(xe), sc = D.summarize(cau);
    const gan = D.tbGanSl ? D.tbGanSl.reduce((r, x) => ({ tong: r.tong + (+x.tong || 0), hong: r.hong + (+x.hong || 0) }), { tong: 0, hong: 0 }) : null;
    const coCo = D.open.filter((e) => D.flags(e).some((f) => f.tone === "bad")).length;
    return { D, s, sc, gan, coCo };
  }, [tb?.D]);
}

export function TheThietBi({ onMo }) {
  const th = useTongHopTB();
  if (!th) return <TheTQ icon={Wrench} ten="Quản lý Thiết bị" so="…" phu="Đang tải dữ liệu thiết bị cơ giới" khoa />;
  const { D, s, sc, gan, coCo } = th;
  const tone = TONE_TB[rateTone(s.rate, D.T)];
  return (
    <TheTQ icon={Wrench} ten="Quản lý Thiết bị" tone={tone} onMo={onMo}
      nhan={coCo > 0 && <Badge tone="bad">{coCo} quá hạn / hỏng lâu</Badge>}
      so={`${s.ready}/${s.tong}`} donVi={`xe sẵn sàng · ${pct(s.rate, 1)}`}
      phu={`Thiết bị di động · ngưỡng sẵn sàng ${pct(D.T.ss)}`}
      hinh={<ThanhChong phan={[[s.ss, MAU.ok, "Sẵn sàng"], [s.bddk, MAU.info, "BD định kỳ"], [s.bdcl, MAU.warn, "BD chiến lược"], [s.hong, MAU.bad, "Hỏng"]]} />}
      chiSo={[
        ["Cẩu cảng sẵn sàng", sc.tong ? `${sc.ready}/${sc.tong}` : "—", TONE_TB[rateTone(sc.rate, D.T)]],
        ["Xe hỏng · BDCL", `${s.hong} · ${s.bdcl}`, s.hong ? "bad" : undefined],
        ["Thiết bị gắn hỏng", gan ? `${gan.hong}/${gan.tong}` : "—", gan?.hong ? "warn" : undefined],
      ]} />
  );
}

export function HopThietBi({ onClose, go }) {
  const th = useTongHopTB();
  if (!th) return null;
  const { D, s, sc } = th;
  return (
    <HopTQ title="Quản lý Thiết bị" onClose={onClose}
      description={`Xe di động ${s.ready}/${s.tong} sẵn sàng (${pct(s.rate, 1)}) · cẩu cảng ${sc.ready}/${sc.tong} · số liệu ngày ${ngayNam(D.today)}`}
      moTrang={[["Mở Tình trạng & sự kiện", () => go("thiet-bi/su-kien")], ["Mở Kế hoạch dài hạn", () => { try { localStorage.setItem("qltb-plan-sub", "dai"); } catch { /* bỏ qua */ } go("thiet-bi/ke-hoach"); }]]}>
      <Tabs defaultValue="doi">
        <TabsList>
          <TabsTrigger value="doi">Theo đội</TabsTrigger>
          {D.tbGanSl && <TabsTrigger value="gan">Thiết bị gắn</TabsTrigger>}
          <TabsTrigger value="nang-luc">Năng lực đáp ứng</TabsTrigger>
        </TabsList>
        <TabsContent value="doi"><TBCho gon><DoiXe /></TBCho></TabsContent>
        {D.tbGanSl && <TabsContent value="gan"><ThietBiGan ds={D.tbGanSl} /></TabsContent>}
        <TabsContent value="nang-luc"><TBCho gon><NangLucDapUng /></TBCho></TabsContent>
      </Tabs>
    </HopTQ>
  );
}

function ThietBiGan({ ds }) {
  if (!ds.length) return <Empty>Chưa khai báo thiết bị gắn.</Empty>;
  return (
    <div className="scroll-x max-h-[60vh] rounded-md border">
      <table className="tbl text-xs">
        <thead><tr><th>Thiết bị gắn</th><th>Dùng cho</th><th className="num">Tổng</th><th className="num">Hỏng</th><th className="num">Sẵn sàng</th><th className="min-w-[140px]">Tỷ lệ sẵn sàng</th></tr></thead>
        <tbody>{ds.map((x) => { const t = +x.tong || 0, h = +x.hong || 0, r = t ? (t - h) / t : null; return (
          <tr key={x.id ?? x.ten}>
            <td className="font-medium">{x.ten}</td><td>{x.dung_cho || "Khác"}</td>
            <td className="num">{t}</td><td className={cn("num", h && "text-bad")}>{h || ""}</td><td className="num text-ok">{t - h}</td>
            <td><ThanhChong chuThich={false} phan={[[t - h, MAU.ok, "Sẵn sàng"], [h, MAU.bad, "Hỏng"]]} />{r != null && <span className="sr-only">{pct(r)}</span>}</td>
          </tr>); })}</tbody>
      </table>
    </div>
  );
}
