import { useEffect, useRef, useState } from "react";

interface LoginScreenProps {
  isOpen: boolean;
  /** Called when the user successfully "logs in" (dummy — any password works). */
  onLogin?: (name: string) => void;
  /** Optional dismiss handler (e.g. Escape). */
  onCancel?: () => void;
  /** Default account name shown in the Name field. */
  userName?: string;
  /**
   * Real-auth mode. When true the dummy Name/Password path is hidden and only
   * "Sign in with Google" is offered, wired to onGoogleLogin.
   */
  authEnabled?: boolean;
  /** Kicks off the real Google OAuth flow (authEnabled mode). */
  onGoogleLogin?: () => void;
  /** Show an in-progress state (exchanging code / verifying). */
  busy?: boolean;
  /** Error code/message to surface under the button. */
  errorMessage?: string | null;
  /**
   * When true (typically after a sign-in has failed and been retried) an
   * extra "Refresh page" button is offered as a recovery path — a hard reload
   * clears stale service-worker / OAuth state that a plain retry can't.
   */
  showRefresh?: boolean;
  /** Refresh handler; defaults to a full page reload. */
  onRefresh?: () => void;
}

// Human-friendly copy for the auth error codes from useAuthStore.
const ERROR_LABELS: Record<string, string> = {
  not_allowlisted: "This Google account isn't allowed access.",
  account_disabled: "Your account has been disabled. Contact an administrator.",
  verify_failed: "Couldn't verify your account. Please try again.",
  token_exchange_failed: "Sign-in failed. Please try again.",
  invalid_callback: "Sign-in was interrupted. Please try again.",
  no_id_token: "Sign-in failed. Please try again.",
  login_required: "Please sign in to continue.",
};

// Aqua-authentic font stack, forced regardless of the active OS theme so the
// login screen always reads as Mac OS X.
const AQUA_FONT =
  '"LucidaGrande", "Lucida Grande", "AquaKana", "Hiragino Sans", ui-sans-serif, system-ui, -apple-system, sans-serif';

// Horizontal pinstripes over a near-white base — the classic Aqua panel fill.
const PINSTRIPE_BG =
  "repeating-linear-gradient(0deg, transparent 0px, transparent 1.5px, rgba(255,255,255,0.85) 1.5px, rgba(255,255,255,0.85) 4px), linear-gradient(to bottom, #ececec, #ececec)";

const INPUT_SHADOW =
  "inset 0 1px 2px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6)";
const INPUT_FOCUS_SHADOW = `${INPUT_SHADOW}, 0 0 0 3px rgba(48, 103, 218, 0.5)`;

