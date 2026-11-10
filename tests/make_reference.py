"""Builds tests/reference.json from the Swiss Ephemeris (pyswisseph, Moshier mode).

Independent of the app's code: Moon sign ingresses and void-of-course windows
(modern planets, Sun through Pluto) for three sample months.
Run: pip install pyswisseph && python tests/make_reference.py
"""
import json, swisseph as swe

FLAG = swe.FLG_MOSEPH
PLANETS = [0, 2, 3, 4, 5, 6, 7, 8, 9]  # Sun, Mercury..Pluto (no Moon)
SEPS = [0, 60, -60, 90, -90, 120, -120, 180]

def lon(jd, body):
    return swe.calc_ut(jd, body, FLAG)[0][0]

def d(a, b):
    x = (a - b) % 360
    return x - 360 if x > 180 else x

def bisect(f, a, b):
    fa = f(a)
    for _ in range(60):
        m = (a + b) / 2
        fm = f(m)
        if (fm < 0) == (fa < 0):
            a, fa = m, fm
        else:
            b = m
    return (a + b) / 2

def iso(jd):
    y, mo, dd, h = swe.revjul(jd)
    s = round(h * 3600)
    return f"{y:04d}-{mo:02d}-{dd:02d}T{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}Z"

def ingresses(jd0, jd1):
    out, step, t = [], 1 / 24, jd0
    s = int(lon(t, 1) // 30)
    while t < jd1:
        t2 = t + step
        s2 = int(lon(t2, 1) // 30)
        if s2 != s:
            b = s2 * 30
            out.append(bisect(lambda x: d(lon(x, 1), b), t, t2))
            s = s2
        t = t2
    return out

def last_aspect(jd0, jd1):
    last, step = None, 1 / 24
    t = jd0
    def seps(x):
        m = lon(x, 1)
        return [d(m, lon(x, p)) for p in PLANETS]
    prev = seps(t)
    while t < jd1:
        t2 = min(t + step, jd1)
        cur = seps(t2)
        for i, p in enumerate(PLANETS):
            for s in SEPS:
                g0, g1 = d(prev[i], s), d(cur[i], s)
                if g0 < 0 <= g1 and g1 - g0 < 30:
                    hit = bisect(lambda x: d(d(lon(x, 1), lon(x, p)), s), t, t2)
                    if last is None or hit > last:
                        last = hit
        t, prev = t2, cur
    return last

months = [(2026, 11), (2027, 2), (2027, 7)]
ref = {"ingresses": [], "voids": []}
for y, m in months:
    jd0 = swe.julday(y, m, 1, 0)
    ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
    jd1 = swe.julday(ny, nm, 1, 0)
    ing = ingresses(jd0 - 3, jd1)
    for a, b in zip(ing, ing[1:]):
        if b < jd0:
            continue
        ref["ingresses"].append(iso(b))
        la = last_aspect(a, b)
        ref["voids"].append({"start": iso(la if la else a), "end": iso(b)})
json.dump(ref, open("tests/reference.json", "w"), indent=1)
print(len(ref["ingresses"]), "ingresses,", len(ref["voids"]), "void windows")
