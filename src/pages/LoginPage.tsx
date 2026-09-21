import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  COMPANY_DOMAIN,
  DEMO_PASSWORD,
  roleLabel,
  useApp,
} from '../context/AppContext'
import { Field, PrimaryButton, inputClass } from '../components/ui'

export default function LoginPage() {
  const { loginWithEmail, people } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = loginWithEmail(email, password)
    setError(result)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-cs-bg p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-card lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-6 md:p-10">
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

          <form className="max-w-md space-y-4" onSubmit={submit}>
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
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                {error}
              </p>
            )}
            <PrimaryButton type="submit" className="w-full">
              Sign in
            </PrimaryButton>
            <p className="text-[12px] leading-relaxed text-cs-muted">
              New employees cannot self-register. HR creates accounts using
              a company-domain email only. After five failed sign-ins, login is paused for two minutes.
            </p>
          </form>
        </div>

        <div className="wave-card relative m-0 flex flex-col justify-between p-6 text-white md:p-8 lg:m-3 lg:rounded-[22px]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-cs-mint">
              Demo accounts
            </p>
            <h2 className="mt-2 text-[22px] font-bold">Use a seeded login</h2>
            <p className="mt-2 text-[13px] text-white/75">
              Password for every demo account: <span className="font-semibold text-white">{DEMO_PASSWORD}</span>
            </p>
          </div>
          <div className="mt-6 space-y-2">
            {people
              .filter((person) => person.lifecycleStatus !== 'exited' && person.status !== 'inactive')
              .map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  setEmail(person.email)
                  setPassword(DEMO_PASSWORD)
                  setError(null)
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5 text-left transition-colors hover:bg-white/20"
              >
                <img src={person.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{person.name}</p>
                  <p className="truncate text-[11px] text-white/70">
                    {person.role === 'user'
                      ? person.jobTitle || person.email
                      : `${roleLabel(person.role)} · ${person.email}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
