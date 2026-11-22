import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Hộp XEM TRƯỚC PDF dùng chung (anh Sỹ 22/11/2026): dựng đúng file PDF sẽ tải rồi cho xem ngay trong khung (trình xem PDF của trình duyệt) trước khi tải / in.
// PDF do web tự dựng (pdfmake) với khổ giấy ghi sẵn trong file, KHÔNG qua hộp thoại in của trình duyệt, nên mở ở máy nào cũng đúng chiều giấy.
//   lay(tab) -> Promise<Blob>   dựng PDF của thẻ đang chọn (không có thẻ thì tab = "")
//   dau                          chuỗi đổi khi dữ liệu / lựa chọn đổi (để dựng lại)
//   tabs [[khóa, nhãn]]          các thẻ chọn mẫu / cảng (tùy chọn)
//   them                         nút thêm ở chân hộp (VD Tải Excel)
export default function XemTruocPdf({ tieuDe, moTa, tabs = [], tab = "", setTab, lay, dau, tenFile, them, ghiChu, onClose }) {
  const [url, setUrl] = useState(null), [loi, setLoi] = useState(null);
  const ifr = useRef(null);
  useEffect(() => {
    let huy = false, u = null;
    setUrl(null); setLoi(null);
    Promise.resolve().then(() => lay(tab)).then((b) => { if (huy) return; u = URL.createObjectURL(b); setUrl(u); }).catch((e) => { if (!huy) setLoi(e?.message || String(e)); });
    return () => { huy = true; if (u) URL.revokeObjectURL(u); };
  }, [dau, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const tai = () => { if (!url) return; const a = document.createElement("a"); a.href = url; a.download = tenFile(tab); document.body.appendChild(a); a.click(); a.remove(); };
  const inRa = () => { try { ifr.current?.contentWindow?.focus(); ifr.current?.contentWindow?.print(); } catch { window.open(url, "_blank"); } };
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} className="h-[92vh] max-w-[min(1100px,calc(100vw-24px))]" title={tieuDe} description={moTa}
      footer={<>
        {them}
        <Button variant="outline" disabled={!url} onClick={() => window.open(url, "_blank")}><ExternalLink />Mở tab mới</Button>
        <Button variant="outline" disabled={!url} onClick={inRa}><Printer />In</Button>
        <Button disabled={!url} onClick={tai}><Download />Tải PDF</Button>
      </>}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        {tabs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            {tabs.map(([k, nhan]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${tab === k ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{nhan}</button>))}
            {ghiChu && <span className="ml-auto text-xs text-warn">{ghiChu}</span>}
          </div>)}
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-md border bg-muted/40">
          {url ? <iframe ref={ifr} key={url} src={`${url}#navpanes=0&view=FitH`} title="Xem trước PDF" className="h-full w-full bg-white" />
            : loi ? <div className="flex h-full items-center justify-center p-4 text-center text-sm text-bad">Không dựng được PDF: {loi}</div>
              : <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Đang dựng bản xem trước…</div>}
        </div>
        <p className="text-[0.6875rem] text-muted-foreground">Đây là đúng file sẽ tải về. Nếu khung không hiện được PDF trên trình duyệt này, bấm "Mở tab mới" để xem, hoặc "Tải PDF".</p>
      </div>
    </Dialog>
  );
}
