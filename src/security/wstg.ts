/** OWASP WSTG developer controls — input validation, output safety, URL allowlisting. */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function sanitizeText(input: string, maxLength = 4000) {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeLines(lines: string[], maxItems = 20, maxLength = 400) {
  return lines.map((line) => sanitizeText(line, maxLength)).filter(Boolean).slice(0, maxItems)
}

export function isSafeHttpUrl(raw: string) {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function sanitizeUrl(raw: string) {
  const cleaned = sanitizeText(raw, 500)
  return isSafeHttpUrl(cleaned) ? cleaned : ''
}

export function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function sanitizeImageDataUrl(raw: string, maxBytes = 750_000) {
  const value = raw.trim()
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) return ''
  return sanitizeDataUrl(value, maxBytes)
}

export function sanitizeDataUrl(raw: string, maxBytes: number) {
  const value = raw.trim()
  if (!value.startsWith('data:') || /data:text\/html|javascript:/i.test(value)) return ''
  const b64 = value.split(',')[1] || ''
  const bytes = Math.floor((b64.length * 3) / 4)
  if (!b64 || bytes > maxBytes) return ''
  return value
}

const SAFE_FILE_EXT = ['pdf', 'txt', 'csv', 'xlsx', 'xls', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp']

export function isSafeAttachmentName(name: string) {
  const cleaned = name.replace(/[/\\]/g, '').trim()
  const ext = cleaned.split('.').pop()?.toLowerCase() || ''
  if (!SAFE_FILE_EXT.includes(ext)) return false
  if (/\.(html?|svg|js|exe|bat|cmd|msi|php|sh)$/i.test(cleaned)) return false
  return cleaned.length > 0 && cleaned.length <= 120
}

/** WSTG-ATHN-07: reject weak passwords (length + character classes). */
export function isStrongPassword(raw: string) {
  const value = raw.trim()
  if (value.length < 8 || value.length > 128) return false
  if (/\s/.test(value)) return false
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
}

export const PASSWORD_POLICY =
  'Use 8–128 characters with upper, lower, number, and a symbol. Spaces are not allowed.'

