import { useState, type FormEvent } from 'react'
import { Camera } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PASSWORD_POLICY } from '../security/wstg'
import { Card, Field, PrimaryButton, inputClass } from './ui'

export default function TesterProfile() {
  const { session, updateOwnProfile, changePassword } = useApp()
  const person = session?.person
  const [preview, setPreview] = useState(person?.avatar || '')
  const [avatarDataUrl, setAvatarDataUrl] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoOk, setPhotoOk] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passError, setPassError] = useState<string | null>(null)
  const [passOk, setPassOk] = useState<string | null>(null)

  if (!person) return null

  const onFile = (file?: File) => {
    setPhotoError(null)
    setPhotoOk(null)
    if (!file) return
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setPhotoError('Use a JPG, PNG, or WEBP photo')
      return
    }
    if (file.size > 750_000) {
      setPhotoError('Photo must be under 750 KB')
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

  const savePhoto = (e: FormEvent) => {
    e.preventDefault()
    setPhotoError(null)
    setPhotoOk(null)
    if (!person.avatarUploaded && !avatarDataUrl) {
      setPhotoError('Profile photo is required')
      return
    }
    if (!avatarDataUrl) {
      setPhotoError('Choose a new photo to update')
      return
    }
    const result = updateOwnProfile({ avatarDataUrl })
    if (result) {
      setPhotoError(result)
      return
    }
    setPhotoOk('Profile photo updated.')
    setAvatarDataUrl('')
  }

  const savePassword = (e: FormEvent) => {
    e.preventDefault()
    setPassError(null)
    setPassOk(null)
    if (nextPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match')
      return
    }
    const result = changePassword(currentPassword, nextPassword)
    if (result) {
      setPassError(result)
      return
    }
    setPassOk('Password changed. Use the new password next time you sign in.')
    setCurrentPassword('')
    setNextPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="grid max-w-3xl gap-4">
      {person.mustChangePassword && (
        <p className="rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] font-medium text-[#9a3412]">
          Change the temporary password before using the rest of the workspace.
        </p>
      )}
      {!person.avatarUploaded && (
        <p className="rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] font-medium text-[#9a3412]">
          Upload a profile photo before using the rest of the workspace. This is mandatory.
        </p>
      )}

      <Card>
        <form className="space-y-4" onSubmit={savePhoto}>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div>
              {preview ? (
                <img src={preview} alt="" className="h-28 w-28 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#edf7f1] text-cs-forest">
                  <Camera size={28} />
                </div>
              )}
            </div>
            <Field label="Profile photo">
              <input
                className={inputClass}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <p className="text-[12px] text-cs-muted">JPG, PNG, or WEBP. Max 750 KB.</p>
            </Field>
          </div>
          {photoError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{photoError}</p>
          )}
          {photoOk && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{photoOk}</p>
          )}
          <PrimaryButton type="submit">Update photo</PrimaryButton>
        </form>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {person.role === 'user' && (
            <Field label="Employee ID">
              <input className={inputClass} value={person.employeeCode || '—'} disabled />
            </Field>
          )}
          <Field label="Email">
            <input className={inputClass} value={person.email} disabled />
          </Field>
          <Field label="Location">
            <input className={inputClass} value={person.location || '—'} disabled />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={person.phone || '—'} disabled />
          </Field>
          <Field label="Gender">
            <input className={inputClass} value={person.gender || '—'} disabled />
          </Field>
          <Field label="Date of birth">
            <input className={inputClass} value={person.dateOfBirth || '—'} disabled />
          </Field>
        </div>
        <p className="mt-3 text-[12px] text-cs-muted">
          Only the profile photo and password can be changed here. Ask Admin for any other correction.
        </p>
      </Card>

      <Card>
        <form className="space-y-3" onSubmit={savePassword}>
          <Field label="Current password">
            <input
              className={inputClass}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="New password">
            <input
              className={inputClass}
              type="password"
              minLength={8}
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
              required
            />
          </Field>
          <p className="text-[11px] text-cs-muted">{PASSWORD_POLICY}</p>
          <Field label="Confirm new password">
            <input
              className={inputClass}
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </Field>
          {passError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{passError}</p>
          )}
          {passOk && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{passOk}</p>
          )}
          <PrimaryButton type="submit">Change password</PrimaryButton>
        </form>
      </Card>
    </div>
  )
}
