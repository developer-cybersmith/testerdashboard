import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { COMPANY_DOMAIN, useApp } from '../context/AppContext'
import { Field, PrimaryButton, inputClass } from '../components/ui'

type Challenge = { challengeId: string; phoneHint: string }

export default function LoginPage() {
  const { beginLogin, completeLoginOtp, beginPasswordReset, completePasswordReset } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [step, setStep] = useState<'credentials' | 'otp' | 'reset'>('credentials')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const result = await beginLogin(email, password)
    setBusy(false)
    if (typeof result === 'string') {
      setError(result)
      return
    }
    setChallenge(result)
    setOtp('')
    setStep('otp')
  }

  const forgot = async () => {
    setError(null)
    if (!email.trim()) {
      setError(`Enter your company email (@${COMPANY_DOMAIN}) first`)
      return
    }
    setBusy(true)
    const result = await beginPasswordReset(email)
    setBusy(false)
    if (typeof result === 'string') {
      setError(result)
      return
    }
    setChallenge(result)
    setOtp('')
    setNextPassword('')
    setStep('reset')
  }

  const verifyLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    setError(null)
    setBusy(true)
    const result = await completeLoginOtp(challenge.challengeId, otp)
    setBusy(false)
    setError(result)
  }

  const verifyReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    setError(null)
    setBusy(true)
    const result = await completePasswordReset(challenge.challengeId, otp, nextPassword)
    setBusy(false)
    setError(result)
  }

  const back = () => {
    setStep('credentials')
    setChallenge(null)
    setOtp('')
    setError(null)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-cs-bg p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6 shadow-card md:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cs-forest text-cs-mint">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-cs-ink">Cybersmith Secure</h1>
            <p className="text-[13px] text-cs-muted">
              {step === 'credentials' ? 'Employee login' : 'Enter the OTP'}
            </p>
          </div>
        </div>

        {step === 'credentials' ? (
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
            <button
              type="button"
              className="block text-left text-[13px] font-semibold text-cs-forest"
              onClick={() => void forgot()}
              disabled={busy}
            >
              Forget password?
            </button>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
            )}
            <PrimaryButton type="submit" className="w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </PrimaryButton>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={step === 'otp' ? verifyLogin : verifyReset}>
            <p className="text-[13px] leading-5 text-cs-muted">
              {step === 'reset'
                ? `A password reset code was sent to the mobile number on this account (${challenge?.phoneHint}).`
                : `A login code was sent to the mobile number on this account (${challenge?.phoneHint}).`}
            </p>
            <Field label="OTP">
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </Field>
            {step === 'reset' && (
              <Field label="New password">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                  required
                />
              </Field>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
            )}
            <PrimaryButton type="submit" className="w-full" disabled={busy}>
              {busy ? 'Checking…' : step === 'reset' ? 'Save new password' : 'Log in'}
            </PrimaryButton>
            <button
              type="button"
              className="block text-[13px] font-semibold text-cs-forest"
              onClick={back}
              disabled={busy}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
