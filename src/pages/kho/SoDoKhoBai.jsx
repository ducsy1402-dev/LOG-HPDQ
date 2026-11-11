import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "@/store";
import { Input } from "@/components/ui/input";
import { so, pct, plain, soGon } from "@/lib/format";
import { NGUONG_KHO, khaiBaoBai, khoaTenBai, tiTrong } from "@/lib/kho";
import DM_BANG from "../../data/dmBang.json";
import { mucDay } from "./khoUi";
import BanDoDinhVi from "./BanDoDinhVi";

// Sơ đồ kho bãi dạng CÂY có biểu tượng (theo mẫu anh Sỹ, 11/2026): bản đồ vị trí bãi lớn ở đầu → các khu vực → bãi lớn (biểu tượng lớn) → ngoặc nối → bãi nhỏ / gian.
//   • Kho có mái che: mái vòm (bán trụ) dạng khung sáng. • Bãi lộ thiên: đống vòm dạng khung sáng (không vẽ nền bê tông); đống to theo tỉ lệ tồn của từng hàng.
//   • Hiệu ứng MỰC ĐẦY: khối màu có mặt sóng dâng từ đáy tới đúng % lấp đầy (dâng lại khi % đổi). Xanh = bình thường, vàng từ 85%, đỏ từ 95% / vượt (nhấp nháy).
//   • Thể tích (m³): đang chứa = Σ tồn ÷ tỉ trọng hàng; tối đa = diện tích × chiều cao chất đống (không có thì sức chứa ÷ tỉ trọng). Bãi lớn = tổng các bãi nhỏ.
// Kho / bãi có mái che: lấy cột "mái che" ở Danh mục › Khai báo kho / bãi nếu có; chưa có thì đoán theo tên (tên bắt đầu bằng "Kho", trừ "Kho hở" → có mái che).
// BS / SM: tỉ lệ biểu tượng lớn / nhỏ; TX: cột chữ của bãi lớn; SX: trục ngoặc; XC: chỗ bắt đầu bãi nhỏ; SLOT: ô một bãi nhỏ
const VB = 1480, PAD = 16, BGAP = 20, ROW = 72, SM = 0.52, BS = 0.72, BG_H = 96, TX = 150, SX = 296, XC = 316, SLOT = 256, BW = XC + SLOT, CW_GON = 292, GON_H = 104;
const VIEN = { ok: "#9ad7ff", warn: "#fcd34d", bad: "#fb7185", xam: "#9ad7ff" };
const CHU = { ok: "#86efac", warn: "#fcd34d", bad: "#fda4af", xam: "#9fb7d9" };
const FILL = { ok: "#34d399", warn: "#fbbf24", bad: "#f43f5e", xam: "#64748b" };
const KHONG_KHU = "Chưa khai báo khu vực";
const CO = /^(co|x|1|true|yes|mot phan|ca hai)/;
const CSS = `
.kb-nut .kb-nen{opacity:0;transition:opacity .15s}.kb-nut:hover .kb-nen{opacity:.08}
@keyframes kbDang{from{transform:translateY(var(--tu))}to{transform:translateY(var(--den))}}
@keyframes kbSong{from{transform:translateX(0)}to{transform:translateX(var(--chu))}}
@keyframes kbNhay{from{opacity:.15}to{opacity:.6}}
.kb-dang{animation:kbDang 1.8s cubic-bezier(.2,.8,.2,1) both}.kb-song{animation:kbSong 2.6s linear infinite}.kb-do{animation:kbNhay .9s ease-in-out infinite alternate}
.kb-chon{animation:kbNhay .6s ease-in-out infinite alternate}
@media (prefers-reduced-motion: reduce){.kb-dang,.kb-song,.kb-do,.kb-chon{animation:none}}`;

