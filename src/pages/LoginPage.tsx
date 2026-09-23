import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { COMPANY_DOMAIN, useApp } from '../context/AppContext'
import { Field, PrimaryButton, inputClass } from '../components/ui'

export default function LoginPage() {
  const { loginWithEmail, sendPhoneOtp, loginWithPhoneOtp, resetPasswordWithPhoneOtp } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [otpMode, setOtpMode] = useState<'login' | 'reset' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setNotice(null)
    const result = await loginWithEmail(email, password)
    setError(result)
  }

  const sendOtp = async (mode: 'login' | 'reset') => {
    setError(null)
    setNotice(null)
    if (!phone.trim()) {
      setError('Enter the mobile number on your employee record')
      return
    }
    setBusy(true)
    const result = await sendPhoneOtp(phone)
    setBusy(false)
    if (result) {
      setError(result)
      return
    }
    setOtpMode(mode)
    setNotice(
      mode === 'reset'
        ? 'An OTP has been sent to this mobile number. Enter it and choose a new password.'
        : 'An OTP has been sent to this mobile number.',
    )
  }

  const verifyLogin = async () => {
    setError(null)
    setBusy(true)
    const result = await loginWithPhoneOtp(phone, otp)
    setBusy(false)
    setError(result)
  }

  const verifyReset = async () => {
    setError(null)
    setBusy(true)
    const result = await resetPasswordWithPhoneOtp(phone, otp, nextPassword)
    setBusy(false)
    setError(result)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-cs-bg p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6 shadow-card md:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cs-forest text-cs-mint">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-cs-ink">
              Cybersmith Secure
            </h1>
            <p className="text-[13px] text-cs-muted">Employee login</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <Field label={`Company email (@${COMPANY_DOMAIN})`}>
            <input
              className={inputClass}
              type="email"
              autoComplete="username"
              placeholder={`name@${COMPANY_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Mobile number">
            <input
              className={inputClass}
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="block text-left text-[13px] font-semibold text-cs-forest"
            onClick={() => void sendOtp('reset')}
            disabled={busy}
          >
            Forget password?
          </button>
          <button
            type="button"
            className="text-[13px] font-semibold text-cs-forest"
            onClick={() => void sendOtp('login')}
            disabled={busy}
          >
            Send OTP to sign in
          </button>
          {otpMode && (
            <Field label="OTP">
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </Field>
          )}
          {otpMode === 'reset' && (
            <Field label="New password">
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={nextPassword}
                onChange={(e) => setNextPassword(e.target.value)}
              />
            </Field>
          )}
          {notice && (
            <p className="rounded-xl bg-[#edf7f1] px-3 py-2 text-[13px] font-medium text-cs-forest">{notice}</p>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
              {error}
            </p>
          )}
          {otpMode === 'login' && (
            <PrimaryButton type="button" className="w-full" onClick={() => void verifyLogin()} disabled={busy}>
              Sign in with OTP
            </PrimaryButton>
          )}
          {otpMode === 'reset' && (
            <PrimaryButton type="button" className="w-full" onClick={() => void verifyReset()} disabled={busy}>
              Save new password
            </PrimaryButton>
          )}
          <PrimaryButton type="submit" className="w-full">
            Sign in
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}
