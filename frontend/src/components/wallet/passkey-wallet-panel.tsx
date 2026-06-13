"use client";

// Graduate-only passkey smart wallet (APAC spec §4, Pillar 2). Create a payout
// wallet with Face ID / fingerprint — no seed phrase, no extension, no XLM. The
// wallet's contract address is the payout recipient (the payout loop already
// accepts contract addresses). Renders only when the deployment has provisioned
// passkeys; otherwise graduates keep the Freighter flow.
//
// passkey-kit is loaded through a dynamic import inside the click handlers, so
// it never lands in this component's chunk — only after a graduate actually
// creates or connects a wallet (P1-3 bundle invariant).

import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { passkeysEnabled } from "@/lib/passkey-config";
import { shortenAddress } from "@/lib/format";

const KEY_STORAGE = "stellaroid.passkey.keyId";

type PanelState =
  | { kind: "idle" }
  | { kind: "busy"; action: "create" | "connect" }
  | { kind: "ready"; address: string }
  | { kind: "error"; message: string };

export function PasskeyWalletPanel() {
  const [enabled, setEnabled] = useState(false);
  const [storedKeyId, setStoredKeyId] = useState<string | null>(null);
  const [state, setState] = useState<PanelState>({ kind: "idle" });

  useEffect(() => {
    setEnabled(passkeysEnabled());
    try {
      setStoredKeyId(localStorage.getItem(KEY_STORAGE));
    } catch {
      // Private mode / blocked storage — reconnect just falls back to discovery.
    }
  }, []);

  // Nothing to show until a wallet-factory is provisioned for this network.
  if (!enabled) return null;

  const rememberKey = (keyId: string) => {
    try {
      localStorage.setItem(KEY_STORAGE, keyId);
    } catch {
      // ignore storage failures; the wallet still works this session
    }
    setStoredKeyId(keyId);
  };

  const toMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  async function handleCreate() {
    setState({ kind: "busy", action: "create" });
    try {
      const { loadPasskeyKit, createGraduateWallet } = await import(
        "@/lib/passkey-wallet"
      );
      const kit = await loadPasskeyKit();
      const created = await createGraduateWallet(kit, {
        appName: "Stellaroid Earn",
        userName: `graduate-${Date.now()}`,
      });
      const response = await fetch("/api/passkey/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xdr: created.signedTxXdr }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "The relayer could not deploy the wallet.");
      }
      rememberKey(created.keyIdBase64);
      setState({ kind: "ready", address: created.contractAddress });
    } catch (error) {
      setState({ kind: "error", message: toMessage(error, "Could not create the wallet.") });
    }
  }

  async function handleConnect() {
    setState({ kind: "busy", action: "connect" });
    try {
      const { loadPasskeyKit, connectGraduateWallet } = await import(
        "@/lib/passkey-wallet"
      );
      const kit = await loadPasskeyKit();
      const connected = await connectGraduateWallet(
        kit,
        storedKeyId ? { keyId: storedKeyId } : {},
      );
      rememberKey(connected.keyIdBase64);
      setState({ kind: "ready", address: connected.contractAddress });
    } catch (error) {
      setState({ kind: "error", message: toMessage(error, "Could not connect the wallet.") });
    }
  }

  const busy = state.kind === "busy";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="w-4 h-4 text-primary" aria-hidden="true" />
        <p className="m-0 text-sm font-semibold text-text">Passkey wallet</p>
      </div>
      <p className="m-0 text-[12px] text-text-muted leading-relaxed">
        Create a payout wallet with your fingerprint or Face ID — no seed phrase,
        no extension, no XLM to start.
      </p>

      {state.kind === "ready" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-success">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span className="text-[13px] font-semibold">Wallet ready</span>
          </div>
          <p className="m-0 text-[11px] text-text-muted">
            Your payout address — give this to employers:
          </p>
          <CopyButton
            value={state.address}
            label={shortenAddress(state.address)}
            ariaLabel="Copy payout address"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={busy && state.action === "create"}
            disabled={busy}
            onClick={handleCreate}
          >
            <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
            Create passkey wallet
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={busy && state.action === "connect"}
            disabled={busy}
            onClick={handleConnect}
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            {storedKeyId ? "Reconnect wallet" : "Connect existing wallet"}
          </Button>
        </div>
      )}

      {state.kind === "error" ? (
        <p className="m-0 text-[12px] text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export default PasskeyWalletPanel;
