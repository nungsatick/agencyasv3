import crypto from 'crypto'

// ───────────── TOTP (RFC 6238: HMAC-SHA1, 30 s steps, 6 digits) ─────────────

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(s: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export const newTotpSecret = (): string => base32Encode(crypto.randomBytes(20))

export function totpAt(secret: string, timeMs = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30000)))
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const o = h[h.length - 1] & 15
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(code % 1_000_000).padStart(6, '0')
}

/** Accepts the current code and the one before/after it, to tolerate small clock drift. */
export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  return [-1, 0, 1].some((step) => {
    const expected = totpAt(secret, Date.now() + step * 30000)
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))
  })
}

export const otpauthUrl = (secret: string, username: string, issuer = 'สนับสนุนบัญชีข้อมูล'): string =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`

// ───────────── sealed values (AES-256-GCM keyed from PAYLOAD_SECRET) ─────────────

const key = (purpose: string) =>
  crypto
    .createHash('sha256')
    .update(`${process.env.PAYLOAD_SECRET}|${purpose}`)
    .digest()

/** Encrypt a JSON value; optionally make it expire. Used for secrets at rest and short-lived step tokens. */
export function seal(purpose: string, value: unknown, ttlSeconds?: number): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(purpose), iv)
  const body = JSON.stringify({ v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null })
  const enc = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url')
}

export function unseal<T>(purpose: string, sealed: string | null | undefined): T | null {
  if (!sealed) return null
  try {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(purpose), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const body = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'))
    if (body.exp && body.exp < Date.now()) return null
    return body.v as T
  } catch {
    return null
  }
}

// ───────────── one-time links and recovery codes ─────────────

export const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')

export const newLinkToken = (): string => crypto.randomBytes(32).toString('base64url')

export const randomPassword = (): string => crypto.randomBytes(32).toString('base64url')

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export function newRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const bytes = crypto.randomBytes(8)
    const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
    return `${chars.slice(0, 4)}-${chars.slice(4)}`
  })
}

export const normalizeRecoveryCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function checkPassword(password: unknown, username?: string): string | null {
  if (typeof password !== 'string' || password.length < 10) return 'รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร'
  if (username && password.toLowerCase().includes(username.toLowerCase())) return 'รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ข้างใน'
  return null
}
