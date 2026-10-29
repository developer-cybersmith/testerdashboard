import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { COMPANY_DOMAIN, useApp } from '../context/AppContext'
import { hasPendingAzureLogin } from '../lib/api'

export default function LoginPage() {
  const { loginWithAzure } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [azureBusy, setAzureBusy] = useState(() => hasPendingAzureLogin())

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('azure_error')
    if (urlError) {
      setError(urlError)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    const readStoredError = () => {
      const saved = sessionStorage.getItem('cs.azure.error')
      if (saved) {
        sessionStorage.removeItem('cs.azure.error')
        setAzureBusy(false)
        setBusy(false)
        setError(saved)
      }
    }
    readStoredError()
    window.addEventListener('cs-azure-error', readStoredError)
    return () => window.removeEventListener('cs-azure-error', readStoredError)
  }, [])

  const startAzure = async () => {
    setError(null)
    setBusy(true)
    const result = await loginWithAzure()
    if (result) {
      setBusy(false)
      setError(result)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-cs-bg p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6 shadow-card md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cs-forest text-cs-mint">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-cs-ink">Cybersmith Secure</h1>
            <p className="text-[13px] text-cs-muted">
              {azureBusy ? 'Signing you in…' : `Company SSO (@${COMPANY_DOMAIN})`}
            </p>
          </div>
        </div>

        <p className="mb-5 text-[13px] leading-relaxed text-cs-muted">
          Sign in with your <span className="font-semibold text-cs-ink">@{COMPANY_DOMAIN}</span> Microsoft
          account. New accounts created by HR will set a password once and then open the daily workspace.
        </p>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void startAzure()}
          disabled={busy || azureBusy}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-cs-forest px-4 py-3.5 text-[14px] font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          {busy || azureBusy ? 'Signing in with Microsoft…' : 'Sign in with Microsoft (authvr5)'}
        </button>
      </div>
    </div>
  )
}
