import assert from "node:assert/strict";
import test from "node:test";
import {
  getPasskeyServerConfig,
  isLikelyTransactionXdr,
  passkeyRelayerConfigured,
  submitDeployTransaction,
  type TxSender,
} from "./passkey-server.ts";

function withEnv(
  env: Record<string, string | undefined>,
  run: () => void | Promise<void>,
): void | Promise<void> {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    const result = run();
    if (result instanceof Promise) return result.finally(restore);
    restore();
  } catch (error) {
    restore();
    throw error;
  }
}

test("server config is null until a relayer is provisioned", () => {
  withEnv(
    { PASSKEY_RELAYER_URL: undefined, PASSKEY_RELAYER_API_KEY: undefined },
    () => {
      assert.equal(getPasskeyServerConfig(), null);
      assert.equal(passkeyRelayerConfigured(), false);
    },
  );
});

test("server config resolves relayer url + key from env", () => {
  withEnv(
    {
      PASSKEY_RELAYER_URL: "https://relayer.example",
      PASSKEY_RELAYER_API_KEY: "secret-key",
    },
    () => {
      const config = getPasskeyServerConfig();
      assert.ok(config);
      assert.equal(config.relayerUrl, "https://relayer.example");
      assert.equal(config.relayerApiKey, "secret-key");
      assert.ok(config.rpcUrl.length > 0);
      assert.equal(passkeyRelayerConfigured(), true);
    },
  );
});

test("isLikelyTransactionXdr accepts realistic base64 and rejects junk", () => {
  const validXdr = "A".repeat(200);
  assert.equal(isLikelyTransactionXdr(validXdr), true);
  assert.equal(isLikelyTransactionXdr(""), false);
  assert.equal(isLikelyTransactionXdr("too-short"), false);
  assert.equal(isLikelyTransactionXdr("!!!!".repeat(40)), false);
  assert.equal(isLikelyTransactionXdr(12345), false);
});

test("submitDeployTransaction normalizes the relayer response", async () => {
  const sender: TxSender = {
    async send(xdr) {
      assert.equal(xdr, "deploy-xdr");
      return { hash: "txhash", transactionId: "rel-1", status: "submitted" };
    },
  };
  const result = await submitDeployTransaction("deploy-xdr", sender);
  assert.deepEqual(result, {
    hash: "txhash",
    transactionId: "rel-1",
    status: "submitted",
  });
});

test("submitDeployTransaction fills missing response fields with null", async () => {
  const sender: TxSender = { async send() { return {}; } };
  const result = await submitDeployTransaction("x", sender);
  assert.deepEqual(result, { hash: null, transactionId: null, status: null });
});
