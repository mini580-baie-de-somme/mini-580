-- Web auto-connect links (admin-generated magic URL + OTP fallback, 5 min TTL)

CREATE TABLE "WebConnectLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpChallengeId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebConnectLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebConnectLink_token_key" ON "WebConnectLink"("token");
CREATE UNIQUE INDEX "WebConnectLink_otpChallengeId_key" ON "WebConnectLink"("otpChallengeId");
CREATE INDEX "WebConnectLink_expiresAt_idx" ON "WebConnectLink"("expiresAt");
CREATE INDEX "WebConnectLink_userId_idx" ON "WebConnectLink"("userId");

ALTER TABLE "WebConnectLink" ADD CONSTRAINT "WebConnectLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebConnectLink" ADD CONSTRAINT "WebConnectLink_otpChallengeId_fkey" FOREIGN KEY ("otpChallengeId") REFERENCES "AuthOtpChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
