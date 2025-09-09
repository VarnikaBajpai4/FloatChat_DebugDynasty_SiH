import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { Mail, Lock, User as UserIcon, Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const stop = (e) => e.stopPropagation();

// Basic regex validations
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/; // 3-20 chars, alnum + underscore
const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/; // 8+, upper, lower, number, special

function Field({
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  theme,
  name,
}) {
  const Icon = icon;
  const base =
    theme === "light"
      ? "bg-white/90 border-[#0EA5E9]/30 text-[#0B1220] placeholder:text-[#0B1220]/50 focus:border-[#0EA5E9]"
      : "bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40";
  return (
    <div>
      <div className={`relative`}>
        <div
          className={`pointer-events-none absolute inset-y-0 left-3 flex items-center ${
            theme === "light" ? "text-[#0B1220]/60" : "text-white/60"
          }`}
        >
          <Icon size={18} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={`w-full rounded-md border pl-10 pr-3 py-2 text-sm outline-none transition-colors ${base} ${
            error ? "ring-1 ring-red-400 border-red-400/60" : ""
          }`}
          autoComplete="off"
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

export default function AuthModal({ open, onClose, mode = "login" }) {
  const { theme } = useTheme();
  const isSignup = mode === "signup";

  const { login, signup, error: authError, setError } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState({ username: false, email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Derived errors
  const errors = useMemo(() => {
    const e = {};
    if (isSignup) {
      if (!username) e.username = "Username is required";
      else if (!USERNAME_RE.test(username))
        e.username = "3-20 chars, letters/numbers/underscore";
    }
    if (!email) e.email = "Email is required";
    else if (!EMAIL_RE.test(email.toLowerCase())) e.email = "Enter a valid email";

    if (!password) e.password = "Password is required";
    else if (!PASSWORD_RE.test(password))
      e.password = "8+ chars, include Aa, 0-9 and a special symbol";
    return e;
  }, [email, password, username, isSignup]);

  const showError = (field) => touched[field] && errors[field];
  const isValid = Object.keys(errors).length === 0;

  // Handle ESC + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Reset transient state when mode or open changes
  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setDone(false);
      setTouched({ username: false, email: false, password: false });
      setSubmitError(null);
      setError?.(null);
      return;
    }
    // on open, clear fields but keep what user typed in navbar session if desired
    // For clean UX, we won't auto-clear user input between opens in same session
  }, [open, mode, setError]);

  const title = isSignup ? "Create your account" : "Welcome back";
  const primary = isSignup ? "Sign up" : "Log in";

  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true });
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError(null);
    setError?.(null);
    try {
      // Normalize email to lowercase before processing
      const normalizedEmail = email.toLowerCase();
      if (isSignup) {
        await signup(username, normalizedEmail, password);
      } else {
        await login(normalizedEmail, password);
      }
      onClose?.();
      navigate("/chat", { replace: true });
    } catch (err) {
      const msg = err?.message || authError || "Authentication failed";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const ModalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{}}
          >
            <div
              className={`absolute inset-0 ${
                theme === "light"
                  ? "bg-black/30"
                  : "bg-black/50"
              } backdrop-blur-sm`}
            />
          </motion.div>

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={stop}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`relative w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${
              theme === "light"
                ? "bg-[#E0F2FE] border-[#0EA5E9]/30"
                : "bg-[#0B1220] border-white/20"
            }`}
          >
            {/* Header strip */}
            <div
              className={`h-1 w-full ${
                theme === "light"
                  ? "bg-gradient-to-r from-[#0EA5E9] via-[#22D3EE] to-[#0284C7]"
                  : "bg-gradient-to-r from-[#22D3EE] via-[#0EA5E9] to-[#0284C7]"
              }`}
            />

            <button
              onClick={onClose}
              aria-label="Close"
              className={`absolute right-3 top-3 rounded-md px-2 py-1 text-sm transition-colors ${
                theme === "light"
                  ? "text-[#0B1220]/70 hover:bg-[#0EA5E9]/20"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              ×
            </button>

            {/* Body */}
            <div className="p-6">
              <h3
                className={`text-xl font-semibold mb-1 ${
                  theme === "light" ? "text-[#0B1220]" : "text-white"
                }`}
              >
                {title}
              </h3>

              {!done ? (
                <form className="space-y-3" onSubmit={onSubmit} noValidate>
                  {(submitError || authError) && (
                    <div className="text-sm text-red-400">
                      {submitError || authError}
                    </div>
                  )}
                  {isSignup && (
                    <Field
                      name="username"
                      icon={UserIcon}
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                      error={showError("username")}
                      theme={theme}
                    />
                  )}
                  <Field
                    name="email"
                    icon={Mail}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    error={showError("email")}
                    theme={theme}
                  />
                  <Field
                    name="password"
                    icon={Lock}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    error={showError("password")}
                    theme={theme}
                  />

                  <div className="pt-3 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClose}
                      className={`${
                        theme === "light"
                          ? "text-[#0B1220] hover:bg-[#0EA5E9]/20"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting || !isValid}
                      className={`${
                        theme === "light"
                          ? "bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                          : "bg-[#0EA5E9] hover:bg-[#22D3EE] text-white"
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="animate-spin" size={16} />
                          Processing…
                        </span>
                      ) : (
                        primary
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="py-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-[#22D3EE]" />
                    <p
                      className={`text-sm ${
                        theme === "light" ? "text-[#0B1220]" : "text-white"
                      }`}
                    >
                      Success. Redirecting to chat…
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={onClose}
                      className={`${
                        theme === "light"
                          ? "bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                          : "bg-[#0EA5E9] hover:bg-[#22D3EE] text-white"
                      }`}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render via portal to escape any transformed ancestor (e.g., animated header)
  return open ? createPortal(ModalContent, document.body) : null;
}