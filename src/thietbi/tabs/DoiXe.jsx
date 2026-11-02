import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Badge as Nhan } from "@/components/ui/badge";
import { useApp } from "../store";
import { Card, Select, Badge } from "../components/ui";
import { StackedStatus, Legend } from "../components/charts";
import { rateTone } from "../lib/compute";
import { pct, shortTo, diffDays, vn, groupBy, sortBy } from "../lib/utils";

// Khối "Tình trạng các đội xe" + "Chi tiết đội" của Tổng quan web chung (giữ lại từ tab Tổng quan của web Thiết bị cơ giới).
// Bên trái: tình trạng toàn bộ các đội (bấm vào đội để xem chi tiết). Bên phải: chi tiết đội đang chọn theo tổ.
export default function DoiXe() {
  const { D } = useApp();
  const T = D.T;
  const byDoiAll = D.groupSummary(D.vehicles, "doi");
  const doiCo = D.doiList.filter((d) => D.vehicles.some((v) => v.doi === d));
  const [doiKhoi, setDoiKhoi] = useState("");
  const [mo, setMo] = useState(null); // thẻ đang mở danh sách: ss | hong | bdcl | ns
  const dk = (doiCo.includes(doiKhoi) ? doiKhoi : doiCo[0]) || "";
  const dkVs = D.vehicles.filter((v) => v.doi === dk);
  const s = D.summarize(dkVs);
  const ns = D.staffActive.filter((x) => x.doi === dk).length;
  const rows = D.groupSummary(dkVs, "to_xe", (x) => x.doi === dk);
  const all = D.summarize(D.vehicles);

  return (
    <Card title="Tình trạng các đội xe" icon={LayoutGrid}
      hint={`${all.tong} xe · sẵn sàng ${all.ready} (${pct(all.rate, 1)}) · bấm vào đội để xem chi tiết`}
      right={<>
        <Badge tone={rateTone(s.rate, T)} plain>{dk} · SS {pct(s.rate, 1)}</Badge><Badge plain>{s.tong} xe</Badge>
        <Select className="inp sm" value={dk} onChange={setDoiKhoi} options={doiCo} style={{ width: 170 }} aria-label="Chọn đội xe" />
      </>}>
      <div className="grid g-2">
        <div>
          <StackedStatus rows={byDoiAll} height={byDoiAll.length * 30 + 30} onPick={(k) => setDoiKhoi(k)} />
          <div style={{ marginTop: 6 }}><Legend items={[["var(--c-ok)", "Sẵn sàng"], ["var(--c-info)", "BD định kỳ"], ["var(--c-warn)", "BD chiến lược"], ["var(--c-bad)", "Hỏng"]]} /></div>
        </div>
        <div>
          <div className="sec-t" style={{ marginTop: 0 }}>Chi tiết đội {dk}</div>
          <div className="balance mini">
            <TheBam k="ss" cls="bal ok" ten="Sẵn sàng" onMo={setMo}><div className="big ok">{s.ready}</div></TheBam>
            <TheBam k="hong" cls="bal" ten="Hỏng" onMo={setMo}><div className="big bad">{s.hong}</div></TheBam>
            <TheBam k="bdcl" cls="bal" ten="BD chiến lược" onMo={setMo}><div className="big warn">{s.bdcl}</div></TheBam>
            <TheBam k="ns" cls="bal" ten={`Nhân sự / ĐB ${s.dinhBien}`} onMo={setMo}><div className={"big " + (ns < s.dinhBien ? "warn" : "")}>{ns}</div></TheBam>
          </div>
          <div className="tw" style={{ maxHeight: 300 }}>
            <table className="t">
              <thead><tr><th>Tổ</th><th className="n">Xe</th><th className="n">SS</th><th className="n">Hỏng</th><th className="n">BDCL</th><th>Tỷ lệ sẵn sàng</th><th className="n">NS / ĐB</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.k}>
                    <td>{shortTo(r.k)}</td><td className="n">{r.tong}</td><td className="n ok">{r.ready}</td>
                    <td className="n bad">{r.hong || ""}</td><td className="n warn">{r.bdcl || ""}</td>
                    <td><RateCell r={r} T={T} /></td>
                    <td className={"n " + (r.nhanSu < r.dinhBien ? "warn" : "")}>{r.nhanSu}/{r.dinhBien}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {mo && <DanhSachXe D={D} doi={dk} loai={mo} onClose={() => setMo(null)} />}
    </Card>
  );
}

// Thẻ số liệu bấm được: mở hộp danh sách mã xe / nhân sự
function TheBam({ k, cls, ten, onMo, children }) {
  return (
    <button type="button" className={cls} onClick={() => onMo(k)} title="Bấm để xem danh sách" style={{ cursor: "pointer", textAlign: "left", width: "100%", font: "inherit", color: "inherit" }}>
      <div className="d"><span>{ten}</span><span style={{ color: "var(--accent, var(--mute))" }}>Xem ›</span></div>{children}
    </button>
  );
}

