-- Allow disconnecting web connect link from consumed OTP challenge
ALTER TABLE "WebConnectLink" ALTER COLUMN "otpChallengeId" DROP NOT NULL;
