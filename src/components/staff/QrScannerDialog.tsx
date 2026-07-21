import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseQrPayload } from "@/lib/qrTokens";
import { ScanLine, Keyboard, Camera } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScanned: (token: string) => void;
}

const QrScannerDialog = ({ open, onOpenChange, onScanned }: Props) => {
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const handleResult = (raw: string) => {
    const token = parseQrPayload(raw);
    if (!token) {
      setError("This QR code isn't recognised. Ask the parent to open the latest code.");
      return;
    }
    setError(null);
    onScanned(token);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setManual(""); setError(null); setShowManual(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Scan sign-in QR</DialogTitle>
              <DialogDescription className="mt-1">
                Point the camera at the parent's QR code. The system automatically detects whether it's a check-in or check-out.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!showManual ? (
          <div className="space-y-3">
            {/* Camera surface stays true black for scan contrast — do not tint. */}
            <div className="aspect-square w-full overflow-hidden rounded-3xl bg-black">
              {open && (
                <Scanner
                  onScan={(detected) => {
                    if (detected && detected.length > 0) handleResult(detected[0].rawValue);
                  }}
                  onError={() => setError("Couldn't access camera. Use manual entry below.")}
                  constraints={{ facingMode: "environment" }}
                  styles={{ container: { width: "100%", height: "100%" }, video: { width: "100%", height: "100%", objectFit: "cover" } }}
                />
              )}
            </div>
            {error && (
              <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            <Button variant="secondary" size="sm" className="w-full gap-2" onClick={() => setShowManual(true)}>
              <Keyboard className="w-4 h-4" /> Enter code manually
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Paste or type code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 gap-2" onClick={() => setShowManual(false)}>
                <Camera className="w-4 h-4" /> Use camera
              </Button>
              <Button className="flex-1" onClick={() => handleResult(manual)} disabled={!manual.trim()}>Submit</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerDialog;
