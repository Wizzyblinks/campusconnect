import { useEffect, useState } from "react";
import { LogIn, UserPlus, School, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "./services/api.js";
import campusConnectLogo from "./assets/cclogo.jpeg";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  institution: "",
  campus: "",
};

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [view, setView] = useState("login");
  const [form, setForm] = useState(defaultForm);
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifiedResetOtp, setVerifiedResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (mode !== "register") return;

    let cancelled = false;

    async function fetchInstitutions() {
      setLoadingInstitutions(true);
      setError("");

      try {
        const data = await apiRequest("/api/institutions", { method: "GET" });

        if (!cancelled) {
          setInstitutions(data.institutions || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Could not load institutions: ${err.message}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingInstitutions(false);
        }
      }
    }

    fetchInstitutions();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;

    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const selectedInstitution = institutions.find(
    (institution) => institution._id === form.institution,
  );

  const campuses = selectedInstitution?.campuses || [];

  function resetToLogin() {
    setMode("login");
    setView("login");
    setError("");
    setOtpCode("");
    setVerifiedResetOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setVerificationEmail("");
    setResetEmail("");
    setForm((previous) => ({
      ...previous,
      password: "",
      name: "",
    }));
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "institution" ? { campus: "" } : {}),
    }));
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      if (!data.token || !data.user || typeof data.user !== "object") {
        throw new Error("The server did not return a valid sign-in session.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (typeof onLogin === "function") {
        onLogin(data.user);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          institution: form.institution,
          campus: form.campus,
        }),
      });

      setVerificationEmail(data.user?.email || form.email.trim());
      setView("verifySignup");
      setMode("register");
      setOtpCode("");
      setResendSeconds(60);
      setForm((previous) => ({
        ...previous,
        password: "",
      }));
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(type = "signup") {
    setError("");
    setLoading(true);

    try {
      const endpoint =
        type === "signup"
          ? "/api/auth/verify-signup-otp"
          : "/api/auth/verify-password-reset-otp";

      const email = type === "signup" ? verificationEmail : resetEmail;
      const payload = { email, otp: otpCode };

      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (type === "signup") {
        setView("login");
        setMode("login");
        setForm((previous) => ({
          ...previous,
          email: verificationEmail,
          password: "",
        }));
        setError("");
        setOtpCode("");
        setVerificationEmail("");
      } else {
        setVerifiedResetOtp(otpCode);
        setView("resetPassword");
      }
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp(type = "signup") {
    setError("");
    setLoading(true);

    try {
      const endpoint =
        type === "signup"
          ? "/api/auth/resend-signup-otp"
          : "/api/auth/resend-password-reset-otp";

      const email = type === "signup" ? verificationEmail : resetEmail;

      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setResendSeconds(60);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to resend the code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiRequest("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: form.email.trim() }),
      });

      setResetEmail(form.email.trim());
      setView("verifyReset");
      setOtpCode("");
      setResendSeconds(60);
    } catch (err) {
      setError(err.message || "Could not request the reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: resetEmail,
          otp: verifiedResetOtp || otpCode,
          password: newPassword,
          confirmPassword,
        }),
      });

      setView("login");
      setMode("login");
      setForm((previous) => ({
        ...previous,
        email: resetEmail,
        password: "",
      }));
      setResetEmail("");
      setOtpCode("");
      setVerifiedResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    } catch (err) {
      setError(err.message || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  const renderFormHeader = () => (
    <div className="mb-6 text-center">
      <img
        src={campusConnectLogo}
        alt="Campus Connect logo"
        className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-white object-contain"
      />

      <h1 className="text-2xl font-extrabold text-blue-700">
        Campus<span className="text-slate-900">Connect</span>
      </h1>

      <p className="mt-2 text-sm text-slate-500">
        Connect, learn, and grow with students across Nigeria.
      </p>
    </div>
  );

  const renderAuthTabs = () => (
    <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => {
          setMode("login");
          setView("login");
          setError("");
        }}
        className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${
          mode === "login" && view === "login"
            ? "bg-white text-blue-700 shadow-sm"
            : "text-slate-500"
        }`}
      >
        <LogIn size={17} />
        Login
      </button>

      <button
        type="button"
        onClick={() => {
          setMode("register");
          setView("register");
          setError("");
        }}
        className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${
          mode === "register" && view === "register"
            ? "bg-white text-blue-700 shadow-sm"
            : "text-slate-500"
        }`}
      >
        <UserPlus size={17} />
        Register
      </button>
    </div>
  );

  if (view === "verifySignup") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          {renderFormHeader()}

          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                setView("register");
                setError("");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          </div>

          <h2 className="mb-1 text-xl font-bold text-slate-900">
            Verify your email
          </h2>

          <p className="mb-6 text-sm text-slate-500">
            We sent a six-digit code to {verificationEmail}.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Verification code
              </label>

              <input
                type="text"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm tracking-[0.35em] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleVerifyOtp("signup")}
              disabled={loading || otpCode.length !== 6}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              onClick={() => handleResendOtp("signup")}
              disabled={loading || resendSeconds > 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : "Resend OTP"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "forgotPassword") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          {renderFormHeader()}

          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={resetToLogin}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5"
            >
              <ArrowLeft size={14} />
              Back to login
            </button>
          </div>

          <h2 className="mb-1 text-xl font-bold text-slate-900">
            Reset your password
          </h2>

          <p className="mb-6 text-sm text-slate-500">
            Enter your email to receive a verification code.
          </p>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Email address
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send reset code"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === "verifyReset") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          {renderFormHeader()}

          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setView("forgotPassword")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          </div>

          <h2 className="mb-1 text-xl font-bold text-slate-900">
            Verify reset code
          </h2>

          <p className="mb-6 text-sm text-slate-500">
            Enter the six-digit code sent to {resetEmail}.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Reset code
              </label>

              <input
                type="text"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm tracking-[0.35em] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleVerifyOtp("reset")}
              disabled={loading || otpCode.length !== 6}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              onClick={() => handleResendOtp("reset")}
              disabled={loading || resendSeconds > 0}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : "Resend OTP"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "resetPassword") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          {renderFormHeader()}

          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setView("verifyReset")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          </div>

          <h2 className="mb-1 text-xl font-bold text-slate-900">
            Create new password
          </h2>

          <p className="mb-6 text-sm text-slate-500">
            Choose a strong password for {resetEmail}.
          </p>

          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                New password
              </label>

              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter your new password"
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Confirm password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        {renderFormHeader()}
        {renderAuthTabs()}

        <h2 className="mb-1 text-xl font-bold text-slate-900">
          {mode === "login" ? "Welcome back!" : "Create your account"}
        </h2>

        <p className="mb-6 text-sm text-slate-500">
          {mode === "login"
            ? "Log in to continue to your campus community."
            : "Join students connecting across Nigerian campuses."}
        </p>

        {mode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Email address
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Password
              </label>

              <div className="relative">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  minLength={6}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((visible) => !visible)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  aria-pressed={showLoginPassword}
                  className="absolute inset-y-0 right-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="text-right text-sm">
              <button
                type="button"
                onClick={() => {
                  setView("forgotPassword");
                  setError("");
                }}
                className="font-semibold text-blue-700 hover:text-blue-800"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Please wait..." : "Login to Campus Connect"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Full name
              </label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                autoComplete="name"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Institution
              </label>

              <div className="relative">
                <School
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  name="institution"
                  value={form.institution}
                  onChange={handleChange}
                  required
                  disabled={loadingInstitutions}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  <option value="">
                    {loadingInstitutions
                      ? "Loading institutions..."
                      : "Choose your institution"}
                  </option>

                  {institutions.map((institution) => (
                    <option key={institution._id} value={institution._id}>
                      {institution.name}
                      {institution.state ? ` — ${institution.state}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Campus
              </label>

              <select
                name="campus"
                value={form.campus}
                onChange={handleChange}
                required
                disabled={!form.institution || campuses.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">
                  {!form.institution
                    ? "Choose an institution first"
                    : campuses.length === 0
                      ? "No campuses available"
                      : "Choose your campus"}
                </option>

                {campuses.map((campus) => (
                  <option key={campus._id} value={campus._id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Email address
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Password
              </label>

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="new-password"
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.institution || !form.campus}
              className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Please wait..." : "Create Account"}
            </button>
          </form>
        )}

        {mode === "register" && (
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Can't find your institution or campus? Contact Campus Connect
            support to request that it be added.
          </p>
        )}
      </div>
    </div>
  );
}

export default Auth;
