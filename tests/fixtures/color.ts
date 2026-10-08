/**
 * Color science for the palette tests, independent of the code under test:
 * color vision deficiency simulation (Machado, Oliveira and Fernandes 2009,
 * severity 1.0), CIEDE2000 distance, and the 256-color code a terminal
 * without truecolor receives (the cube and grey ramp mapping chalk uses).
 */

export type Rgb = readonly [number, number, number]
export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan'

const MACHADO: Record<Exclude<Vision, 'normal'>, readonly (readonly number[])[]> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}

export const rgbOf = (hex: string): Rgb => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16)) as unknown as Rgb

const toLinear = (channel: number) => {
  const c = channel / 255

  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const toSrgb = (linear: number) => {
  const c = Math.min(1, Math.max(0, linear))

  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
}

/** The color as a person with the given vision sees it. */
export function seenBy(color: Rgb, vision: Vision): Rgb {
  if (vision === 'normal') {
    return color
  }
  const linear = color.map(toLinear)
  const m = MACHADO[vision]

  return m.map(row => toSrgb(row[0]! * linear[0]! + row[1]! * linear[1]! + row[2]! * linear[2]!)) as unknown as Rgb
}

function lab(color: Rgb): [number, number, number] {
  const [r, g, b] = color.map(toLinear) as [number, number, number]
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

const rad = (degrees: number) => (degrees * Math.PI) / 180
const deg = (radians: number) => (radians * 180) / Math.PI

/** CIEDE2000 color difference: about 2 is the smallest a person notices side by side. */
export function ciede2000(one: Rgb, other: Rgb): number {
  const [l1, a1, b1] = lab(one)
  const [l2, a2, b2] = lab(other)
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)))
  const a1p = a1 * (1 + g)
  const a2p = a2 * (1 + g)
  const c1p = Math.hypot(a1p, b1)
  const c2p = Math.hypot(a2p, b2)
  const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360
  const h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360
  const dL = l2 - l1
  const dC = c2p - c1p
  let dh = h2p - h1p
  if (c1p * c2p === 0) {
    dh = 0
  } else if (dh > 180) {
    dh -= 360
  } else if (dh < -180) {
    dh += 360
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dh / 2))
  const lBar = (l1 + l2) / 2
  const cBarP = (c1p + c2p) / 2
  let hBar = h1p + h2p
  if (c1p * c2p !== 0) {
    hBar = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
  }
  const t = 1 - 0.17 * Math.cos(rad(hBar - 30)) + 0.24 * Math.cos(rad(2 * hBar)) + 0.32 * Math.cos(rad(3 * hBar + 6)) - 0.2 * Math.cos(rad(4 * hBar - 63))
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7))
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sc = 1 + 0.045 * cBarP
  const sh = 1 + 0.015 * cBarP * t
  const rt = -Math.sin(rad(2 * dTheta)) * rc

  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh))
}

/** The 256-color code a truecolor value is reduced to: the grey ramp for greys, else the 6x6x6 cube. */
export function ansi256(color: Rgb): number {
  const [r, g, b] = color
  if (r === g && g === b) {
    if (r < 8) {
      return 16
    }

    return r > 248 ? 231 : Math.round(((r - 8) / 247) * 24) + 232
  }

  return 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5)
}

/** The smallest CIEDE2000 distance between any two of the colors, as seen with the given vision, and the pair. */
export function closestPair(colors: Readonly<Record<string, string>>, vision: Vision): { distance: number; pair: string } {
  const entries = Object.entries(colors).map(([name, hex]) => [name, seenBy(rgbOf(hex), vision)] as const)
  let closest = { distance: Number.POSITIVE_INFINITY, pair: '' }
  entries.forEach(([name, color], at) => {
    for (const [otherName, other] of entries.slice(at + 1)) {
      const distance = ciede2000(color, other)
      if (distance < closest.distance) {
        closest = { distance, pair: `${name}-${otherName}` }
      }
    }
  })

  return closest
}
