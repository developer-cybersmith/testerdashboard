import { useState, type FormEvent } from 'react'
import { Camera } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Card, Field, PrimaryButton, inputClass } from './ui'

export default function TesterProfile() {
  const { session, updateOwnProfile } = useApp()
  const person = session?.person
  const [preview, setPreview] = useState(person?.avatar || '')
  const [avatarDataUrl, setAvatarDataUrl] = useState('')
  const [phone, setPhone] = useState(person?.phone || '')
  const [address, setAddress] = useState(person?.address || '')
  const [gender, setGender] = useState(person?.gender || '')
  const [dateOfBirth, setDateOfBirth] = useState(person?.dateOfBirth || '')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  if (!person) return null

  const onFile = (file?: File) => {
    setError(null)
    setOk(null)
    if (!file) return
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setError('Use a JPG, PNG, or WEBP photo')
      return
    }
    if (file.size > 750_000) {
      setError('Photo must be under 750 KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setAvatarDataUrl(result)
      setPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (!person.avatarUploaded && !avatarDataUrl) {
      setError('Profile photo is required')
      return
    }
    const result = updateOwnProfile({
      avatarDataUrl: avatarDataUrl || undefined,
      phone,
      address,
      gender,
      dateOfBirth,
    })
    if (result) {
      setError(result)
      return
    }
    setOk('Profile saved. Admin and Team Leaders can see your photo and details.')
    setAvatarDataUrl('')
  }

  return (
    <Card className="max-w-2xl">
      {!person.avatarUploaded && (
        <p className="mb-4 rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] font-medium text-[#9a3412]">
          Upload a profile photo before using the rest of the workspace. This is mandatory.
        </p>
      )}
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="relative">
            {preview ? (
              <img src={preview} alt="" className="h-28 w-28 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#edf7f1] text-cs-forest">
                <Camera size={28} />
              </div>
            )}
          </div>
          <Field label="Profile photo (required)">
            <input
              className={inputClass}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <p className="text-[12px] text-cs-muted">JPG, PNG, or WEBP. Max 750 KB.</p>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Gender">
            <input className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <input
              className={inputClass}
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={person.email} disabled />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <input
                className={inputClass}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
          </div>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        )}
        {ok && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{ok}</p>
        )}
        <PrimaryButton type="submit">Save profile</PrimaryButton>
      </form>
    </Card>
  )
}