// Google "G" mark, rendered at button-text size.
function GoogleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LoginScreen({
  isOpen,
  onLogin,
  onCancel,
  userName = "Greenroom",
  authEnabled = false,
  onGoogleLogin,
  busy = false,
  errorMessage = null,
  showRefresh = false,
  onRefresh,
}: LoginScreenProps) {
  const [name, setName] = useState(userName);
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<"name" | "password" | null>(
    null
  );
  const [shake, setShake] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Focus the password field when shown; reset state when hidden.
  useEffect(() => {
    if (isOpen) {
      setName(userName);
      const id = window.setTimeout(() => passwordRef.current?.focus(), 250);
      return () => window.clearTimeout(id);
    }
    setPassword("");
    setShake(false);
  }, [isOpen, userName]);

  if (!isOpen) return null;

  const handleLogin = () => {
    // Dummy auth: accept anything, but nudge if the field is empty so the
    // affordance feels real.
    if (password.trim().length === 0) {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
      passwordRef.current?.focus();
      return;
    }
    onLogin?.(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (authEnabled) {
        if (!busy) onGoogleLogin?.();
      } else {
        handleLogin();
      }
    }
    if (e.key === "Escape") onCancel?.();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center select-none"
      style={{
        fontFamily: AQUA_FONT,
        backgroundImage: "url(/wallpapers/photos/aqua/0-aqua-blue.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        WebkitFontSmoothing: "antialiased",
        animation: "aqua-login-fade-in 0.4s ease-out",
      }}
    >
      {/* Soft vignette so the panel pops against the wallpaper */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(115% 100% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.28) 100%)",
        }}
      />

      {/* The login panel — Panther/Tiger style floating pinstriped window */}
      <div
        className="relative w-[400px] max-w-[calc(100%-32px)] overflow-hidden rounded-xl"
        style={{
          background: PINSTRIPE_BG,
          border: "1px solid rgba(0,0,0,0.35)",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)",
          animation: shake
            ? "aqua-login-shake 0.45s"
            : "aqua-login-panel-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header: brand mark + title, like the Apple logo + "Mac OS X" */}
        <div className="flex flex-col items-center gap-1 px-8 pt-7 pb-5">
          <img
            src="/assets/splash/macos.svg"
            alt=""
            className="h-14 w-16 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
          />
          <h1 className="mt-2 text-[24px] font-bold leading-none text-black">
            Greenroom
          </h1>
          <p className="text-[11px] text-neutral-500">
            {authEnabled
              ? "Sign in to continue"
              : "Log in to your Greenroom account"}
          </p>
        </div>

        {/* Form rows with right-aligned labels, Tiger style (dummy mode only) */}
        {!authEnabled && (
        <div className="flex flex-col gap-2.5 px-10 pb-5">
          {(
            [
              {
                key: "name" as const,
                label: "Name:",
                type: "text",
                value: name,
                onChange: setName,
                ref: undefined,
              },
              {
                key: "password" as const,
                label: "Password:",
                type: "password",
                value: password,
                onChange: setPassword,
                ref: passwordRef,
              },
            ]
          ).map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <label
                htmlFor={`aqua-login-${field.key}`}
                className="w-[72px] text-right text-[13px] text-black"
              >
                {field.label}
              </label>
              <input
                id={`aqua-login-${field.key}`}
                ref={field.ref}
                type={field.type}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onFocus={() => setFocusedField(field.key)}
                onBlur={() => setFocusedField(null)}
                autoComplete="off"
                spellCheck={false}
                className="h-[26px] flex-1 rounded-[4px] border-none bg-white px-2 text-[13px] text-black outline-none"
                style={{
                  boxShadow:
                    focusedField === field.key
                      ? INPUT_FOCUS_SHADOW
                      : INPUT_SHADOW,
                  transition: "box-shadow 0.15s ease-out",
                }}
              />
            </div>
          ))}
        </div>
        )}

        {/* Divider */}
        <div
          className="mx-6 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(0,0,0,0.18) 20%, rgba(0,0,0,0.18) 80%, transparent)",
          }}
        />

        {/* Bottom actions: dummy mode = Log In + Google; auth mode = Google only */}
        <div className="flex flex-col items-stretch gap-2.5 px-10 py-4">
          {!authEnabled && (
            <>
              <button
                type="button"
                onClick={handleLogin}
                className="aqua-button primary w-full"
                style={{
                  fontSize: 13,
                  animation:
                    "aqua-login-pulse 1.2s ease-in-out infinite alternate",
                }}
              >
                <span>Log In</span>
              </button>

              {/* "or" separator */}
              <div className="flex items-center gap-2 py-0.5">
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, rgba(0,0,0,0.18))",
                  }}
                />
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  or
                </span>
                <div
                  className="h-px flex-1"
                  style={{
                    background:
                      "linear-gradient(to left, transparent, rgba(0,0,0,0.18))",
                  }}
                />
              </div>
            </>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => (authEnabled ? onGoogleLogin?.() : onLogin?.(name))}
            className={`aqua-button ${
              authEnabled ? "primary" : "secondary"
            } w-full`}
            style={{
              fontSize: 13,
              gap: 8,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "default" : "pointer",
              animation:
                authEnabled && !busy
                  ? "aqua-login-pulse 1.2s ease-in-out infinite alternate"
                  : undefined,
            }}
          >
            <GoogleIcon />
            <span>{busy ? "Signing in…" : "Sign in with Google"}</span>
          </button>

          {errorMessage && (
            <p className="text-center text-[11px] text-red-700">
              {ERROR_LABELS[errorMessage] || "Sign-in failed. Please try again."}
            </p>
          )}

          {/* After a repeated failure, offer a hard refresh — clears stale
              service-worker / OAuth state that a plain retry won't. */}
          {showRefresh && (
            <div className="flex flex-col items-center gap-1.5 pt-0.5">
              <p className="text-center text-[11px] text-neutral-600">
                Refreshing the page usually fixes this — give it a try.
              </p>
              <button
                type="button"
                onClick={() =>
                  onRefresh ? onRefresh() : window.location.reload()
                }
                className="aqua-button secondary w-full"
                style={{ fontSize: 13, cursor: "pointer" }}
              >
                <span>Refresh &amp; Try Again</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyframes: entrance, wrong-password shake, and the signature
          pulsating Aqua default button */}
      <style>{`
        @keyframes aqua-login-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aqua-login-panel-in {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes aqua-login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-7px); }
          80% { transform: translateX(7px); }
        }
        @keyframes aqua-login-pulse {
          from { filter: brightness(1) saturate(1); }
          to { filter: brightness(1.35) saturate(1.25); }
        }
      `}</style>
    </div>
  );
}