function coMai(dmBang, ten) {
  const cot = DM_BANG.bai_lon?.cot || [], k = cot.find(([, t]) => /mai che|^mai/.test(plain(t)))?.[0];
  if (k) { const r = (dmBang || []).find((x) => x.bang === "bai_lon" && khoaTenBai(x.data?.[cot[0][0]]) === khoaTenBai(ten)); return { mai: CO.test(plain(r?.data?.[k])), doan: false }; }
  const p = plain(ten);
  return { mai: /^(nha )?kho\b/.test(p) && !/^kho ho\b/.test(p), doan: true };
}
const cat = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Chỉ tiêu sức chứa một bãi nhỏ: kho nguyên liệu = thể tích tối đa (m³) = diện tích × chiều cao chất đống (không có thì sức chứa ÷ tỉ trọng);
// kho thành phẩm = diện tích (m²) và số lớp xếp khả dụng
function chiTieu(d, hh) {
  let vMax = +d.dien_tich > 0 && +d.chieu_cao > 0 ? +d.dien_tich * +d.chieu_cao : null;
  if (vMax == null && d.sucChua > 0) { const tt = tiTrong(d.hang || d.chua?.[0]?.hang, hh); if (tt > 0) vMax = d.sucChua / tt; }
  const lop = +d.so_lop > 0 ? +d.so_lop : null;
  return { vMax, dt: +d.dien_tich > 0 ? +d.dien_tich : null, lopMin: lop, lopMax: lop };
}
const chuLop = (t) => (t?.lopMin == null ? "— lớp" : t.lopMin === t.lopMax ? `${soGon(t.lopMin)} lớp` : `${soGon(t.lopMin)}–${soGon(t.lopMax)} lớp`);
const chuCT = (t, tp) => (tp ? `${t?.dt ? `${so(t.dt, 0)} m²` : "— m²"} · ${chuLop(t)}` : `${t?.vMax ? so(t.vMax, 0) : "—"} m³`);
const nhanCT = (tp) => (tp ? "Diện tích · số lớp" : "Thể tích tối đa");

// ---------- Hiệu ứng mực đầy: khối màu mặt sóng, dâng từ đáy tới mức f ----------
function MucDay({ clip, x, w, day, cao, f, muc }) {
  const ff = Math.min(1, Math.max(0, f ?? 0)), muc_ = cao * ff, chu = 22, n = Math.ceil(w / chu) + 3, x0 = x - 2 * chu;
  const mat = `M${x0},0 ${Array.from({ length: n }).map(() => `q${chu / 4},-2.6 ${chu / 2},0 t${chu / 2},0`).join(" ")}`;
  return (
    <g clipPath={`url(#${clip})`}>
      {ff > 0 && (
        <g key={Math.round(ff * 1000)} className="kb-dang" style={{ "--tu": `${day + 4}px`, "--den": `${day - muc_}px`, transform: `translateY(${day - muc_}px)` }}>
          <g className="kb-song" style={{ "--chu": `${chu}px` }}>
            <path d={`${mat} V${cao + 8} H${x0} Z`} fill={FILL[muc]} opacity="0.62" />
            <path d={mat} fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.1" />
          </g>
        </g>)}
      {muc === "bad" && <rect x={x - 2} y={day - cao - 4} width={w + 4} height={cao + 8} fill={FILL.bad} className="kb-do" />}
    </g>);
}

