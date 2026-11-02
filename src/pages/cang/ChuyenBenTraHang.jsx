import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "@/store";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Field, Checkbox } from "@/components/ui/input";
import { NgayGio } from "@/components/ui/ngaygio";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton, Empty } from "@/components/common";
import { chiSo } from "@/lib/linetime";
import { so, ngayGio, thoiLuong, ms, toLocalInput, fromLocalInput } from "@/lib/format";
import { docSo } from "@/lib/paste";
import { tenBen, tenBenChuyen, noiHaiBen } from "./BangTauBen";
import { benLienKe, laBenLienKe } from "@/lib/capBen";
import { viTriChu } from "@/lib/tenBen";

// Tab "Chuyển bến & trả hàng" của phiếu chuyến:
//   - Chuyển bến (shifting) sang bến khác hoặc ra neo chờ: ghi như một khoảng dừng (kế thừa giờ dừng, nhật ký), kèm bến cũ / mới,
//     bên yêu cầu, chi phí phát sinh; người nhập tự chọn có trừ laytime hay không. Tàu không chiếm bến lúc ở neo / đang chuyển.
//   - Trả hàng không đạt chất lượng: trả luôn (không nhận vào bãi nữa) hoặc trả một phần rồi tiếp tục nhận. Khối lượng trả
//     không tính vào khối lượng xếp dỡ và không ảnh hưởng thưởng phạt, chỉ ghi nhận.
const LOAI = { shifting: "Shifting sang bến khác", ra_neo: "Ra neo chờ" };
const DO_AI = { cang: "Cảng", tau: "Tàu", khac: "Khác" };
const KIEU_TRA = { tam: "Trả một phần, tiếp tục nhận", het: "Trả luôn, không nhận nữa" };
const nhan = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export default function ChuyenBenTraHang({ v }) {
  const { D } = useApp();
  if (!D.coSql26) return <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Chưa có dữ liệu chuyển bến / trả hàng: quản trị cần chạy <b>sql/26_chuyen_ben_tra_hang.sql</b> trong Supabase.</div>;
  return (
    <div className="grid gap-6">
      <ChuyenBen v={v} />
      <TraHang v={v} />
    </div>
  );
}

const optBen = (D) => D.berths.map((b) => [b.ma, tenBen(b.ma)]);
const bayGio = (D) => toLocalInput(new Date(D.now).toISOString());