const TEN_LOAI = { ss: "Xe sẵn sàng", hong: "Xe hỏng", bdcl: "Xe bảo dưỡng chiến lược", ns: "Nhân sự" };
// Hộp danh sách của một đội theo thẻ đã bấm, chia theo tổ.
//   Sẵn sàng: mã xe (đánh dấu xe đang BD định kỳ); Hỏng / BD chiến lược: mã xe kèm sự kiện đang mở; Nhân sự: người đang làm việc.
function DanhSachXe({ D, doi, loai, onClose }) {
  const vs = D.vehicles.filter((v) => v.doi === doi);
  const theoTo = (arr, key) => Object.entries(groupBy(arr, (x) => x[key] || "(trống)")).sort(([a], [b]) => sortBy(D.toList)(a, b));
  let noiDung, dem;
  if (loai === "ns") {
    const ds = D.staffActive.filter((x) => x.doi === doi);
    dem = ds.length;
    noiDung = theoTo(ds, "to_xe").map(([to, arr]) => (
      <Nhom key={to} ten={`${shortTo(to)} · ${arr.length} người`}>
        <table className="tbl text-xs"><thead><tr><th>Mã</th><th>Họ tên</th><th>Kíp</th><th>Nhóm</th></tr></thead>
          <tbody>{arr.sort((a, b) => String(a.kip || "").localeCompare(String(b.kip || "")) || String(a.ho_ten).localeCompare(String(b.ho_ten), "vi")).map((x) => (
            <tr key={x.ma || x.id}><td className="font-mono">{x.ma}</td><td className="font-medium">{x.ho_ten}</td><td>{x.kip}</td><td className="text-muted-foreground">{x.nhom || "Lái xe"}</td></tr>))}</tbody></table>
      </Nhom>));
  } else if (loai === "ss") {
    const ds = vs.filter((v) => D.isReady(v.ma));
    dem = ds.length;
    noiDung = theoTo(ds, "to_xe").map(([to, arr]) => (
      <Nhom key={to} ten={`${shortTo(to)} · ${arr.length} xe`}>
        <div className="flex flex-wrap gap-1.5">{arr.sort((a, b) => a.ma.localeCompare(b.ma, "vi")).map((v) => (
          <span key={v.ma} title={[v.model, v.che_do, D.stateOf(v.ma) === "bddk" ? "đang BD định kỳ" : ""].filter(Boolean).join(" · ")}
            className={"rounded-md border px-2 py-1 font-mono text-xs " + (D.stateOf(v.ma) === "bddk" ? "border-info/50 bg-info/10 text-info" : "border-ok/40 bg-ok/10 text-ok")}>{v.ma}</span>))}</div>
      </Nhom>));
  } else {
    const ds = vs.filter((v) => D.stateOf(v.ma) === loai);
    dem = ds.length;
    const ev = (ma) => D.open.filter((e) => e.ma_xe === ma).sort((a, b) => String(a.ngay_vao).localeCompare(String(b.ngay_vao)));
    noiDung = theoTo(ds, "to_xe").map(([to, arr]) => (
      <Nhom key={to} ten={`${shortTo(to)} · ${arr.length} xe`}>
        <table className="tbl text-xs"><thead><tr><th>Mã xe</th><th>Model</th><th>Sự kiện</th><th>Nội dung</th><th>Ngày vào</th><th className="num">Số ngày</th><th>Dự kiến xong</th><th>Lưu ý</th></tr></thead>
          <tbody>{arr.sort((a, b) => a.ma.localeCompare(b.ma, "vi")).flatMap((v) => ev(v.ma).map((e, i) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap font-mono font-medium">{i === 0 ? v.ma : ""}</td>
              <td className="whitespace-nowrap text-muted-foreground">{i === 0 ? v.model : ""}</td>
              <td className="whitespace-nowrap"><Nhan tone={e.loai === "Hỏng" ? "bad" : e.loai === "BD chiến lược" ? "warn" : "info"}>{e.loai}</Nhan></td>
              <td className="min-w-[160px]">{e.mo_ta}{e.phu_tung && e.phu_tung !== "Không cần" && <div className="text-[11px] text-muted-foreground">{e.phu_tung}</div>}</td>
              <td className="whitespace-nowrap tabular-nums">{vn(e.ngay_vao)}</td>
              <td className="num">{diffDays(e.ngay_vao, D.today)}</td>
              <td className={"whitespace-nowrap tabular-nums " + (e.ngay_du_kien && e.ngay_du_kien < D.today ? "font-semibold text-bad" : "")}>{e.ngay_du_kien ? vn(e.ngay_du_kien) : "—"}</td>
              <td className="whitespace-nowrap">{D.flags(e).map((f) => <Nhan key={f.k} tone={f.tone} className="mr-1">{f.label}</Nhan>)}</td>
            </tr>)))}</tbody></table>
      </Nhom>));
  }
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-4xl" title={`${TEN_LOAI[loai]} · đội ${doi}`}
      description={`${dem} ${loai === "ns" ? "người đang làm việc" : "xe"}${loai === "ss" ? " (sẵn sàng gồm cả xe đang BD định kỳ, đánh dấu màu xanh dương)" : ""} · chia theo tổ`}>
      {dem ? <div className="grid gap-3">{noiDung}</div> : <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Không có {loai === "ns" ? "nhân sự" : "xe"} nào.</div>}
    </Dialog>
  );
}

const Nhom = ({ ten, children }) => (
  <div className="rounded-md border">
    <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold">{ten}</div>
    <div className="scroll-x p-2">{children}</div>
  </div>
);

function RateCell({ r, T }) {
  const t = rateTone(r.rate, T);
  return <div className="bar-cell"><div className="track"><i style={{ width: pct(r.rate), background: `var(--c-${t === "ok" ? "ok" : t === "warn" ? "warn" : "bad"})` }} /></div><span className={"mono small " + t}>{pct(r.rate)}</span></div>;
}
