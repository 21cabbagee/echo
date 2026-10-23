#!/usr/bin/env python3
"""Draws Echo's app icon, Android adaptive layers, splash and favicon. No dependencies.

The mark: a terracotta dot (the record button) with two fading rings, an echo.
Run from the project root:  python3 scripts/make-icons.py
"""
import math
import os
import struct
import zlib

BG = (0xF7, 0xF3, 0xEE)
ACCENT = (0xC8, 0x55, 0x3D)
WHITE = (0xFF, 0xFF, 0xFF)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')


def write_png(path, size, pixels):
    """pixels: list of rows of (r, g, b, a) tuples."""
    raw = b''.join(b'\x00' + bytes(c for px in row for c in px) for row in pixels)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def coverage(d_edge):
    """Anti-aliased coverage from signed distance to an edge (positive = inside)."""
    return max(0.0, min(1.0, d_edge + 0.5))


def blend(dst, src, a):
    """Source-over composite of src (rgb, alpha a) onto dst (rgba)."""
    if a <= 0:
        return dst
    da = dst[3] / 255
    oa = a + da * (1 - a)
    if oa == 0:
        return (0, 0, 0, 0)
    rgb = tuple(round((s * a + d * da * (1 - a)) / oa) for s, d in zip(src, dst[:3]))
    return rgb + (round(oa * 255),)


def render(size, scale=1.0, background=BG, mark=ACCENT, dot=WHITE, rings=True):
    c = size / 2
    u = size / 1024 * scale  # design units are for a 1024px canvas
    layers = []
    if rings:
        layers += [('ring', 360 * u, 26 * u, mark, 0.18), ('ring', 268 * u, 30 * u, mark, 0.38)]
    layers += [('disc', 170 * u, 0, mark, 1.0)]
    if dot:
        layers += [('disc', 58 * u, 0, dot, 1.0)]

    bg = background + (255,) if background else (0, 0, 0, 0)
    rows = []
    for y in range(size):
        row = []
        dy = y + 0.5 - c
        for x in range(size):
            dx = x + 0.5 - c
            r = math.hypot(dx, dy)
            px = bg
            for kind, radius, width, color, alpha in layers:
                if kind == 'disc':
                    a = coverage(radius - r)
                else:
                    a = coverage(width / 2 - abs(r - radius))
                if a:
                    px = blend(px, color, a * alpha)
            row.append(px)
        rows.append(row)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        # iOS icon must be opaque.
        ('icon.png', 1024, dict()),
        # Android adaptive icon: keep the mark inside the ~66% safe zone.
        ('android-icon-foreground.png', 1024, dict(scale=0.62, background=None)),
        ('android-icon-background.png', 1024, dict(scale=0, background=BG, rings=False, dot=None)),
        ('android-icon-monochrome.png', 1024, dict(scale=0.62, background=None, mark=WHITE, dot=None)),
        ('splash-icon.png', 1024, dict(scale=0.9, background=None)),
        ('favicon.png', 48, dict()),
    ]
    for name, size, opts in jobs:
        write_png(os.path.join(OUT, name), size, render(size, **opts))
        print('wrote', name)


if __name__ == '__main__':
    main()