// ---------- Chuyển bến / ra neo ----------
function ChuyenBen({ v }) {
  const { D, quyen, run, api, toast } = useApp();
  const ds = D.stopsOf(v.id).filter((s) => s.loai === "shifting" || s.loai === "ra_neo").sort((a, b) => String(a.tu).localeCompare(String(b.tu)));
  const moi = () => ({ loai: "shifting", tu: bayGio(D), den: "", ben_moi: "", ben_phu_moi: "", vi_tri_moi: "", do_ai: "cang", chi_phi: false, chi_phi_ghi_chu: "", tru_tp: false, ghi_chu: "" });
  const [f, setF] = useState(moi);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const dangNgoai = ds.some((s) => !s.den); // đang ở neo / đang chuyển bến
  const benHienTai = v.ben_ma || "";

  const ghi = async () => {
    if (!f.tu) return;
    if (f.den && f.den <= f.tu) return toast("Giờ về bến phải sau giờ rời bến", "bad");
    if (f.loai === "shifting" && !f.ben_moi) return toast("Shifting: chọn bến mới", "bad");
    if (f.loai === "shifting" && f.ben_moi === benHienTai) return toast("Bến mới trùng bến hiện tại", "bad");
    if (dangNgoai) return toast("Tàu đang ở neo / đang chuyển bến: cập bến xong rồi mới ghi lần tiếp", "bad");
    const rec = { voyage_id: v.id, tu: fromLocalInput(f.tu), den: fromLocalInput(f.den), ly_do: LOAI[f.loai], loai: f.loai, ben_cu: benHienTai || null, ben_moi: f.ben_moi || null,
      do_ai: f.do_ai, chi_phi: !!f.chi_phi, chi_phi_ghi_chu: f.chi_phi ? f.chi_phi_ghi_chu.trim() || null : null, tru_tp: !!f.tru_tp, trong_mang: false, ghi_chu: f.ghi_chu.trim() || null };
    // Bến phụ (tàu cập hai bến) trước và sau khi chuyển (SQL 28)
    const viTriMoi = f.ben_moi && f.vi_tri_moi !== "" ? docSo(f.vi_tri_moi) : null;
    if (f.vi_tri_moi !== "" && !(viTriMoi >= 0)) return toast("Vị trí ở bến mới phải là số mét", "bad");
    if (D.coSql28) Object.assign(rec, { ben_phu_cu: v.ben_phu || null, ben_phu_moi: f.ben_moi && laBenLienKe(D.berths, f.ben_moi, f.ben_phu_moi) ? f.ben_phu_moi : null, vi_tri_cu: v.vi_tri ?? null, vi_tri_moi: viTriMoi });
    const ok = await run(async () => {
      await api.addStop(rec);
      // Đã cập bến mới ngay: chuyến chuyển sang bến mới
      if (rec.den && rec.ben_moi) await api.updateVoyage(v.id, { ben_ma: rec.ben_moi, ...(D.coSql28 ? { ben_phu: rec.ben_phu_moi, vi_tri: rec.vi_tri_moi } : {}) });
    }, f.loai === "shifting" ? "Đã ghi shifting" : "Đã ghi ra neo chờ");
    if (ok) setF(moi());
  };
  return (
    <section className="grid gap-3">
      <div className={nhan}>Chuyển bến / ra neo chờ <span className="font-normal normal-case tracking-normal">· bến hiện tại {benHienTai ? tenBenChuyen(v) : "chưa xếp"}</span></div>
      {quyen.nhap && (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
          <Field label="Việc"><NativeSelect value={f.loai} onChange={set("loai")} options={Object.entries(LOAI)} /></Field>
          <Field label="Rời bến lúc"><NgayGio value={f.tu} onChange={set("tu")} /></Field>
          <Field label={f.loai === "shifting" ? "Cập bến mới lúc (trống = đang chuyển)" : "Về lại bến lúc (trống = đang ở neo)"}><NgayGio value={f.den} onChange={set("den")} /></Field>
          <Field label={f.loai === "shifting" ? "Bến mới" : "Bến sẽ cập lại (trống = bến cũ)"}>
            <NativeSelect value={f.ben_moi} onChange={(e) => setF((o) => ({ ...o, ben_moi: e.target.value, ben_phu_moi: "" }))} options={optBen(D).filter(([m]) => m !== benHienTai || f.loai !== "shifting")} placeholder={f.loai === "shifting" ? "Chọn bến" : "— Bến cũ —"} />
          </Field>
          {D.coSql28 && f.ben_moi && <Field label="Bến phụ ở bến mới (tàu cập hai bến)">
            <NativeSelect value={f.ben_phu_moi} onChange={set("ben_phu_moi")} options={[["", "Không (một bến)"], ...benLienKe(D.berths, f.ben_moi).map((b) => [b.ma, noiHaiBen(f.ben_moi, b.ma)])]} />
          </Field>}
          {D.coSql28 && f.ben_moi && <Field label="Vị trí ở bến mới (mét đầu tàu, trống = tự xếp)">
            <Input className="num" inputMode="decimal" value={f.vi_tri_moi} onChange={set("vi_tri_moi")} placeholder="VD 230" />
          </Field>}
          <Field label="Do ai"><NativeSelect value={f.do_ai} onChange={set("do_ai")} options={Object.entries(DO_AI)} /></Field>
          <Field label="Ghi chú"><Input value={f.ghi_chu} onChange={set("ghi_chu")} placeholder="Lý do chuyển bến / ra neo" /></Field>
          <div className="grid gap-1 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.chi_phi} onChange={set("chi_phi")} />Có phát sinh chi phí</label>
            {f.chi_phi && <Input value={f.chi_phi_ghi_chu} onChange={set("chi_phi_ghi_chu")} placeholder="Chi phí do bên nào chịu, bao nhiêu…" aria-label="Ghi chú chi phí" />}
            <label className="flex items-center gap-2 text-sm" title="Giờ chuyển bến / ra neo được coi là đình trệ cho phép: không tính vào laytime"><Checkbox checked={f.tru_tp} onChange={set("tru_tp")} />Trừ laytime (đình trệ cho phép)</label>
          </div>
          <div className="flex items-end justify-end"><Button onClick={ghi} disabled={!f.tu}><Plus />Ghi</Button></div>
        </div>)}
      {ds.length ? (
        <div className="scroll-x rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Việc</th><th>Rời bến</th><th>Về / cập</th><th className="num">Giờ</th><th>Bến</th><th>Do</th><th>Chi phí</th><th>Trừ laytime</th><th /></tr></thead>
            <tbody>{ds.map((s) => (
              <tr key={s.id}>
                <td>{LOAI[s.loai]}{s.ghi_chu && <div className="text-[11px] text-muted-foreground">{s.ghi_chu}</div>}</td>
                <td className="whitespace-nowrap tabular-nums">{ngayGio(s.tu)}</td>
                <td className="whitespace-nowrap tabular-nums">{s.den ? ngayGio(s.den) : quyen.nhap ? <CapLai v={v} s={s} /> : <Badge tone="warn">đang ở neo</Badge>}</td>
                <td className="num">{so(((ms(s.den) ?? D.now) - ms(s.tu)) / 36e5, 1)}</td>
                <td className="whitespace-nowrap">{s.ben_cu ? `${noiHaiBen(s.ben_cu, s.ben_phu_cu)} ${viTriChu(s.vi_tri_cu, v.loa)}`.trim() : "—"} → {s.ben_moi ? `${noiHaiBen(s.ben_moi, s.ben_phu_moi)} ${viTriChu(s.vi_tri_moi, v.loa)}`.trim() : s.loai === "ra_neo" ? "bến cũ" : "?"}</td>
                <td>{DO_AI[s.do_ai] || ""}</td>
                <td>{s.chi_phi ? <span title={s.chi_phi_ghi_chu || ""}>Có{s.chi_phi_ghi_chu ? `: ${s.chi_phi_ghi_chu}` : ""}</span> : "—"}</td>
                <td><Checkbox disabled={!quyen.nhap} checked={!!s.tru_tp} onChange={(e) => run(() => api.updateStop(s.id, { tru_tp: e.target.checked }), "Đã đổi")} aria-label="Trừ laytime" /></td>
                <td>{quyen.quanLy && <ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteStop(s.id), "Đã xóa")}><Trash2 /></ConfirmButton>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Empty>Chưa có lần chuyển bến / ra neo.</Empty>}
      <div className="text-[11px] text-muted-foreground">Các lần này cũng nằm trong tab Khoảng dừng. Lịch cầu bến hiện tàu ở từng bến theo từng đoạn; lúc ra neo hoặc đang chuyển tàu không chiếm bến nào.</div>
    </section>
  );
}

// Tàu đang ở neo / đang chuyển: chọn bến cập (mặc định bến mới đã ghi, không có thì bến cũ) rồi bấm "Cập bến"
function CapLai({ v, s }) {
  const { D, run, api } = useApp();
  const [ben, setBen] = useState(s.ben_moi || s.ben_cu || "");
  return (
    <span className="flex items-center gap-1">
      <NativeSelect className="h-7 w-28 px-1.5 text-xs" value={ben} onChange={(e) => setBen(e.target.value)} options={optBen(D)} placeholder="Bến" aria-label="Bến cập" />
      <Button size="xs" variant="outline" disabled={!ben}
        onClick={() => run(async () => {
          // Bến phụ: cập lại đúng bến mới đã ghi thì giữ bến phụ đã ghi; về bến cũ thì lấy bến phụ cũ; bến khác thì một bến
          const giu = ben === s.ben_moi ? [s.ben_phu_moi, s.vi_tri_moi] : !s.ben_moi && ben === s.ben_cu ? [s.ben_phu_cu, s.vi_tri_cu] : [null, null];
          const phu = giu[0] || null, viTri = giu[1] ?? null;
          await api.updateStop(s.id, { den: new Date().toISOString(), ben_moi: ben, ...(D.coSql28 ? { ben_phu_moi: phu, vi_tri_moi: viTri } : {}) });
          await api.updateVoyage(v.id, { ben_ma: ben, ...(D.coSql28 ? { ben_phu: phu, vi_tri: viTri } : {}) });
        }, `Đã cập bến ${tenBen(ben)}`)}>Cập bến</Button>
    </span>
  );
}

// ---------- Trả hàng ----------
function TraHang({ v }) {
  const { D, quyen, run, api, toast } = useApp();
  const ds = D.traOf(v.id);
  const cs = chiSo(v, D.stopsOf(v.id), D.now);
  const conLai = cs.conLai; // còn phải làm sau khi trừ hàng đã trả
  const moi = () => ({ kieu: "tam", thoi_diem: bayGio(D), khoi_luong: "", ly_do: "Chất lượng hàng không đạt", ghi_chu: "", raNeo: true, ketThuc: true });
  const [f, setF] = useState(moi);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const kl = f.khoi_luong === "" ? (f.kieu === "het" ? conLai : null) : docSo(f.khoi_luong);
  const ghi = async () => {
    if (!f.thoi_diem) return;
    if (!(kl >= 0) || kl == null) return toast("Nhập khối lượng trả (tấn)", "bad");
    if (kl > conLai + 1) return toast(`Khối lượng trả ${so(kl)} t lớn hơn phần còn lại ${so(conLai)} t`, "bad");
    const t = fromLocalInput(f.thoi_diem);
    const ok = await run(async () => {
      await api.addTraHang({ voyage_id: v.id, thoi_diem: t, kieu: f.kieu, khoi_luong: kl, ly_do: f.ly_do.trim() || null, ghi_chu: f.ghi_chu.trim() || null });
      // Trả một phần: tàu ra neo tạm thời (khoảng dừng, mở cho đến khi cập lại)
      if (f.kieu === "tam" && f.raNeo && !D.stopsOf(v.id).some((s) => !s.den && s.loai !== "dung"))
        await api.addStop({ voyage_id: v.id, tu: t, den: null, ly_do: LOAI.ra_neo, loai: "ra_neo", ben_cu: v.ben_ma || null, ...(D.coSql28 ? { ben_phu_cu: v.ben_phu || null, vi_tri_cu: v.vi_tri ?? null } : {}), do_ai: "tau", chi_phi: false, tru_tp: false, trong_mang: false, ghi_chu: "Ra neo tạm thời khi trả hàng" });
      // Trả luôn: kết thúc làm hàng tại thời điểm trả
      if (f.kieu === "het" && f.ketThuc && v.bd_lam_hang && !v.kt_lam_hang) await api.updateVoyage(v.id, { kt_lam_hang: t });
    }, "Đã ghi trả hàng");
    if (ok) setF(moi());
  };
  return (
    <section className="grid gap-3">
      <div className={nhan}>Trả hàng <span className="font-normal normal-case tracking-normal">· khối lượng trả không tính vào khối lượng xếp dỡ, chỉ ghi nhận</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
        <div><div className="text-[11px] text-muted-foreground">Khối lượng chuyến</div><b>{so(v.khoi_luong)} t</b></div>
        <div><div className="text-[11px] text-muted-foreground">Đã làm</div><b>{so(cs.daLam)} t</b></div>
        <div><div className="text-[11px] text-muted-foreground">Đã trả lại</div><b className={v.kl_tra ? "text-warn" : ""}>{so(v.kl_tra || 0)} t</b></div>
        <div><div className="text-[11px] text-muted-foreground">Còn phải làm</div><b>{so(conLai)} t</b></div>
      </div>
      {quyen.nhap && (
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
          <Field label="Trường hợp"><NativeSelect value={f.kieu} onChange={(e) => setF((o) => ({ ...o, kieu: e.target.value, khoi_luong: "" }))} options={Object.entries(KIEU_TRA)} /></Field>
          <Field label="Thời điểm"><NgayGio value={f.thoi_diem} onChange={set("thoi_diem")} /></Field>
          <Field label="Khối lượng trả (t)" hint={f.kieu === "het" ? `Trống = toàn bộ phần còn lại (${so(conLai)} t)` : undefined}>
            <Input className="num" inputMode="decimal" value={f.khoi_luong} onChange={set("khoi_luong")} placeholder={f.kieu === "het" ? String(Math.round(conLai)) : "Tấn"} />
          </Field>
          <Field label="Lý do"><Input value={f.ly_do} onChange={set("ly_do")} /></Field>
          <Field label="Ghi chú" className="sm:col-span-2"><Input value={f.ghi_chu} onChange={set("ghi_chu")} /></Field>
          <div className="grid gap-1 sm:col-span-2">
            {f.kieu === "tam" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.raNeo} onChange={set("raNeo")} />Ghi kèm tàu ra neo tạm thời từ thời điểm này (bấm Cập bến ở trên khi tàu vào lại)</label>}
            {f.kieu === "het" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.ketThuc} onChange={set("ketThuc")} />Kết thúc làm hàng tại thời điểm này (đặt giờ KT làm hàng)</label>}
          </div>
          <div className="flex items-end justify-end"><Button onClick={ghi}><Plus />Ghi trả hàng</Button></div>
        </div>)}
      {ds.length ? (
        <div className="scroll-x rounded-md border">
          <table className="tbl text-xs">
            <thead><tr><th>Thời điểm</th><th>Trường hợp</th><th className="num">Trả (t)</th><th>Lý do</th><th /></tr></thead>
            <tbody>{ds.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap tabular-nums">{ngayGio(t.thoi_diem)}</td>
                <td>{KIEU_TRA[t.kieu] || t.kieu}</td>
                <td className="num">{so(t.khoi_luong)}</td>
                <td>{t.ly_do}{t.ghi_chu && <div className="text-[11px] text-muted-foreground">{t.ghi_chu}</div>}</td>
                <td>{quyen.quanLy && <ConfirmButton confirmText="Xóa?" onConfirm={() => run(() => api.deleteTraHang(t.id), "Đã xóa")}><Trash2 /></ConfirmButton>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Empty>Chưa có lần trả hàng.</Empty>}
    </section>
  );
}
