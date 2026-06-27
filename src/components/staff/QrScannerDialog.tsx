import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseQrPayload } from "@/lib/qrTokens";
import { ScanLine, Keyboard } from "lucide-react";

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
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> Scan sign-in QR
          </DialogTitle>
          <DialogDescription>
            Point the camera at the parent's QR code. The system automatically detects whether it's a check-in or check-out.
          </DialogDescription>
        </DialogHeader>

        {!showManual ? (
          <div className="space-y-3">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-black">
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
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowManual(true)}>
              <Keyboard className="w-4 h-4 mr-2" /> Enter code manually
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
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowManual(false)}>Use camera</Button>
              <Button className="flex-1" onClick={() => handleResult(manual)} disabled={!manual.trim()}>Submit</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerDialog;