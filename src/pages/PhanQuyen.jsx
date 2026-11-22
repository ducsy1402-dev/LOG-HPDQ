import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Info, ChevronDown, UserPlus, Wand2 } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PageHead, Empty } from "@/components/common";
import { cn } from "@/lib/utils";
import { matchQ } from "@/lib/format";
import { MUC_XEM, NHOM_SUA, DS_SUA, TEN_SUA, TEN_MIEN_TAI_KHOAN, chuanQuyenXem, xemCanCho, tenDangNhap } from "@/lib/quyen";

const TEN_XEM = Object.fromEntries(MUC_XEM.map((m) => [m.id, m.ten]));
const bang = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Nút bật / tắt (Quản trị)
function CongTat({ bat, doi, khoa, ten, title }) {
  return (
    <button type="button" role="switch" aria-checked={bat} aria-label={ten} title={title} disabled={khoa} onClick={() => doi(!bat)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", bat ? "bg-primary" : "bg-muted-foreground/40")}>
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", bat ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

const Tick = ({ bat, doi, khoa, children, title }) => (
  <label className={cn("flex items-start gap-2 rounded px-1.5 py-1 text-sm", khoa ? "opacity-60" : "cursor-pointer hover:bg-accent")} title={title}>
    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]" checked={bat} disabled={khoa} onChange={(e) => doi(e.target.checked)} />
    <span>{children}</span>
  </label>
);

// Danh sách tick Quyền xem: "Tất cả" thì các trang còn lại đã nằm trong đó
function DsXem({ gia, doi }) {
  const tatCa = gia.includes("tat_ca");
  return (
    <div className="grid gap-0.5">
      {MUC_XEM.map((m) => (
        <Tick key={m.id} bat={m.id === "tat_ca" ? tatCa : tatCa || gia.includes(m.id)} khoa={m.id !== "tat_ca" && tatCa}
          doi={(b) => doi(m.id === "tat_ca" ? (b ? ["tat_ca"] : []) : b ? [...gia, m.id] : gia.filter((x) => x !== m.id))}>
          {m.id === "tat_ca" ? <b>{m.ten}</b> : m.ten}
        </Tick>))}
    </div>
  );
}

// Danh sách tick Quyền chỉnh sửa, xếp nhóm theo khu vực
function DsSua({ gia, doi }) {
  const dat = (id, b) => doi(b ? [...new Set([...gia, id])] : gia.filter((x) => x !== id));
  return (
    <div className="grid gap-2">
      <Tick bat={gia.length === DS_SUA.length} doi={(b) => doi(b ? [...DS_SUA] : [])}><b>Chọn tất cả</b></Tick>
      {NHOM_SUA.map((g) => (
        <div key={g.ten} className="grid gap-0.5">
          <div className="px-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">{g.ten}</div>
          {g.muc.map((m) => <Tick key={m.id} bat={gia.includes(m.id)} doi={(b) => dat(m.id, b)} title={m.sua}>{m.ten}</Tick>)}
        </div>))}
    </div>
  );
}

function TomTat({ ds, ten, trong }) {
  if (!ds.length) return <span className="text-muted-foreground">{trong}</span>;
  const t = ds.map(ten);
  return <span className="truncate">{t.length <= 2 ? t.join(", ") : `${t.slice(0, 2).join(", ")} +${t.length - 2}`}</span>;
}

// Ô chọn nhiều giá trị trong bảng: mở hộp tick, đóng hộp thì lưu nếu có đổi
function OChon({ ten, giaTri, luu, tomTat, rong, children }) {
  const [mo, setMo] = useState(false);
  const [nhap, setNhap] = useState(giaTri);
  useEffect(() => { if (!mo) setNhap(giaTri); }, [giaTri, mo]);
  const doiMo = (o) => { setMo(o); if (!o && !bang(nhap, giaTri)) luu(nhap); };
  return (
    <Popover open={mo} onOpenChange={doiMo}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={ten} className="flex h-8 w-full items-center justify-between gap-2 rounded-md border bg-card px-2.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {tomTat}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("max-h-[min(70vh,var(--radix-popover-content-available-height))] overflow-auto p-2", rong)}>{children(nhap, setNhap)}</PopoverContent>
    </Popover>
  );
}

const taoMatKhau = () => {
  const kyTu = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(b, (n) => kyTu[n % kyTu.length]).join("");
};

// Hộp thêm tài khoản: gọi Edge Function tao-tai-khoan (chỉ quản trị)
function HopThem({ onClose, onXong }) {
  const { api, toast, fail } = useApp();
  const [ten, setTen] = useState(""), [hoTen, setHoTen] = useState(""), [mk, setMk] = useState(""), [qt, setQt] = useState(false);
  const [xem, setXem] = useState(["tat_ca"]), [sua, setSua] = useState([]);
  const [loi, setLoi] = useState(""), [dang, setDang] = useState(false);
  const gui = async (e) => {
    e.preventDefault(); setLoi("");
    const t = ten.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}(@[a-z0-9.-]+\.[a-z]{2,})?$/.test(t)) return setLoi("Tên đăng nhập chỉ gồm chữ không dấu, số, dấu . _ - (3 đến 40 ký tự).");
    if (mk.length < 8) return setLoi("Mật khẩu cần ít nhất 8 ký tự.");
    setDang(true);
    try {
      await api.taoTaiKhoan({ ten: t, ho_ten: hoTen.trim(), mat_khau: mk, quan_tri: qt, xem: chuanQuyenXem(xem), sua });
      toast(`Đã tạo tài khoản ${t}. Gửi tên đăng nhập và mật khẩu cho người dùng; họ tự đổi mật khẩu ở menu tài khoản.`);
      onXong();
    } catch (err) { setLoi(err.message || String(err)); fail?.(err); setDang(false); }
  };
  const doiSua = (d) => { setSua(d); if (!xem.includes("tat_ca")) setXem(chuanQuyenXem([...new Set([...xem, ...xemCanCho(d)])])); };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="max-w-3xl" title="Thêm tài khoản"
      description={`Tên đăng nhập gõ không đuôi (web tự thêm @${TEN_MIEN_TAI_KHOAN}). Tài khoản dùng được ngay, không cần thư kích hoạt.`}>
      <form onSubmit={gui} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên đăng nhập"><Input required autoComplete="off" placeholder="VD: kehoachlog" value={ten} onChange={(e) => setTen(e.target.value)} /></Field>
          <Field label="Họ tên hiển thị"><Input autoComplete="off" placeholder="VD: Kế hoạch LOG" value={hoTen} onChange={(e) => setHoTen(e.target.value)} /></Field>
        </div>
        <Field label="Mật khẩu (ít nhất 8 ký tự)">
          <div className="flex gap-2">
            <Input required autoComplete="new-password" className="font-mono" value={mk} onChange={(e) => setMk(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => setMk(taoMatKhau())}><Wand2 />Tạo ngẫu nhiên</Button>
          </div>
        </Field>
        <div className="flex items-center gap-3 rounded-md border px-3 py-2">
          <CongTat bat={qt} doi={setQt} ten="Quản trị" />
          <div className="text-sm"><b>Quản trị</b> <span className="text-muted-foreground">· xem và sửa tất cả, đặt quyền cho người khác, thêm tài khoản</span></div>
        </div>
        {!qt && (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="rounded-md border p-2"><div className="mb-1 px-1.5 text-xs font-semibold">Quyền xem</div><DsXem gia={xem} doi={(d) => setXem(chuanQuyenXem(d))} /></div>
            <div className="rounded-md border p-2"><div className="mb-1 px-1.5 text-xs font-semibold">Quyền chỉnh sửa</div><DsSua gia={sua} doi={doiSua} /></div>
          </div>)}
        {loi && <div role="alert" className="rounded-md border border-bad/40 bg-bad/5 px-3 py-2 text-sm text-bad">{loi}</div>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Hủy</Button><Button disabled={dang}>{dang ? "Đang tạo…" : "Tạo tài khoản"}</Button></div>
      </form>
    </Dialog>
  );
}

// Bảng phân quyền: mỗi tài khoản một dòng, bốn cột Tài khoản · Quyền xem · Quyền chỉnh sửa · Quản trị. Quản trị là quản trị mọi phần.
export default function PhanQuyen() {
  const { api, fail, run, user } = useApp();
  const [dl, setDl] = useState(null); // { users, xem, sua, chuaSql }
  const [q, setQ] = useState("");
  const [them, setThem] = useState(false);
  const tai = () => api.listPhanQuyen().then(setDl).catch(fail);
  useEffect(() => { tai(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const xemCua = useMemo(() => { const m = {}; for (const x of dl?.xem || []) (m[x.user_id] ||= []).push(x.muc); return m; }, [dl]);
  const suaCua = useMemo(() => { const m = {}; for (const x of dl?.sua || []) (m[x.user_id] ||= []).push(x.nhom); return m; }, [dl]);

  const luu = async (u, xem, sua, loai) => {
    // Tick sửa một mục thì tự thêm quyền xem trang của mục đó (không có quyền xem thì không vào được chỗ sửa)
    const x = loai === "sua" && !xem.includes("tat_ca") ? chuanQuyenXem([...new Set([...xem, ...xemCanCho(sua)])]) : chuanQuyenXem(xem);
    if (await run(() => api.setQuyenTaiKhoan(u.user_id, { xem: x, sua, coVaiTro: !!u.vai_tro_cu }), `Đã lưu quyền của ${tenDangNhap(u.email)}`)) tai();
  };
  const doiQuanTri = async (u, bat) => {
    if (bat && !window.confirm(`Cho ${tenDangNhap(u.email)} quyền Quản trị? Tài khoản này sẽ xem và sửa được tất cả, đặt quyền cho người khác.`)) return;
    if (await run(() => api.setQuanTri(u.user_id, bat), bat ? `Đã cho ${tenDangNhap(u.email)} quyền quản trị` : `Đã bỏ quyền quản trị của ${tenDangNhap(u.email)}`)) tai();
  };

  return (
    <>
      <PageHead title="Phân quyền"><Button size="sm" onClick={() => setThem(true)}><UserPlus />Thêm tài khoản</Button></PageHead>
      <div className="mb-3 grid gap-1 rounded-md border border-info/40 bg-info/5 px-3 py-2 text-sm">
        <div className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-info" /><span><b>Quyền xem</b>: trang nào hiện trên menu của tài khoản. <b>Quyền chỉnh sửa</b>: chỉ được thêm / sửa / xóa ở các mục đã tick (chặn thật ở CSDL). <b>Quản trị</b>: xem và sửa tất cả, đặt quyền, thêm tài khoản.</span></div>
        <div className="pl-6 text-xs text-muted-foreground">Chọn xong, đóng ô chọn là web tự lưu. Tick một mục chỉnh sửa thì web tự thêm quyền xem của trang đó. Đổi mật khẩu người khác: Supabase › Authentication › Users.</div>
      </div>
      {dl?.chuaSql && <div className="mb-3 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">Cần chạy <b>sql/27_phan_quyen_moi.sql</b> trong Supabase để dùng bảng phân quyền mới.</div>}
      <Card>
        <CardContent className="pt-4">
          <Input className="mb-3 w-64" placeholder="Tìm tên đăng nhập, họ tên…" value={q} onChange={(e) => setQ(e.target.value)} />
          {dl == null ? <div className="text-sm text-muted-foreground">Đang tải…</div> : dl.users.length ? (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>Tài khoản</th><th className="w-[250px]">Quyền xem</th><th className="w-[310px]">Quyền chỉnh sửa</th><th className="w-24 text-center">Quản trị</th></tr></thead>
                <tbody>{dl.users.filter((u) => matchQ(q, u.email, u.ho_ten)).map((u) => {
                  const admin = u.vai_tro_cu === "quan_tri", xem = xemCua[u.user_id] || [], sua = suaCua[u.user_id] || [];
                  const la = user?.id === u.user_id;
                  return (
                    <tr key={u.user_id} className={admin ? "bg-primary/5" : undefined}>
                      <td><div className="font-medium">{u.ho_ten || "—"}</div><div className="text-[0.6875rem] text-muted-foreground">{tenDangNhap(u.email)}</div></td>
                      {admin ? <td colSpan={2}><span className="inline-flex items-center gap-1 text-sm text-primary"><ShieldCheck className="h-4 w-4" />Quản trị: xem và sửa tất cả</span></td> : <>
                        <td><OChon ten={`Quyền xem của ${tenDangNhap(u.email)}`} giaTri={xem} luu={(d) => luu(u, d, sua, "xem")}
                          tomTat={<TomTat ds={xem.includes("tat_ca") ? ["tat_ca"] : MUC_XEM.map((m) => m.id).filter((id) => xem.includes(id))} ten={(id) => TEN_XEM[id]} trong="Chưa cấp (không thấy trang nào)" />} rong="w-64">
                          {(g, d) => <DsXem gia={g} doi={(v) => d(chuanQuyenXem(v))} />}
                        </OChon></td>
                        <td><OChon ten={`Quyền chỉnh sửa của ${tenDangNhap(u.email)}`} giaTri={sua} luu={(d) => luu(u, xem, d, "sua")}
                          tomTat={<TomTat ds={DS_SUA.filter((id) => sua.includes(id))} ten={TEN_SUA} trong="Chỉ xem" />} rong="w-[22rem]">
                          {(g, d) => <DsSua gia={g} doi={d} />}
                        </OChon></td>
                      </>}
                      <td className="text-center"><CongTat bat={admin} doi={(b) => doiQuanTri(u, b)} khoa={la} ten={`Quản trị: ${tenDangNhap(u.email)}`} title={la ? "Không tự bỏ quyền quản trị của chính mình" : undefined} /></td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
          ) : <Empty>Chưa có tài khoản.</Empty>}
        </CardContent>
      </Card>
      {them && <HopThem onClose={() => setThem(false)} onXong={() => { setThem(false); tai(); }} />}
    </>
  );
}
