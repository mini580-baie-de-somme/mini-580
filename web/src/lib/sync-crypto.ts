import "server-only";

import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { randomUUID } from "crypto";

export type SyncEnv = "test" | "prod";

export function getSyncEnv(): SyncEnv {
  const env = (process.env.SYNC_ENV ?? "").toLowerCase();
  if (env === "test" || env === "prod") return env;
  // Infer from peer URL / NODE defaults
  if (process.env.SYNC_PEER_URL?.includes("test.")) return "prod";
  return "test";
}

export function getSyncPeerUrl(): string {
  const url = process.env.SYNC_PEER_URL?.replace(/\/$/, "");
  if (!url) throw new Error("SYNC_PEER_URL is not configured");
  return url;
}

function getPrivateKeyPem(): string {
  const pem = process.env.SYNC_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("SYNC_PRIVATE_KEY is not configured");
  return pem;
}

function getPeerPublicKeyPem(): string {
  const pem = process.env.SYNC_PEER_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("SYNC_PEER_PUBLIC_KEY is not configured");
  return pem;
}

type ImportedKey = Awaited<ReturnType<typeof importPKCS8>>;

let privateKeyCache: ImportedKey | null = null;
let peerPublicKeyCache: ImportedKey | null = null;

async function getPrivateKey(): Promise<ImportedKey> {
  if (!privateKeyCache) {
    privateKeyCache = await importPKCS8(getPrivateKeyPem(), "EdDSA");
  }
  return privateKeyCache;
}

async function getPeerPublicKey(): Promise<ImportedKey> {
  if (!peerPublicKeyCache) {
    peerPublicKeyCache = await importSPKI(getPeerPublicKeyPem(), "EdDSA");
  }
  return peerPublicKeyCache;
}

/** Create a short-lived signed OTP for calling the peer. */
export async function createSyncOtp(action: string): Promise<string> {
  const env = getSyncEnv();
  const peer = env === "test" ? "prod" : "test";
  const key = await getPrivateKey();
  return new SignJWT({
    action,
    nonce: randomUUID(),
  })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(env)
    .setAudience(peer)
    .setIssuedAt()
    .setExpirationTime("90s")
    .sign(key);
}

/** Verify an OTP received from the peer. */
export async function verifySyncOtp(
  token: string,
  expectedAction?: string
): Promise<{ iss: SyncEnv; action: string }> {
  const env = getSyncEnv();
  const key = await getPeerPublicKey();
  const { payload } = await jwtVerify(token, key, {
    audience: env,
    algorithms: ["EdDSA"],
  });

  const iss = payload.iss;
  if (iss !== "test" && iss !== "prod") {
    throw new Error("Invalid OTP issuer");
  }
  if (iss === env) {
    throw new Error("OTP issuer must be the peer");
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  if (expectedAction && action !== expectedAction) {
    throw new Error(`OTP action mismatch: expected ${expectedAction}`);
  }

  return { iss, action };
}

export async function requireSyncAuth(
  request: Request,
  expectedAction: string
): Promise<{ iss: SyncEnv; action: string }> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Missing Bearer OTP");
  return verifySyncOtp(match[1], expectedAction);
}

export async function peerFetch(
  path: string,
  action: string,
  init?: RequestInit
): Promise<Response> {
  const otp = await createSyncOtp(action);
  const url = `${getSyncPeerUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${otp}`,
      "Content-Type": "application/json",
      "X-Sync-Action": action,
    },
  });
}

export function isSyncConfigured(): boolean {
  return Boolean(
    process.env.SYNC_PRIVATE_KEY &&
      process.env.SYNC_PEER_PUBLIC_KEY &&
      process.env.SYNC_PEER_URL
  );
}
