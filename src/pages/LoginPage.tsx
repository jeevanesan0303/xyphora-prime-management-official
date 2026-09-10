
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn(trimmedEmail, password);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your credentials and try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[49%] xl:w-1/2 bg-linear-to-br from-[#14081F] via-[#0B0614] to-[#040205]">
        <div className="flex flex-col justify-between w-full px-8 py-10 h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 -ml-8">
            <div className="w-8 h-8 shrink-0" />

            <h2 className="text-white font-['Playfair_Display',serif] text-[26px] font-medium tracking-wide">
              Xyphora Prime
            </h2>
          </div>

          {/* Hero Content */}
          <div className="flex-1 flex items-center">
            <div className="max-w-125">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                <Sparkles className="h-3 w-3" />
                Company OS
              </p>

              <h1 className="text-white font-['Playfair_Display',serif] text-[52px] leading-[1.08] tracking-tight">
                Precision, quiet
                <br />
                luxury, and clarity —
                <br />
                for the way your
                <br />
                team actually works.
              </h1>

              <p className="mt-6 text-white/60 text-[15px] leading-[1.8] max-w-105 font-['Inter',sans-serif] font-light">
                A single canvas for tasks,
                <br />
                deadlines, and feedback.
                <br />
                No noise. No clutter.
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/30 text-sm font-['Inter',sans-serif]">
            © 2026 Xyphora Prime
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col bg-white px-8 lg:px-12 relative">
        {/* Top spacing */}
        <div className="flex justify-center pt-8" />

        {/* Login Content */}
        <div className="flex-1 flex items-center justify-center -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-110"
          >
            <h1 className="font-['Playfair_Display',serif] text-[44px] leading-[1.1] text-[#191919] font-medium">
              Welcome back
            </h1>

            <p className="mt-2 text-[16px] text-gray-500 font-['Inter',sans-serif]">
              Sign in with the credentials your admin provided.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              {/* Email */}
              <div>
                <label className="block uppercase tracking-[0.2em] text-[11px] font-semibold text-gray-500 mb-2.5 font-['Inter',sans-serif]">
                  EMAIL
                </label>

                <input
                  type="email"
                  value={email}
                  placeholder="you@company.com"
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  className="
                    w-full
                    h-12
                    rounded-lg
                    border
                    border-gray-200
                    px-4
                    text-gray-900
                    text-[15px]
                    outline-none
                    transition
                    focus:border-[#2B0A52]
                    font-['Inter',sans-serif]
                    placeholder:text-gray-400
                    disabled:bg-gray-50
                    disabled:cursor-not-allowed
                  "
                />
              </div>

              {/* Password */}
              <div>
                <label className="block uppercase tracking-[0.2em] text-[11px] font-semibold text-gray-500 mb-2.5 font-['Inter',sans-serif]">
                  PASSWORD
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="********"
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    className="
                      w-full
                      h-12
                      rounded-lg
                      border
                      border-gray-200
                      px-4
                      pr-11
                      text-gray-900
                      text-[15px]
                      outline-none
                      transition
                      focus:border-[#2B0A52]
                      font-['Inter',sans-serif]
                      placeholder:text-gray-400
                      disabled:bg-gray-50
                      disabled:cursor-not-allowed
                    "
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                      hover:text-[#2B0A52]
                      transition
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="
                    rounded-lg
                    bg-red-50
                    border
                    border-red-200
                    px-4
                    py-2.5
                    text-sm
                    text-red-600
                    font-['Inter',sans-serif]
                  "
                >
                  {error}
                </div>
              )}

              {/* Sign In */}
              <button
                type="submit"
                disabled={loading}
                className="
                  w-full
                  h-12
                  rounded-lg
                  bg-[#2B0A52]
                  hover:bg-[#35105F]
                  text-white
                  font-semibold
                  text-[15px]
                  transition
                  font-['Inter',sans-serif]
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {/* Footer Message */}
            <p className="mt-6 text-center text-gray-500 text-[13px] leading-6 font-['Inter',sans-serif]">
              Forgot your password? Contact your admin — Xyphora Prime
              does not offer public sign-up.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
