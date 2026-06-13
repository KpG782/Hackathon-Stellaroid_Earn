import assert from "node:assert/strict";
import test from "node:test";
import {
  connectGraduateWallet,
  createGraduateWallet,
  type GraduateWalletKit,
} from "./passkey-wallet.ts";

const CONTRACT = "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3";

/** A fake PasskeyKit: no library, no authenticator, no network. */
function fakeKit(overrides: Partial<GraduateWalletKit> = {}): GraduateWalletKit {
  return {
    async createWallet(app, user) {
      return {
        contractId: CONTRACT,
        keyIdBase64: `key-for-${app}-${user}`,
        signedTx: { toXDR: () => "AAAA-deploy-xdr" },
      };
    },
    async connectWallet() {
      return { contractId: CONTRACT, keyIdBase64: "existing-key" };
    },
    ...overrides,
  };
}

test("createGraduateWallet returns the contract address, key id, and deploy XDR", async () => {
  const wallet = await createGraduateWallet(fakeKit(), {
    appName: "Stellaroid",
    userName: "grad@example.com",
  });
  assert.equal(wallet.contractAddress, CONTRACT);
  assert.equal(wallet.keyIdBase64, "key-for-Stellaroid-grad@example.com");
  assert.equal(wallet.signedTxXdr, "AAAA-deploy-xdr");
});

test("connectGraduateWallet returns the contract address and key id", async () => {
  const wallet = await connectGraduateWallet(fakeKit(), { keyId: "abc" });
  assert.equal(wallet.contractAddress, CONTRACT);
  assert.equal(wallet.keyIdBase64, "existing-key");
});

test("a non-contract address from the kit is rejected (never trusted as recipient)", async () => {
  const badKit = fakeKit({
    async createWallet() {
      return {
        contractId: "GAWIOVGFSPJDEIJJZUSVRFPVP3D5VNO2LGCU47KEHJD6MV277QKNR34D",
        keyIdBase64: "k",
        signedTx: { toXDR: () => "x" },
      };
    },
  });
  await assert.rejects(
    () => createGraduateWallet(badKit, { appName: "a", userName: "u" }),
    /not a valid Soroban contract/,
  );
});
