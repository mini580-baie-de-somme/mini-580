"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";

type LoginMode = "password" | "otp";

export function LoginForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("login.failed"));
        return;
      }
      router.push("/editeur");
      router.refresh();
    } catch {
      setError(t("login.network"));
    } finally {
      setLoading(false);
    }
  }

  async function onOtpRequest(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "LOGIN" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("login.otpRequestFailed"));
        return;
      }
      setOtpSent(true);
      setInfo(t("login.otpSent"));
    } catch {
      setError(t("login.network"));
    } finally {
      setLoading(false);
    }
  }

  async function onOtpVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, purpose: "LOGIN" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("login.failed"));
        return;
      }
      router.push("/editeur");
      router.refresh();
    } catch {
      setError(t("login.network"));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    setInfo("");
    setOtpSent(false);
    setCode("");
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex rounded-md border border-[#d4dde6] p-1">
        <button
          type="button"
          onClick={() => switchMode("password")}
          className={`flex-1 rounded px-3 py-2 text-sm ${
            mode === "password"
              ? "bg-[#495867] text-white"
              : "text-[#495867] hover:bg-[#f4f7fa]"
          }`}
        >
          {t("login.modePassword")}
        </button>
        <button
          type="button"
          onClick={() => switchMode("otp")}
          className={`flex-1 rounded px-3 py-2 text-sm ${
            mode === "otp"
              ? "bg-[#495867] text-white"
              : "text-[#495867] hover:bg-[#f4f7fa]"
          }`}
        >
          {t("login.modeOtp")}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {info && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{info}</p>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          {t("login.email")}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
        />
      </div>

      {mode === "password" ? (
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              {t("login.password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#495867] py-2.5 text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            {loading ? t("login.loading") : t("login.submit")}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {!otpSent ? (
            <form onSubmit={onOtpRequest}>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-md bg-[#495867] py-2.5 text-white hover:bg-[#3a4654] disabled:opacity-50"
              >
                {loading ? t("login.loading") : t("login.otpRequest")}
              </button>
            </form>
          ) : (
            <form onSubmit={onOtpVerify} className="space-y-4">
              <div>
                <label htmlFor="otp-code" className="mb-1 block text-sm font-medium">
                  {t("login.otpCode")}
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  className="w-full rounded-md border border-[#d4dde6] px-3 py-2 tracking-widest"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 4}
                className="w-full rounded-md bg-[#495867] py-2.5 text-white hover:bg-[#3a4654] disabled:opacity-50"
              >
                {loading ? t("login.loading") : t("login.otpVerify")}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
