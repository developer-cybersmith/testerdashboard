import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { COMPANY_DOMAIN, useApp } from '../context/AppContext'
import { Field, PrimaryButton, inputClass } from '../components/ui'

export default function LoginPage() {
  const { loginWithEmail, requestPasswordReset } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setNotice(null)
    setBusy(true)
    const result = await loginWithEmail(email, password)
    setBusy(false)
    setError(result)
  }

  const forgot = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    const result = await requestPasswordReset(email)
    setBusy(false)
    if (result) {
      setError(result)
      return
    }
    setNotice('If that company email is registered, a reset link has been sent.')
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
          <button
            type="button"
            className="block text-left text-[13px] font-semibold text-cs-forest"
            onClick={() => void forgot()}
            disabled={busy}
          >
            Forget password?
          </button>
          {notice && (
            <p className="rounded-xl bg-[#edf7f1] px-3 py-2 text-[13px] font-medium text-cs-forest">{notice}</p>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
          )}
          <PrimaryButton type="submit" className="w-full" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}
