import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import whiteLogo from "@/assets/logo-wordmark-white.png";
import inkLogo from "@/assets/logo-wordmark-ink.png";

const SEEN_KEY = "tde-home-intro-seen";

/** A short brand arrival, never a dependency on video or live-data loading. */
export function HomeIntro({ onReveal }: { onReveal: () => void }) {
  const [playing, setPlaying] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const revealed = useRef(false);
  const reveal = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    onReveal();
  }, [onReveal]);
  const finish = useCallback(() => {
    delete document.documentElement.dataset.homeIntro;
    setPlaying(false);
    reveal();
  }, [reveal]);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch { /* Private browsing can deny storage. */ }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (seen || reduced.matches || window.location.hash) { finish(); return; }
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* Still allow the visit. */ }
    setPlaying(true);
    document.documentElement.dataset.homeIntro = "playing";
    const timeout = window.setTimeout(finish, 2250);
    const revealTimer = window.setTimeout(reveal, 1550);
    const preferenceChanged = () => { if (reduced.matches) finish(); };
    reduced.addEventListener("change", preferenceChanged);
    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(revealTimer);
      reduced.removeEventListener("change", preferenceChanged);
      delete document.documentElement.dataset.homeIntro;
    };
  }, [finish, reveal]);

  return <Dialog.Root open={playing} onOpenChange={open => { if (!open) finish(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="tde-home-arrival-overlay" />
      <Dialog.Content ref={screenRef} className="tde-home-arrival"
        onOpenAutoFocus={event => { event.preventDefault(); screenRef.current?.focus(); }}
        onCloseAutoFocus={event => event.preventDefault()}>
        <Dialog.Title className="sr-only">Welcome to The Dance Exclusive</Dialog.Title>
        <Dialog.Description className="sr-only">Find your rhythm. Your homepage will appear shortly.</Dialog.Description>
        <div className="tde-arrival-panel tde-arrival-black" aria-hidden="true">
          <img src={whiteLogo} alt="" width="1000" height="469" loading="eager" decoding="async" />
        </div>
        <div className="tde-arrival-panel tde-arrival-blue" aria-hidden="true">
          <img src={inkLogo} alt="" width="1000" height="469" loading="eager" decoding="async" />
        </div>
        <Dialog.Close className="tde-arrival-skip">Skip intro <span aria-hidden="true">↗</span></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
