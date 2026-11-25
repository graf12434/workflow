# Генератор панорами залізного міста для теми "Машинаріум" (власний малюнок, не ассети гри).
# Пише два файли: mach-city.svg (статичне місто, без анімації) і mach-life.svg (дим, вогники,
# дирижабль, шестерні — лише прості фігури без фільтрів, щоб анімація була дешевою).
import math
import random
import sys

OUT = sys.argv[1]
W, H = 1600, 520
rnd = random.Random(42)


def j(v, a=1.1):
    """Тремтіння руки: зсув точки на частку пікселя."""
    return v + rnd.uniform(-a, a)


def poly(points, close=True):
    pts = " L".join(f"{j(x):.1f},{j(y):.1f}" for x, y in points)
    return f"M{pts}{' Z' if close else ''}"


def arc_pts(cx, cy, rx, ry, a0, a1, n=10):
    return [(cx + rx * math.cos(a), cy + ry * math.sin(a))
            for a in (a0 + (a1 - a0) * i / n for i in range(n + 1))]


smoke_spots, light_spots, beacon = [], [], None


def building(x, w, h, base, layer):
    """Повертає список шляхів однієї споруди та точки для "живого" шару."""
    global beacon
    paths = []
    top = base - h
    kind = rnd.choices(["dome", "onion", "spire", "flat", "chimney", "tank", "stack"],
                       weights=[3, 3, 3, 2, 3, 1, 2])[0]
    body = [(x, base), (x, top), (x + w, top), (x + w, base)]

    if kind == "chimney":
        cw = max(10, w * 0.35)
        cx = x + (w - cw) / 2
        ctop = max(top - h * 0.35, base - 300)
        paths.append(poly([(cx, base), (cx + cw * 0.1, ctop), (cx + cw * 0.9, ctop), (cx + cw, base)]))
        paths.append(poly([(cx - 3, ctop), (cx - 3, ctop - 6), (cx + cw + 3, ctop - 6), (cx + cw + 3, ctop)]))
        for b in range(1, 4):  # обручі на трубі
            by = ctop + (base - ctop) * b / 4
            paths.append(poly([(cx - 1, by), (cx + cw + 1, by), (cx + cw + 1, by + 3), (cx - 1, by + 3)]))
        if layer > 0:
            smoke_spots.append((cx + cw / 2, ctop - 8, layer))
        return paths

    if kind == "tank":  # цистерна на опорах
        leg = h * 0.45
        ty = base - leg
        paths.append(poly([(x + 4, base), (x + 8, ty), (x + 10, ty), (x + 6, base)]))
        paths.append(poly([(x + w - 4, base), (x + w - 8, ty), (x + w - 10, ty), (x + w - 6, base)]))
        paths.append(poly([(x + 6, base - leg * 0.4), (x + w - 6, base - leg * 0.6),
                           (x + w - 6, base - leg * 0.6 + 2), (x + 6, base - leg * 0.4 + 2)]))
        tank = arc_pts(x + w / 2, ty - h * 0.25, w / 2, h * 0.28, math.pi, 2 * math.pi, 14) + \
            arc_pts(x + w / 2, ty - h * 0.25, w / 2, h * 0.28, 0, math.pi, 14)
        paths.append(poly(tank))
        return paths

    paths.append(poly(body))

    if kind == "dome":
        paths.append(("roof", poly(arc_pts(x + w / 2, top, w / 2, w * 0.45, math.pi, 2 * math.pi, 14))))
        paths.append(poly([(x + w / 2 - 1.5, top - w * 0.45), (x + w / 2, top - w * 0.45 - 16),
                           (x + w / 2 + 1.5, top - w * 0.45)]))
    elif kind == "onion":
        cx, r = x + w / 2, w * 0.45
        hh = r * 2.2
        left, right = [], []
        for i in range(19):
            t = i / 18
            half = r * (0.55 + 0.9 * math.sin(math.pi * t * 1.1)) * (1 - t) ** 1.2
            left.append((cx - half, top - t * hh))
            right.append((cx + half, top - t * hh))
        apex = top - hh
        paths.append(("roof", poly(left + right[::-1])))
        paths.append(poly([(cx - 1, apex + 1), (cx, apex - 14), (cx + 1, apex + 1)]))
    elif kind == "spire":
        sh = h * rnd.uniform(0.35, 0.6)
        paths.append(("roof", poly([(x - 2, top), (x + w / 2, top - sh), (x + w + 2, top)])))
        tip = (x + w / 2, top - sh)
        if 260 < tip[0] < W - 260 and layer == 1 and (beacon is None or tip[1] < beacon[1]):
            beacon = (tip[0], tip[1] - 2, layer)
    elif kind == "stack":  # ярусна вежа
        for t in range(1, rnd.randint(2, 3) + 1):
            sw = w * (1 - 0.22 * t)
            sx = x + (w - sw) / 2
            sy = top - h * 0.18 * t
            paths.append(poly([(sx, sy + h * 0.18), (sx, sy), (sx + sw, sy), (sx + sw, sy + h * 0.18)]))
        paths.append(poly([(x + w / 2 - 1, top - h * 0.54), (x + w / 2, top - h * 0.54 - 22),
                           (x + w / 2 + 1, top - h * 0.54)]))
    else:  # плаский дах з антеною й балконом
        paths.append(poly([(x - 4, top), (x - 4, top - 4), (x + w + 4, top - 4), (x + w + 4, top)]))
        ax = x + w * rnd.uniform(0.25, 0.75)
        paths.append(poly([(ax - 1, top - 4), (ax - 1, top - 30), (ax + 1, top - 30), (ax + 1, top - 4)]))
        paths.append(poly([(ax - 8, top - 26), (ax + 8, top - 26), (ax + 8, top - 24), (ax - 8, top - 24)]))

    # вікна — темні щілини; деякі з них світитимуться в "живому" шарі
    if layer > 0 and w > 22:
        cols = max(1, int(w // 14))
        rows = max(1, int(h // 26))
        for r in range(rows):
            for c in range(cols):
                if rnd.random() < 0.45:
                    wx = x + (c + 0.5) * w / cols - 2.5
                    wy = top + 10 + r * 26
                    if wy > base - 14:
                        continue
                    paths.append(("win", wx, wy))
                    if rnd.random() < 0.18:
                        light_spots.append((wx + 2.5, wy + 4, layer))
    return paths


LAYERS = [  # (колір заливки, колір контуру, мін/макс висота, крок, база, прозорість)
    ("#aeb1a6", "#9a9d92", 180, 340, (28, 70), 520, 0.8),    # далекий план — сизий серпанок
    ("#a59479", "#86755a", 110, 260, (30, 80), 520, 0.92),   # середній
    ("#8c7656", "#5e4a32", 60, 170, (34, 90), 520, 1.0),     # ближній
]
ROOFS = ["#a3a89f", "#9a7350", "#93512c"]   # дахи: сизий, мідний, іржавий

out_layers = []
for li, (fill, stroke, hmin, hmax, (wmin, wmax), base, op) in enumerate(LAYERS):
    shapes, windows, roofs = [], [], []
    x = -40 + li * 17
    while x < W + 40:
        w = rnd.uniform(wmin, wmax)
        # вищі споруди — ближче до країв, щоб центр (де таблиці) був спокійнішим
        edge = abs(x + w / 2 - W / 2) / (W / 2)
        h = rnd.uniform(hmin, hmax) * (0.55 + 0.6 * edge)
        for p in building(x, w, h, base, li):
            if isinstance(p, tuple) and p[0] == "roof":
                roofs.append(p[1])
            elif isinstance(p, tuple):
                windows.append(p)
            else:
                shapes.append(p)
        x += w + rnd.uniform(-6, 22)
    # труби між будівлями на середньому плані
    if li == 1:
        for _ in range(5):
            px = rnd.uniform(60, W - 300)
            py = rnd.uniform(base - 120, base - 50)
            pl = rnd.uniform(120, 260)
            shapes.append(poly([(px, py), (px + pl, py), (px + pl, py + 7), (px, py + 7)]))
            for k in range(0, int(pl), 40):  # фланці
                shapes.append(poly([(px + k, py - 2), (px + k + 4, py - 2), (px + k + 4, py + 9), (px + k, py + 9)]))
    win_fill = "#6f6650" if li == 0 else ("#6a5a42" if li == 1 else "#4e3f2b")
    win = "".join(f'<rect x="{wx:.1f}" y="{wy:.1f}" width="5" height="8" rx="1"/>' for _, wx, wy in windows)
    out_layers.append(
        f'<g opacity="{op}"><path d="{" ".join(shapes)}" fill="{fill}" stroke="{stroke}" '
        f'stroke-width="1.3" stroke-linejoin="round"/>'
        f'<path d="{" ".join(roofs)}" fill="{ROOFS[li]}" stroke="{stroke}" stroke-width="1.3" stroke-linejoin="round"/>'
        f'<g fill="{win_fill}">{win}</g></g>'
    )

# серпанок між планами — пласкі напівпрозорі смуги кольору стіни
haze = '<rect y="300" width="1600" height="220" fill="#c2ae88" opacity="0.18"/>'
def pipeline():
    y = 488
    parts = [poly([(0, y), (W, y), (W, y + 12), (0, y + 12)])]
    for k in range(20, W, 90):  # фланці з болтами
        parts.append(poly([(k, y - 4), (k + 8, y - 4), (k + 8, y + 16), (k, y + 16)]))
    for vx in (420, 880, 1260):  # вентилі: колесо на стрижні
        parts.append(poly([(vx - 2, y), (vx - 2, y - 22), (vx + 2, y - 22), (vx + 2, y)]))
    ground = poly([(0, 506), (W, 506), (W, 520), (0, 520)])
    wheels = "".join(f'<circle cx="{vx}" cy="{y - 26}" r="10" fill="none" stroke="#3a2c1e" stroke-width="3"/>'
                     f'<path d="M{vx - 10},{y - 26} L{vx + 10},{y - 26} M{vx},{y - 36} L{vx},{y - 16}" stroke="#3a2c1e" stroke-width="2"/>'
                     for vx in (420, 880, 1260))
    return (f'<path d="{ground}" fill="#5e4a32"/>'
            f'<path d="{" ".join(parts)}" fill="#7a5a3a" stroke="#3a2c1e" stroke-width="1.5"/>{wheels}')


city = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">'
    f'{out_layers[0]}{haze}{out_layers[1]}{haze}{out_layers[2]}'
    f'{pipeline()}</svg>'
)
open(f"{OUT}/mach-city.svg", "w", encoding="utf-8").write(city + "\n")


# ---------- Живий шар ----------
def gear(cx, cy, r, teeth, hole):
    pts = []
    for i in range(teeth * 4):
        a = 2 * math.pi * i / (teeth * 4)
        rr = r if i % 4 in (1, 2) else r * 0.84
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
    d += f" M{cx + hole},{cy} a{hole},{hole} 0 1,0 {-2 * hole},0 a{hole},{hole} 0 1,0 {2 * hole},0 Z"
    spokes = "".join(
        f'<path d="M{cx},{cy} L{cx + r * 0.7 * math.cos(a):.1f},{cy + r * 0.7 * math.sin(a):.1f}" '
        f'stroke="#3a2c1e" stroke-width="{r * 0.09:.1f}" stroke-linecap="round"/>'
        for a in (k * math.pi / 3 for k in range(6)))
    return d, spokes


smokes = []
for i, (sx, sy, li) in enumerate(smoke_spots[:7]):
    for k in range(3):
        dur = rnd.uniform(7, 10)
        smokes.append(
            f'<circle class="puff" cx="{sx:.0f}" cy="{sy:.0f}" r="{6 + li * 2}" '
            f'style="animation-duration:{dur:.1f}s;animation-delay:{-k * dur / 3:.1f}s"/>')

lights = "".join(
    f'<rect class="lamp" x="{lx - 2.5:.1f}" y="{ly - 4:.1f}" width="5" height="8" rx="1" '
    f'style="animation-duration:{rnd.uniform(4, 11):.1f}s;animation-delay:{-rnd.uniform(0, 8):.1f}s"/>'
    for lx, ly, li in light_spots[:22])

bx, by, _ = beacon
g1, s1 = gear(70, 520, 92, 14, 18)
g2, s2 = gear(196, 470, 46, 9, 9)
g3, s3 = gear(1530, 525, 110, 16, 22)

airship = (
    '<g class="airship"><g transform="translate(0,96)">'
    '<path d="M0,0 C10,-22 120,-24 150,-6 C162,0 162,6 150,12 C120,30 10,28 0,6 Z" fill="#9c8a6a" stroke="#5e4a32" stroke-width="2"/>'
    '<path d="M18,-12 C60,-20 110,-18 140,-6 M14,16 C60,24 110,22 140,12" fill="none" stroke="#7e6c4e" stroke-width="1.5"/>'
    '<path d="M-2,3 L-22,-12 L-18,3 L-22,18 Z" fill="#8a7756" stroke="#5e4a32" stroke-width="1.5"/>'
    '<path d="M55,22 L60,34 L100,34 L104,22" fill="#7e6c4e" stroke="#5e4a32" stroke-width="1.5"/>'
    '<rect x="66" y="26" width="6" height="5" fill="#f3d27a"/><rect x="80" y="26" width="6" height="5" fill="#f3d27a"/>'
    '<g class="prop" transform="translate(-24,3)"><path d="M0,-9 L0,9" stroke="#5e4a32" stroke-width="3" stroke-linecap="round"/></g>'
    '</g></g>')

life = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">
<style>
.puff{{fill:#d8ccb2;opacity:0;transform-box:fill-box;transform-origin:center;animation:puff 8s linear infinite}}
@keyframes puff{{0%{{opacity:0;transform:translate(0,0) scale(.6)}}15%{{opacity:.75}}100%{{opacity:0;transform:translate(26px,-90px) scale(2.6)}}}}
.lamp{{fill:#ffd36a;animation:lamp 7s steps(1) infinite}}
@keyframes lamp{{0%,100%{{opacity:.95}}40%{{opacity:.1}}55%{{opacity:.95}}80%{{opacity:.1}}}}
.beacon{{fill:#e2552b;animation:beacon 2.2s ease-in-out infinite}}
@keyframes beacon{{0%,100%{{opacity:.15}}20%,35%{{opacity:1}}}}
.airship{{animation:fly 150s linear infinite}}
@keyframes fly{{from{{transform:translateX(-220px)}}to{{transform:translateX(1820px)}}}}
.prop{{animation:spin .6s linear infinite}}
.cog{{transform-box:fill-box;transform-origin:center;animation:spin 40s linear infinite}}
.cog.rev{{animation-direction:reverse;animation-duration:20s}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
.prop{{transform-box:fill-box;transform-origin:center}}
@media (prefers-reduced-motion:reduce){{*{{animation:none!important}}.puff{{opacity:.4}}.beacon{{opacity:1}}}}
</style>
{airship}
<g>{"".join(smokes)}</g>
<g>{lights}</g>
<circle class="beacon" cx="{bx:.1f}" cy="{by:.1f}" r="4"/>
<g fill="#5e4a32" stroke="#2f2216" stroke-width="2">
<g class="cog"><path d="{g1}" fill-rule="evenodd"/>{s1}</g>
<g class="cog rev"><path d="{g2}" fill-rule="evenodd"/>{s2}</g>
<g class="cog"><path d="{g3}" fill-rule="evenodd"/>{s3}</g>
</g>
</svg>
'''
open(f"{OUT}/mach-life.svg", "w", encoding="utf-8").write(life)
print("smoke", len(smoke_spots), "lights", len(light_spots), "beacon", beacon)
