import { useEffect, useState } from "react";
import { GraduationCap, LogIn, UserPlus, School } from "lucide-react";
import { apiRequest } from "./services/api.js";

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    institution: "",
    campus: "",
  });

  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "register") return;

    let cancelled = false;

    async function fetchInstitutions() {
      setLoadingInstitutions(true);
      setError("");

      try {
        const data = await apiRequest("/api/institutions", {
          method: "GET",
        });

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

  const selectedInstitution = institutions.find(
    (institution) => institution._id === form.institution,
  );

  const campuses = selectedInstitution?.campuses || [];

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "institution" ? { campus: "" } : {}),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const payload =
        mode === "login"
          ? {
              email: form.email.trim(),
              password: form.password,
            }
          : {
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
              institution: form.institution,
              campus: form.campus,
            };

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (mode === "register") {
        setMode("login");

        setForm((previous) => ({
          ...previous,
          name: "",
          password: "",
        }));

        alert("Registration successful! Please log in.");
        return;
      }

      if (!data.token) {
        throw new Error("The server did not return an authentication token.");
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white">
            <GraduationCap size={32} />
          </div>

          <h1 className="text-2xl font-extrabold text-blue-700">
            Campus<span className="text-slate-900">Connect</span>
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Connect, learn, and grow with students across Nigeria.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${
              mode === "login"
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
              setError("");
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold ${
              mode === "register"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-500"
            }`}
          >
            <UserPlus size={17} />
            Register
          </button>
        </div>

        <h2 className="mb-1 text-xl font-bold text-slate-900">
          {mode === "login" ? "Welcome back!" : "Create your account"}
        </h2>

        <p className="mb-6 text-sm text-slate-500">
          {mode === "login"
            ? "Log in to continue to your campus community."
            : "Join students connecting across Nigerian campuses."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
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

                {!loadingInstitutions && institutions.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    No institutions are available. Please try again later.
                  </p>
                )}
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
            </>
          )}

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
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
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
            disabled={
              loading ||
              (mode === "register" &&
                (loadingInstitutions || !form.institution || !form.campus))
            }
            className="w-full rounded-xl bg-blue-700 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login to Campus Connect"
                : "Create Account"}
          </button>
        </form>

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
