"use client";

// Camera QR scanner for /verify with always-available offline fallbacks.
// Detection prefers the native BarcodeDetector when present and falls back to
// jsQR, which is loaded via dynamic import inside this client component only —
// it must never land in other routes' chunks.

import { useRef, useState, type ChangeEvent } from "react";
import { useEffect } from "react";
import Link from "next/link";
import {
  CameraOff,
  Flashlight,
  FlashlightOff,
  ImageUp,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VerifyResult } from "./verify-result";

type CameraState = "starting" | "active" | "denied" | "unavailable";

// BarcodeDetector is not in lib.dom yet — minimal structural types.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  ): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

// Torch is a non-standard (but widely shipped) capability/constraint.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean };

type JsQrFn = (typeof import("jsqr"))["default"];

const DETECT_INTERVAL_MS = 100; // ~10fps keeps CPU cool on midrange phones.

async function loadJsQr(): Promise<JsQrFn> {
  const mod = await import("jsqr");
  return mod.default;
}

function decodeImageData(jsQr: JsQrFn, imageData: ImageData): string | null {
  const result = jsQr(imageData.data, imageData.width, imageData.height);
  const text = result?.data?.trim();
  return text ? text : null;
}

export function VerifyScanner() {
  const [payload, setPayload] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera lifecycle: starts whenever the scanner view is showing, stops on
  // success (payload set triggers cleanup) and on unmount.
  useEffect(() => {
    if (payload !== null) return;

    let disposed = false;
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;

    const start = async () => {
      setCameraState("starting");
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraState("unavailable");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (error) {
        if (!disposed) {
          setCameraState(
            error instanceof DOMException && error.name === "NotAllowedError"
              ? "denied"
              : "unavailable",
          );
        }
        return;
      }

      if (disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {
        // Autoplay interruptions are non-fatal; the stream keeps flowing.
      });
      if (disposed) return;
      setCameraState("active");

      const [track] = stream.getVideoTracks();
      trackRef.current = track ?? null;
      const capabilities = track?.getCapabilities?.() as
        | TorchCapabilities
        | undefined;
      setTorchAvailable(Boolean(capabilities?.torch));

      // Detection loop: native BarcodeDetector when available, else jsQR fed
      // from an offscreen canvas.
      let detector: BarcodeDetectorLike | null = null;
      const detectorCtor = (
        window as Window & { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;
      if (detectorCtor) {
        try {
          detector = new detectorCtor({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      let jsQr: JsQrFn | null = null;
      if (!detector) {
        jsQr = await loadJsQr();
      }
      if (disposed) return;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      let busy = false;

      intervalId = window.setInterval(() => {
        if (busy || disposed) return;
        const liveVideo = videoRef.current;
        if (!liveVideo || liveVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }
        busy = true;

        const finish = (text: string | null) => {
          busy = false;
          if (text && !disposed) setPayload(text);
        };

        if (detector) {
          detector
            .detect(liveVideo)
            .then((codes) => finish(codes[0]?.rawValue?.trim() || null))
            .catch(async () => {
              // Platform claims support but can't detect — fall back to jsQR.
              detector = null;
              jsQr = jsQr ?? (await loadJsQr());
              finish(null);
            });
          return;
        }

        try {
          if (jsQr && context && liveVideo.videoWidth > 0) {
            canvas.width = liveVideo.videoWidth;
            canvas.height = liveVideo.videoHeight;
            context.drawImage(liveVideo, 0, 0);
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            finish(decodeImageData(jsQr, imageData));
          } else {
            finish(null);
          }
        } catch {
          finish(null);
        }
      }, DETECT_INTERVAL_MS);
    };

    void start();

    return () => {
      disposed = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
      setTorchAvailable(false);
      setTorchOn(false);
    };
  }, [payload]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      const constraint: TorchConstraintSet = { torch: next };
      await track.applyConstraints({ advanced: [constraint] });
      setTorchOn(next);
    } catch {
      // Device refused the constraint — leave the toggle as-is.
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // Allow re-selecting the same file.
    if (!file) return;
    setUploadError(null);

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas-unavailable");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const jsQr = await loadJsQr();
      const text = decodeImageData(jsQr, imageData);
      if (!text) {
        setUploadError("No QR code found in that image. Try a sharper photo.");
        return;
      }
      setPayload(text);
    } catch {
      setUploadError("Couldn't read that image. Try a different file.");
    }
  };

  if (payload !== null) {
    return (
      <VerifyResult
        payload={payload}
        onRescan={() => {
          setPasteValue("");
          setUploadError(null);
          setPayload(null);
        }}
      />
    );
  }

  const pasteReady = pasteValue.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Camera viewport — full-bleed on mobile, framed on larger screens. */}
      <section
        aria-label="QR scanner"
        data-testid="verify-viewport"
        className={cn(
          "relative overflow-hidden bg-black",
          "-mx-4 sm:mx-0 sm:rounded-2xl",
          "border-y sm:border border-border-glass",
          "aspect-[3/4] max-h-[60dvh] sm:aspect-video",
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Gold corner-bracket scan frame (pure CSS, no layout shift). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <div className="relative aspect-square h-[min(60%,260px)]">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-md border-l-[3px] border-t-[3px] border-primary" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-md border-r-[3px] border-t-[3px] border-primary" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-md border-b-[3px] border-l-[3px] border-primary" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-md border-b-[3px] border-r-[3px] border-primary" />
          </div>
        </div>

        {cameraState !== "active" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-black/70">
            {cameraState === "starting" ? (
              <p className="m-0 text-sm text-text-muted">Requesting camera…</p>
            ) : (
              <>
                <CameraOff
                  className="w-8 h-8 text-text-muted"
                  aria-hidden="true"
                />
                <p className="m-0 text-sm font-semibold text-text">
                  {cameraState === "denied"
                    ? "Camera access was denied."
                    : "No camera is available on this device."}
                </p>
                <p className="m-0 text-[0.8125rem] text-text-muted leading-relaxed">
                  Use the paste or image options below — they verify the same
                  way, fully offline.
                </p>
              </>
            )}
          </div>
        ) : null}

        {torchAvailable && cameraState === "active" ? (
          <Button
            variant="secondary"
            size="icon"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={torchOn ? "Turn torch off" : "Turn torch on"}
            className="absolute bottom-3 right-3"
          >
            {torchOn ? (
              <FlashlightOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Flashlight className="w-5 h-5" aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </section>

      {cameraState === "active" ? (
        <p
          role="status"
          className="m-0 -mt-3 flex items-center gap-2 text-sm text-text-muted"
        >
          {/* globals.css zeroes this pulse under prefers-reduced-motion. */}
          <ScanLine
            className="w-4 h-4 text-primary animate-pulse"
            aria-hidden="true"
          />
          Scanning…
        </p>
      ) : null}

      {/* Fallbacks — always rendered so verification never dead-ends. */}
      <section
        aria-label="Verify without the camera"
        className="flex flex-col gap-5 border-t border-border pt-5"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="verify-paste"
            className="text-[13px] font-medium text-text-muted"
          >
            Paste code
          </label>
          <textarea
            id="verify-paste"
            rows={3}
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            placeholder="SLR1:…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className={cn(
              "w-full min-h-[88px] rounded-lg border border-border bg-surface-2 px-3 py-2",
              "font-mono text-[13px] text-text placeholder:text-text-muted/60",
              "transition-colors duration-150",
              "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
            )}
          />
          <Button
            variant="secondary"
            disabled={!pasteReady}
            onClick={() => setPayload(pasteValue.trim())}
            className="mt-1 self-start"
          >
            Verify pasted code
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={fileInputRef}
            id="verify-upload"
            type="file"
            accept="image/*"
            aria-label="QR image file"
            onChange={handleUpload}
            className="sr-only"
          />
          <Button
            variant="secondary"
            icon={<ImageUp className="w-4 h-4" aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
            className="self-start"
          >
            Upload QR image
          </Button>
          {uploadError ? (
            <p className="m-0 text-[12px] text-danger" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>

        <Link
          href="/proof"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center self-start text-sm font-semibold text-accent no-underline hover:underline"
        >
          Enter hash manually →
        </Link>
      </section>
    </div>
  );
}

export default VerifyScanner;
