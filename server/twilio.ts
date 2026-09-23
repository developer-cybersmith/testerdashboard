function twilioEnv() {
  return {
    accountSid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    authToken: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    messagingServiceSid: (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim(),
  }
}

export function twilioConfigured() {
  const env = twilioEnv()
  return Boolean(env.accountSid && env.authToken && env.messagingServiceSid)
}

export async function sendTwilioSms(to: string, body: string) {
  const env = twilioEnv()
  if (!env.accountSid || !env.authToken || !env.messagingServiceSid) {
    throw new Error(
      'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID before an OTP can be sent.',
    )
  }
  const form = new URLSearchParams({
    To: to,
    MessagingServiceSid: env.messagingServiceSid,
    Body: body,
  })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.accountSid}:${env.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  if (res.ok) return
  const json = (await res.json().catch(() => null)) as { message?: string } | null
  throw new Error(json?.message || 'The SMS provider could not send the OTP.')
}
