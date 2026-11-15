import { useMemo, useState } from "react";
import { Save, Info, Database, Minus, Plus, Eye } from "lucide-react";
import { useApp } from "../store";
import { Modal } from "../components/ui";
import { chenhTone, chenhLabel } from "../lib/compute";
import { vn, vnShort, thu, shortTo } from "../lib/utils";
import QuanSoDoi from "./Staffing";

// Khai báo › Nhân sự & quân số: nhập số người có mặt THEO TỔ trong từng ca (SQL 14).
// Gọn cho tổ trưởng dùng trên điện thoại: chọn ca → thấy các khối theo ĐỘI, mỗi khối là các ô TỔ →
// bấm ô tổ mở hộp nhỏ nhập số (nút − / +, hoặc bấm ĐB để điền định biên) → Lưu (ghi riêng tổ đó).
// Ca cần điền: 2 ca đi ca (ca đang chạy + ca kế) và ca hành chính, lấy từ D.upcomingShifts.
const useCaToi = (D) => useMemo(() => D.upcomingShifts().sort((a, b) => a.hc - b.hc || a.start - b.start), [D]);

export default function QuanSoTo() {
  const { D } = useApp();
  const cas = useCaToi(D);
  // Mặc định: ca đang diễn ra (không tính HC), không có thì ca đầu tiên
  const [chon, setChon] = useState(() => Math.max(0, cas.findIndex((x) => x.dangChay && !x.hc)));
  const sh = cas[Math.min(chon, cas.length - 1)];

  if (!D.coSql14) {
    return (
      <>
        <div className="alert warn mb"><Database size={16} /><span>CSDL chưa có bảng <b className="mono">headcount_to</b> để nhập quân số theo tổ. Quản trị chạy file <b className="mono">sql/14_quan_so_theo_to.sql</b> trong Supabase › SQL Editor rồi tải lại trang. Trong lúc chờ, vẫn nhập quân số theo đội như cũ ở bảng dưới.</span></div>
        <QuanSoDoi />
      </>
    );
  }
  if (!sh) return <div className="card"><div className="alert info"><Info size={16} /><span>Chưa có ca nào để nhập quân số.</span></div></div>;

  return (
    <div className="qs">
      <div className="qs-cas" role="tablist" aria-label="Chọn ca">
        {cas.map((x, k) => (
          <button key={x.ngay + x.ca} type="button" role="tab" aria-selected={x === sh} className={"qs-ca" + (x === sh ? " on" : "") + (x.dangChay ? " now" : "")} onClick={() => setChon(k)}>
            <b>{D.shiftLabel(x)}</b>
            <span>{x.hc ? "Hành chính" : x.dangChay ? "Đang diễn ra" : "Ca tới"} · {thu(x.ngay)} {vnShort(x.ngay)}</span>
          </button>
        ))}
      </div>
      <CaQuanSo key={sh.ngay + "|" + sh.ca} sh={sh} />
    </div>
  );
}

