import assert from "node:assert/strict";
import test from "node:test";
import {
  getPasskeyClientConfig,
  getWalletWasmHash,
  passkeysEnabled,
} from "./passkey-config.ts";

const WASM_HASH =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function withEnv(
  env: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("passkeys are disabled when no wallet WASM hash is provisioned", () => {
  withEnv(
    {
      NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH: undefined,
      NEXT_PUBLIC_ENABLE_PASSKEYS: undefined,
    },
    () => {
      assert.equal(getWalletWasmHash(), "");
      assert.equal(passkeysEnabled(), false);
      assert.equal(getPasskeyClientConfig(), null);
    },
  );
});

test("passkeys enable once a valid WASM hash is set", () => {
  withEnv({ NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH: WASM_HASH }, () => {
    assert.equal(getWalletWasmHash(), WASM_HASH);
    assert.equal(passkeysEnabled(), true);
    const config = getPasskeyClientConfig();
    assert.ok(config);
    assert.equal(config.walletWasmHash, WASM_HASH);
    assert.ok(config.rpcUrl.length > 0);
    assert.ok(config.networkPassphrase.length > 0);
  });
});

test("an explicit disable flag overrides a provisioned hash", () => {
  withEnv(
    {
      NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH: WASM_HASH,
      NEXT_PUBLIC_ENABLE_PASSKEYS: "false",
    },
    () => {
      assert.equal(passkeysEnabled(), false);
      assert.equal(getPasskeyClientConfig(), null);
    },
  );
});

test("a malformed WASM hash is treated as unprovisioned", () => {
  withEnv({ NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH: "not-a-hash" }, () => {
    assert.equal(getWalletWasmHash(), "");
    assert.equal(passkeysEnabled(), false);
  });
});