// ---------- Biểu tượng (khung 200 × 100) ----------
// Đống vòm lộ thiên: đường kinh tuyến từ đỉnh xuống chân, mực đầy bên trong
function Vom({ id, cx, cy, rx, h, f, muc }) {
  const ry = rx * 0.24, d = `M${cx - rx},${cy} C${cx - rx * 0.78},${cy - h * 0.12} ${cx - rx * 0.46},${cy - h} ${cx},${cy - h} C${cx + rx * 0.46},${cy - h} ${cx + rx * 0.78},${cy - h * 0.12} ${cx + rx},${cy} A${rx} ${ry} 0 0 1 ${cx - rx},${cy} Z`;
  const goc = [12, 40, 70, 90, 110, 140, 168].map((a) => (a * Math.PI) / 180);
  return (
    <g>
      <defs><clipPath id={id}><path d={d} /></clipPath></defs>
      <path d={`M${cx - rx},${cy} A${rx} ${ry} 0 0 0 ${cx + rx},${cy}`} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      <path d={d} fill="url(#kb-vom)" />
      <MucDay clip={id} x={cx - rx} w={2 * rx} day={cy + ry} cao={h + ry} f={f} muc={muc} />
      {goc.map((a, i) => <line key={i} x1={cx} y1={cy - h} x2={cx + rx * Math.cos(a)} y2={cy + ry * Math.sin(a)} stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.9" />)}
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" filter="url(#kb-sang)" />
    </g>);
}
function BaiLoThien({ id, dong, lap, muc }) {
  const ds = dong.length ? dong : [1];
  return (
    <g>
      <ellipse cx="104" cy="90" rx="92" ry="9" fill="#3b82f6" opacity="0.1" />
      <Vom id={`${id}-0`} cx={84} cy={84} rx={34 + 24 * ds[0]} h={56 * (0.8 + 0.2 * ds[0])} f={lap} muc={muc} />
      {ds[1] != null && <Vom id={`${id}-1`} cx={138} cy={88} rx={22 + 22 * ds[1]} h={42 * (0.75 + 0.25 * ds[1])} f={lap} muc={muc} />}
    </g>);
}
// Kho có mái che: bán trụ nằm ngang (vòm trước bên trái, vòm sau bên phải), mực đầy bên trong
function KhoMaiChe({ id, lap, muc }) {
  const R = 27, H = 46, L = 136, s = 13, yb = 94, x0 = 2;
  const than = `M${x0 + R},${yb - H} L${x0 + R + L},${yb - H - s} A${R} ${H} 0 0 1 ${x0 + 2 * R + L},${yb - s} L${x0 + 2 * R},${yb} A${R} ${H} 0 0 0 ${x0 + R},${yb - H} Z`;
  const mat = `M${x0},${yb} A${R} ${H} 0 0 1 ${x0 + 2 * R},${yb} Z`;
  return (
    <g>
      <defs><clipPath id={id}><path d={than} /><path d={mat} /></clipPath></defs>
      <path d={than} fill="url(#kb-than)" />
      <MucDay clip={id} x={x0} w={2 * R + L} day={yb} cao={H + s} f={lap} muc={muc} />
      <g filter="url(#kb-sang)">
        <path d={than} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1={x0 + 2 * R - 3} y1={yb - H * 0.5} x2={x0 + 2 * R + L - 3} y2={yb - H * 0.5 - s} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
        <path d={`M${x0 + L},${yb - s} A${R} ${H} 0 0 1 ${x0 + 2 * R + L},${yb - s}`} fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d={mat} fill="url(#kb-mat)" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.8" />
        <path d={`M${x0 + R * 0.26},${yb} A${R * 0.74} ${H * 0.8} 0 0 1 ${x0 + 2 * R - R * 0.26},${yb}`} fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.2" />
        <line x1={x0} y1={yb} x2={x0 + 2 * R} y2={yb} stroke="currentColor" strokeWidth="1.4" />
      </g>
    </g>);
}
function BieuTuong({ mai, id, lap, dong, muc, x, y, s = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} style={{ color: VIEN[muc] }}>
      {mai ? <KhoMaiChe id={id} lap={lap} muc={muc} /> : <BaiLoThien id={id} dong={dong} lap={lap} muc={muc} />}
    </g>);
}
const tiLeHang = (chua) => { const ds = (chua || []).filter((c) => c.ton > 0).sort((a, b) => b.ton - a.ton).slice(0, 2), max = ds[0]?.ton || 0; return ds.map((c) => (max > 0 ? c.ton / max : 1)); };
const tenLoai = (mai) => (mai ? "kho mái che" : "lộ thiên");
const Nhay = ({ x, y, w, h }) => <rect x={x} y={y} width={w} height={h} rx="12" fill="none" stroke="#fde047" strokeWidth="2.5" className="kb-chon" />;

// Một bãi lớn có nhiều bãi nhỏ: biểu tượng lớn + cột chữ bên phải, ngoặc nối, các bãi nhỏ (biểu tượng nhỏ + cột chữ bên phải); nhiều bãi nhỏ thì chia 3 cột
const soCot = (b) => (b.dong.length > 6 ? 3 : 1);
const caoCay = (b) => Math.max(BG_H, Math.ceil(b.dong.length / soCot(b)) * ROW);
// Cột chữ bên phải biểu tượng: tên, dòng phụ, tồn · %, sức chứa (m³ hoặc m² · lớp)
function CotChu({ x, y, ten, phu, ton, lap, muc, them, ct, lon }) {
  const c = lon ? [20, 36, 53, 69] : [18, 32, 46, 60];
  return (
    <g>
      <text x={x} y={y + c[0]} fontSize={lon ? 14 : 12.5} fontWeight="700" fill="#e6f2ff">{ten}</text>
      {lon
        ? <><text x={x} y={y + c[1]} fontSize="11" fill="#8fb4dc">{phu}</text>
          <text x={x} y={y + c[2]} fontSize="12.5" fontWeight="700" fill={CHU[muc]}>{so(ton, 0)} t · {lap != null ? pct(lap) : "—"}</text></>
        : <><text x={x} y={y + c[1]} fontSize="12" fontWeight="700" fill={CHU[muc]}>{so(ton, 0)} t</text>
          <text x={x} y={y + c[2]} fontSize="11" fill={CHU[muc]}>{lap != null ? pct(lap) : "—"}{them}</text></>}
      <text x={x} y={y + c[3]} fontSize={lon ? 11.5 : 10.5} fill="#9fc3ea">{ct}</text>
    </g>);
}
function KhoiCay({ b, mai, x, y, onMo, uid, tp, tt, ttDong, nhay }) {
  const n = b.dong.length, cols = soCot(b), rows = Math.ceil(n / cols), H = caoCay(b), bigTop = (H - BG_H) / 2, conTop = (H - rows * ROW) / 2, muc = mucDay(b.lapDay);
  const yBig = bigTop + 84, yy = (i) => conTop + Math.floor(i / cols) * ROW, yCon = (i) => yy(i) + 8 + 46, xCon = (i) => XC + (i % cols) * SLOT, yBus = (r) => conTop + r * ROW + 1;
  const v1 = Math.min(yBig, cols > 1 ? yBus(0) : yCon(0)), v2 = Math.max(yBig, cols > 1 ? yBus(rows - 1) : yCon(n - 1));
  const dongLon = tiLeHang(b.dong.flatMap((d) => d.chua || []));
  return (
    <g transform={`translate(${x},${y})`} id={`kb-blk-${khoaTenBai(b.ten_bai)}`}>
      {nhay && <Nhay x={-8} y={-6} w={(cols > 1 ? XC + cols * SLOT : BW) + 8} h={H + 12} />}
      <g onClick={() => onMo(b.ten_bai)} style={{ cursor: "pointer" }} className="kb-nut">
        <title>{`${b.ten_bai} (${tenLoai(mai)}): tồn ${so(b.ton)} t${b.sucChua ? ` / ${so(b.sucChua)} t` : ""}${b.lapDay != null ? ` · ${pct(b.lapDay)}` : ""} · ${nhanCT(tp).toLowerCase()} ${chuCT(tt, tp)} · ${n} bãi nhỏ\nBấm để mở bảng chi tiết`}</title>
        <rect x="-4" y={bigTop} width={SX - 8} height={BG_H} rx="10" fill="#7cc4ff" className="kb-nen" />
        <BieuTuong mai={mai} id={`${uid}-l`} lap={b.lapDay} dong={dongLon} muc={muc} x={0} y={bigTop + 16} s={BS} />
        <CotChu lon x={TX} y={bigTop} ten={cat(b.ten_bai, 17)} phu={`${tenLoai(mai)} · ${n} bãi nhỏ`} ton={b.ton} lap={b.lapDay} muc={muc} ct={chuCT(tt, tp)} />
      </g>
      <g stroke="#6b9be0" strokeWidth="2.2" fill="none" strokeLinecap="round">
        <line x1={TX + 132} y1={yBig} x2={SX} y2={yBig} /><line x1={SX} y1={v1} x2={SX} y2={v2} />
        {cols === 1
          ? b.dong.map((d, i) => <line key={d.key} x1={SX} y1={yCon(i)} x2={XC - 4} y2={yCon(i)} />)
          : Array.from({ length: rows }).map((_, r) => { const k = Math.min(cols, n - r * cols); return (
            <g key={r}><line x1={SX} y1={yBus(r)} x2={XC - 8 + (k - 1) * SLOT} y2={yBus(r)} />
              {Array.from({ length: k }).map((__, c) => <path key={c} d={`M${XC - 8 + c * SLOT},${yBus(r)} V${yCon(r * cols)} H${XC - 2 + c * SLOT}`} />)}</g>); })}
      </g>
      {b.dong.map((d, i) => {
        const m = d.saiBai ? "bad" : mucDay(d.lapDay), cap = !tp && d.ngayCap != null, t = ttDong.get(d.key), x0 = xCon(i), y0 = yy(i);
        return (
          <g key={d.key} onClick={() => onMo(b.ten_bai)} style={{ cursor: "pointer" }} className="kb-nut">
            <title>{`${b.ten_bai} › ${d.ten}${d.chua?.length ? ` (${d.chua.map((c) => c.hang).join(", ")})` : ""}: tồn ${so(d.ton)} t${d.sucChua ? ` / ${so(d.sucChua)} t` : ""}${d.lapDay != null ? ` · ${pct(d.lapDay)}` : ""} · ${nhanCT(tp).toLowerCase()} ${chuCT(t, tp)}${cap ? ` · đủ cấp ${so(d.ngayCap, 1)} ngày` : ""}${d.saiBai ? " · hàng nằm sai bãi" : ""}`}</title>
            <rect x={x0 - 2} y={y0 + 4} width={SLOT - 12} height={ROW - 6} rx="8" fill="#7cc4ff" className="kb-nen" />
            <BieuTuong mai={mai} id={`${uid}-${i}`} lap={d.lapDay} dong={tiLeHang(d.chua)} muc={m} x={x0} y={y0 + 8} s={SM} />
            <CotChu x={x0 + 112} y={y0 + 4} ten={cat(d.ten, 19)} ton={d.ton} lap={d.lapDay} muc={m} ct={chuCT(t, tp)}
              them={cap ? <tspan fill={d.ngayCap < NGUONG_KHO.ngayCapDo ? CHU.bad : d.ngayCap < NGUONG_KHO.ngayCapVang ? CHU.warn : "#8fb4dc"}> · cấp {so(d.ngayCap, 1)} ng</tspan> : null} />
          </g>);
      })}
    </g>);
}

// Bãi lớn chỉ có một bãi nhỏ: một khối gọn (biểu tượng + cột chữ bên phải)
function KhoiGon({ b, mai, x, y, onMo, uid, tt, tp, nhay }) {
  const d = b.dong[0], muc = mucDay(b.lapDay), hang = (d?.chua || []).filter((c) => c.ton > 0).map((c) => c.hang).join(", ") || d?.hang || "";
  return (
    <g transform={`translate(${x},${y})`} id={`kb-blk-${khoaTenBai(b.ten_bai)}`} onClick={() => onMo(b.ten_bai)} style={{ cursor: "pointer" }} className="kb-nut">
      <title>{`${b.ten_bai} (${tenLoai(mai)})${hang ? ` · ${hang}` : ""}: tồn ${so(b.ton)} t${b.sucChua ? ` / ${so(b.sucChua)} t` : ""}${b.lapDay != null ? ` · ${pct(b.lapDay)}` : ""} · ${nhanCT(tp).toLowerCase()} ${chuCT(tt, tp)}\nBấm để mở bảng chi tiết`}</title>
      <rect x="-4" y="0" width={CW_GON - 12} height={GON_H - 10} rx="10" fill="#7cc4ff" className="kb-nen" />
      {nhay && <Nhay x={-6} y={-2} w={CW_GON - 8} h={GON_H - 6} />}
      <BieuTuong mai={mai} id={`${uid}-g`} lap={b.lapDay} dong={tiLeHang(d?.chua)} muc={muc} x={0} y={14} s={BS} />
      <CotChu lon x={TX} y={0} ten={cat(b.ten_bai, 16)} phu={`${tenLoai(mai)} · ${cat(hang || "chưa có hàng", 14)}`} ton={b.ton} lap={b.lapDay} muc={muc} ct={chuCT(tt, tp)} />
    </g>);
}

export default function SoDoKhoBai({ bai, kho, onMo, ten, tp }) {
  const { D } = useApp();
  const [q, setQ] = useState(""), [nhay, setNhay] = useState(null);
  const dauRef = useRef();
  const kb = useMemo(() => khaiBaoBai(D.dmBang), [D.dmBang]);
  const khuCua = (b) => kb.get(khoaTenBai(b.ten_bai))?.khuVuc || KHONG_KHU;
  const mai = useMemo(() => new Map(bai.map((b) => [b.ten_bai, coMai(D.dmBang, b.ten_bai)])), [bai, D.dmBang]);
  const doan = [...mai.values()].some((m) => m.doan);
  const dsKhu = useMemo(() => [...new Set(bai.map(khuCua))].sort((a, b) => (a === KHONG_KHU) - (b === KHONG_KHU) || a.localeCompare(b, "vi", { numeric: true })), [bai, kb]); // eslint-disable-line react-hooks/exhaustive-deps

  // Thể tích từng bãi nhỏ và bãi lớn
  const { ttDong, ttBai } = useMemo(() => {
    const hh = kho?.hangHoa || [], ttDong = new Map(), ttBai = new Map();
    for (const b of bai) {
      let vMax = 0, coV = false, dt = 0, lopMin = null, lopMax = null;
      for (const d of b.dong) {
        const t = chiTieu(d, hh); ttDong.set(d.key, t);
        if (t.vMax) { vMax += t.vMax; coV = true; }
        dt += t.dt || 0;
        if (t.lopMin != null) { lopMin = lopMin == null ? t.lopMin : Math.min(lopMin, t.lopMin); lopMax = lopMax == null ? t.lopMax : Math.max(lopMax, t.lopMax); }
      }
      const dtKb = kb.get(khoaTenBai(b.ten_bai))?.dienTich; // diện tích bãi lớn đã khai báo thì ưu tiên
      ttBai.set(b.ten_bai, { vMax: coV ? vMax : null, dt: dtKb > 0 ? dtKb : dt || null, lopMin, lopMax });
    }
    return { ttDong, ttBai };
  }, [bai, kho, kb]);

  const khop = (b) => {
    return !q.trim() || plain([b.ten_bai, ...b.dong.flatMap((d) => [d.ten, d.hang, ...(d.chua || []).map((c) => c.hang)])].join(" ")).includes(plain(q));
  };

  // Bố trí: mỗi khu vực một phần; khối cây xếp 2 cột (cột nào thấp hơn thì đặt vào), khối nhiều bãi nhỏ chiếm cả chiều ngang, khối gọn 5 khối một hàng
  const bd = useMemo(() => {
    let y = PAD; const phan = [];
    for (const k of dsKhu) {
      const ds = bai.filter((b) => khuCua(b) === k && khop(b)).sort((a, b) => a.ten_bai.localeCompare(b.ten_bai, "vi", { numeric: true }));
      if (!ds.length) continue;
      const all = bai.filter((b) => khuCua(b) === k), ton = all.reduce((s, b) => s + b.ton, 0), suc = all.reduce((s, b) => s + (b.sucChua || 0), 0);
      const soMai = all.filter((b) => mai.get(b.ten_bai)?.mai).length, v = all.reduce((s, b) => s + ((tp ? ttBai.get(b.ten_bai)?.dt : ttBai.get(b.ten_bai)?.vMax) || 0), 0);
      const yHead = y; y += 40;
      const cay = ds.filter((b) => b.dong.length > 1), gon = ds.filter((b) => b.dong.length <= 1), cot = [y, y], dat = [];
      for (const b of cay) {
        if (soCot(b) > 1) { const yy = Math.max(...cot); dat.push({ b, loai: "cay", x: PAD, y: yy }); cot[0] = cot[1] = yy + caoCay(b) + 22; continue; }
        const c = cot[0] <= cot[1] ? 0 : 1; dat.push({ b, loai: "cay", x: PAD + c * ((VB - 2 * PAD) / 2), y: cot[c] }); cot[c] += caoCay(b) + 22;
      }
      y = cay.length ? Math.max(...cot) : y;
      const moiHang = Math.max(1, Math.floor((VB - 2 * PAD) / CW_GON));
      gon.forEach((b, i) => dat.push({ b, loai: "gon", x: PAD + (i % moiHang) * CW_GON, y: y + Math.floor(i / moiHang) * GON_H }));
      if (gon.length) y += Math.ceil(gon.length / moiHang) * GON_H;
      phan.push({ k, yHead, dat, ton, suc, v, soMai, soLo: all.length - soMai, soNho: all.reduce((s, b) => s + b.dong.length, 0), n: all.length });
      y += 18;
    }
    return { phan, cao: Math.max(y, 120) };
  }, [bai, kb, dsKhu, q, mai, ttBai]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bấm một bãi trên bản đồ: bỏ bộ lọc, cuộn tới bãi đó và nháy viền vàng
  const diToi = (t) => { setQ(""); setNhay({ t, n: Date.now() }); };
  useEffect(() => {
    if (!nhay) return undefined;
    const r = requestAnimationFrame(() => document.getElementById(`kb-blk-${khoaTenBai(nhay.t)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    const h = setTimeout(() => setNhay(null), 3500);
    return () => { cancelAnimationFrame(r); clearTimeout(h); };
  }, [nhay]);
  const nhomMap = useMemo(() => dsKhu.map((k) => ({ k, ds: bai.filter((b) => khuCua(b) === k).sort((a, b) => a.ten_bai.localeCompare(b.ten_bai, "vi", { numeric: true })) })), [dsKhu, bai]); // eslint-disable-line react-hooks/exhaustive-deps

  const donVi = tp ? "m²" : "m³";

  return (
    <div ref={dauRef} className="grid scroll-mt-4 gap-2">
      <style>{CSS}</style>
      <div className="relative w-fit"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 w-64 pl-8 text-sm" placeholder="Tìm bãi, gian, hàng…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="overflow-hidden rounded-lg border border-sky-900" style={{ background: "rgba(10, 60, 120, 0.32)", WebkitBackdropFilter: "blur(12px)", backdropFilter: "blur(12px)" }}>
        <svg viewBox={`0 0 ${VB} ${bd.cao}`} width="100%" className="block" role="img" aria-label={`Sơ đồ ${ten}`}>
          <defs>
            <linearGradient id="kb-vom" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7cc4ff" stopOpacity="0.4" /><stop offset="100%" stopColor="#1d5fd1" stopOpacity="0.12" /></linearGradient>
            <linearGradient id="kb-than" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4c9df0" stopOpacity="0.5" /><stop offset="100%" stopColor="#1748a8" stopOpacity="0.6" /></linearGradient>
            <linearGradient id="kb-mat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7cc4ff" stopOpacity="0.7" /><stop offset="100%" stopColor="#1f5fd1" stopOpacity="0.85" /></linearGradient>
            <filter id="kb-sang" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="m" /><feMerge><feMergeNode in="m" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {bd.phan.map((p) => (
            <g key={p.k} id={`kb-khu-${khoaTenBai(p.k)}`}>
              <text x={PAD} y={p.yHead + 20} fontSize="17" fontWeight="700" fill="#e6f2ff">{p.k}
                <tspan fontSize="12" fontWeight="400" fill="#8fb4dc">{`   ${p.n} bãi lớn · ${p.soNho} bãi nhỏ · ${p.soMai} kho mái che · ${p.soLo} bãi lộ thiên · tồn `}</tspan>
                <tspan fontSize="12" fontWeight="700" fill={CHU[mucDay(p.suc ? p.ton / p.suc : null)]}>{so(p.ton, 0)} t{p.suc ? ` (${pct(p.ton / p.suc)})` : ""}</tspan>
                <tspan fontSize="12" fontWeight="400" fill="#8fb4dc">{p.v ? ` · ${so(p.v, 0)} ${donVi}` : ""}</tspan>
              </text>
              <line x1={PAD} y1={p.yHead + 30} x2={VB - PAD} y2={p.yHead + 30} stroke="#3b6fc0" strokeOpacity="0.6" />
              {p.dat.map((o, i) => {
                const m = mai.get(o.b.ten_bai)?.mai, uid = `kb-${khoaTenBai(o.b.ten_bai)}-${i}`, nh = nhay?.t === o.b.ten_bai;
                return o.loai === "cay"
                  ? <KhoiCay key={o.b.ten_bai} b={o.b} mai={m} x={o.x} y={o.y} onMo={onMo} uid={uid} tp={tp} tt={ttBai.get(o.b.ten_bai)} ttDong={ttDong} nhay={nh} />
                  : <KhoiGon key={o.b.ten_bai} b={o.b} mai={m} x={o.x} y={o.y} onMo={onMo} uid={uid} tt={ttBai.get(o.b.ten_bai)} tp={tp} nhay={nh} />;
              })}
            </g>))}
          {!bd.phan.length && <text x={VB / 2} y="64" textAnchor="middle" fontSize="14" fill="#8fb4dc">Không có bãi nào khớp bộ lọc.</text>}
        </svg>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">Mái vòm = kho có mái che · đống vòm = bãi lộ thiên. Khối màu có mặt sóng bên trong = mức lấp đầy: xanh bình thường, vàng từ {pct(NGUONG_KHO.vang)}, đỏ từ {pct(NGUONG_KHO.do)} (nhấp nháy).{tp ? " Diện tích (m²) và số lớp xếp khả dụng theo Danh mục › Kho bãi." : " Số m³ = thể tích tối đa (diện tích × chiều cao chất đống; không có thì sức chứa ÷ tỉ trọng hàng)."} Bấm một bãi để mở bảng chi tiết.{doan ? " Kho / bãi có mái che đang đoán theo tên (chưa có cột mái che ở Danh mục › Khai báo kho / bãi)." : ""}</p>
      <BanDoDinhVi nhom={nhomMap} ten={ten} onDi={diToi} onToanKho={() => { dauRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
        onKhu={(k) => { setQ(""); requestAnimationFrame(() => document.getElementById(`kb-khu-${khoaTenBai(k)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
    </div>
  );
}