function CaQuanSo({ sh }) {
  const { D, api, run, canWrite } = useApp();
  const [mo, setMo] = useState(null); // tên tổ đang mở hộp nhập
  const tos = D.shiftByTo(sh);

  // Nhóm theo đội: thứ tự đội như trang khác, tổ không rõ đội để cuối
  const nhom = useMemo(() => {
    const m = new Map();
    for (const r of tos) { const k = r.doiChinh || "Khác"; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    const vt = (d) => (D.doiList.indexOf(d) < 0 ? 999 : D.doiList.indexOf(d));
    return [...m.entries()].sort(([a], [b]) => vt(a) - vt(b));
  }, [tos, D]); // eslint-disable-line react-hooks/exhaustive-deps

  const daNhap = tos.filter((r) => r.thucTe != null);
  const tong = daNhap.reduce((a, r) => ({ tt: a.tt + r.thucTe, can: a.can + r.xeCan, thieu: a.thieu + (r.chenh < 0 ? -r.chenh : 0) }), { tt: 0, can: 0, thieu: 0 });
  const dangMo = tos.find((r) => r.to === mo);

  return (
    <>
      <div className="qs-sum">
        <span>Đã nhập <b>{daNhap.length}</b>/{tos.length} tổ</span>
        <span>Có mặt <b>{tong.tt}</b> / cần <b>{tong.can}</b></span>
        {tong.thieu > 0 && <span className="bad">Thiếu <b>{tong.thieu}</b></span>}
        {!canWrite && <span className="mute"><Eye size={13} /> chỉ xem</span>}
      </div>

      {!tos.length && <div className="card"><div className="alert info"><Info size={16} /><span>Chưa có tổ nào có xe hoặc nhân sự cho ca này.</span></div></div>}

      {nhom.map(([doi, ds]) => {
        const nhap = ds.filter((r) => r.thucTe != null);
        const tt = nhap.reduce((a, r) => a + r.thucTe, 0), can = nhap.reduce((a, r) => a + r.xeCan, 0);
        const cd = nhap.length ? nhap.reduce((a, r) => a + r.chenh, 0) : null;
        return (
          <section key={doi} className="qs-doi">
            <div className="qs-doi-h"><b>{doi}</b><span className="small mute">{nhap.length}/{ds.length} tổ{nhap.length ? ` · ${tt}/${can}` : ""}</span><span className={"qs-chip " + chenhTone(cd)}>{chenhLabel(cd)}</span></div>
            <div className="qs-tiles">
              {ds.map((r) => {
                const ct = chenhTone(r.chenh);
                const noiDung = (
                  <>
                    <span className="qs-tn">{shortTo(r.to)}</span>
                    <span className="qs-tv"><b>{r.thucTe ?? "–"}</b><i>/{r.xeCan}</i></span>
                    <span className="qs-ts">{r.thucTe == null ? `ĐB ${r.dinhBien}` : chenhLabel(r.chenh)}</span>
                  </>
                );
                return canWrite
                  ? <button key={r.to} type="button" className={"qs-tile " + (r.thucTe == null ? "chua" : ct)} onClick={() => setMo(r.to)}>{noiDung}</button>
                  : <div key={r.to} className={"qs-tile " + (r.thucTe == null ? "chua" : ct)}>{noiDung}</div>;
              })}
            </div>
          </section>
        );
      })}

      {dangMo && (
        <HopNhap sh={sh} r={dangMo} onClose={() => setMo(null)}
          onLuu={async (tt, gc) => {
            const ok = await run(() => api.upsertHeadcountTo([{ ngay: sh.ngay, ca: sh.ca, to_xe: dangMo.to, doi: dangMo.doiChinh || null, thuc_te: tt, ghi_chu: gc || null }]), `Đã lưu ${shortTo(dangMo.to)}: ${tt ?? "xóa số"} người · ${D.shiftLabel(sh)}`);
            if (ok) setMo(null);
          }} />
      )}
    </>
  );
}

// Hộp nhập số người có mặt của một tổ
function HopNhap({ sh, r, onClose, onLuu }) {
  const { D } = useApp();
  const [v, setV] = useState(r.thucTe ?? "");
  const [gc, setGc] = useState(r.ghiChu || "");
  const [luu, setLuu] = useState(false);
  const n = v === "" ? null : Math.max(0, parseInt(v, 10) || 0);
  const chenh = n == null ? null : n - r.xeCan;
  const doi = (d) => setV(Math.max(0, (n ?? 0) + d));
  const ghi = async () => { setLuu(true); await onLuu(n, gc.trim()); setLuu(false); };
  return (
    <Modal title={`${shortTo(r.to)} · ${D.shiftLabel(sh)}`} onClose={onClose} width={380}
      footer={<><button type="button" className="btn" onClick={onClose}>Hủy</button><button type="button" className="btn pri" onClick={ghi} disabled={luu}><Save size={15} />{luu ? "Đang lưu…" : "Lưu"}</button></>}>
      <div className="qs-hop">
        <div className="small mute">Đội {r.doiChinh || "–"} · Xe sẵn sàng <b>{r.xeCan}</b>/{r.xeTong}</div>
        <div className="qs-hop-l">Số người có mặt</div>
        <div className="qs-step">
          <button type="button" className="qs-b" onClick={() => doi(-1)} aria-label="Giảm"><Minus size={22} /></button>
          <input className="qs-n" type="number" min="0" inputMode="numeric" value={v} placeholder="–" onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()} aria-label="Số người có mặt" />
          <button type="button" className="qs-b" onClick={() => doi(1)} aria-label="Tăng"><Plus size={22} /></button>
        </div>
        <div className="qs-hop-ph">
          <button type="button" className="qs-db" onClick={() => setV(r.dinhBien)}>Định biên {r.dinhBien}</button>
          <button type="button" className="qs-db" onClick={() => setV(r.xeCan)}>Bằng xe cần {r.xeCan}</button>
          <span className={"qs-chip " + chenhTone(chenh)}>{chenhLabel(chenh)}</span>
        </div>
        <input className="inp" value={gc} onChange={(e) => setGc(e.target.value)} placeholder="Ghi chú (VD: 2 phép, 1 ốm)" aria-label="Ghi chú" />
      </div>
    </Modal>
  );
}
