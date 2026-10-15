"""Build web/src/lib/thaiMapPaths.ts — province outlines of Thailand as SVG paths — for the visit map
in the backoffice (/admin/visit-stats).

Source (download once, not kept in git):
  migration/geo/geoBoundaries-THA-ADM1_simplified.geojson
  https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/THA/ADM1/geoBoundaries-THA-ADM1_simplified.geojson
  geoBoundaries gbOpen THA ADM1 (77 provinces, 2017), from OpenStreetMap — Open Database License 1.0.
  The map must show: "© OpenStreetMap contributors (ODbL), via geoBoundaries".

Steps: match each shape to provinces.code by ISO 3166-2 code (checked against the English name and against
the provincial capital's position), project (equirectangular, x scaled by cos 13°), simplify (Douglas–Peucker),
round to 0.1 px and write the paths with a label point per province.

    python migration/build_thai_map.py
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'geo', 'geoBoundaries-THA-ADM1_simplified.geojson')
OUT = os.path.join(HERE, '..', 'web', 'src', 'lib', 'thaiMapPaths.ts')

# ISO 3166-2:TH → provinces.code, with the English name the source should carry, and the capital (lat, lon)
PROVINCES = {
    'TH-10': ('BKK', 'Bangkok', 13.75, 100.50), 'TH-11': ('SPK', 'Samut Prakan', 13.60, 100.60),
    'TH-12': ('NBI', 'Nonthaburi', 13.86, 100.51), 'TH-13': ('PTE', 'Pathum Thani', 14.02, 100.53),
    'TH-14': ('AYA', 'Ayutthaya', 14.35, 100.57), 'TH-15': ('ATG', 'Ang Thong', 14.59, 100.45),
    'TH-16': ('LRI', 'Lopburi', 14.80, 100.65), 'TH-17': ('SBR', 'Sing Buri', 14.89, 100.40),
    'TH-18': ('CNT', 'Chai Nat', 15.19, 100.13), 'TH-19': ('SRI', 'Saraburi', 14.53, 100.91),
    'TH-20': ('CBI', 'Chon Buri', 13.36, 100.98), 'TH-21': ('RYG', 'Rayong', 12.68, 101.28),
    'TH-22': ('CTI', 'Chanthaburi', 12.61, 102.10), 'TH-23': ('TRT', 'Trat', 12.24, 102.52),
    'TH-24': ('CCO', 'Chachoengsao', 13.69, 101.07), 'TH-25': ('PRI', 'Prachin Buri', 14.05, 101.37),
    'TH-26': ('NYK', 'Nakhon Nayok', 14.20, 101.21), 'TH-27': ('SKW', 'Sa Kaeo', 13.82, 102.07),
    'TH-30': ('NMA', 'Nakhon Ratchasima', 14.97, 102.10), 'TH-31': ('BRM', 'Buri Ram', 14.99, 103.10),
    'TH-32': ('SRN', 'Surin', 14.88, 103.49), 'TH-33': ('SSK', 'Si Sa Ket', 15.12, 104.32),
    'TH-34': ('UBN', 'Ubon Ratchathani', 15.23, 104.86), 'TH-35': ('YST', 'Yasothon', 15.79, 104.15),
    'TH-36': ('CPM', 'Chaiyaphum', 15.81, 102.03), 'TH-37': ('ACR', 'Amnat Charoen', 15.86, 104.63),
    'TH-38': ('BKN', 'Bueng Kan', 18.36, 103.65), 'TH-39': ('NBP', 'Nong Bua Lam Phu', 17.20, 102.44),
    'TH-40': ('KKN', 'Khon Kaen', 16.43, 102.83), 'TH-41': ('UDN', 'Udon Thani', 17.41, 102.79),
    'TH-42': ('LEI', 'Loei', 17.49, 101.72), 'TH-43': ('NKI', 'Nong Khai', 17.88, 102.74),
    'TH-44': ('MKM', 'Maha Sarakham', 16.18, 103.30), 'TH-45': ('RET', 'Roi Et', 16.05, 103.65),
    'TH-46': ('KSN', 'Kalasin', 16.43, 103.51), 'TH-47': ('SNK', 'Sakon Nakhon', 17.16, 104.15),
    'TH-48': ('NPM', 'Nakhon Phanom', 17.41, 104.78), 'TH-49': ('MDH', 'Mukdahan', 16.54, 104.72),
    'TH-50': ('CMI', 'Chiang Mai', 18.79, 98.98), 'TH-51': ('LPN', 'Lamphun', 18.58, 99.01),
    'TH-52': ('LPG', 'Lampang', 18.29, 99.49), 'TH-53': ('UTT', 'Uttaradit', 17.62, 100.10),
    'TH-54': ('PRE', 'Phrae', 18.14, 100.14), 'TH-55': ('NAN', 'Nan', 18.78, 100.78),
    'TH-56': ('PYO', 'Phayao', 19.17, 99.90), 'TH-57': ('CRI', 'Chiang Rai', 19.91, 99.83),
    'TH-58': ('MSN', 'Mae Hong Son', 19.30, 97.97), 'TH-60': ('NSN', 'Nakhon Sawan', 15.70, 100.14),
    'TH-61': ('UTI', 'Uthai Thani', 15.38, 100.02), 'TH-62': ('KPT', 'Kamphaeng Phet', 16.48, 99.52),
    'TH-63': ('TAK', 'Tak', 16.88, 99.13), 'TH-64': ('STI', 'Sukhothai', 17.01, 99.82),
    'TH-65': ('PLK', 'Phitsanulok', 16.82, 100.26), 'TH-66': ('PCT', 'Phichit', 16.44, 100.35),
    'TH-67': ('PNB', 'Phetchabun', 16.42, 101.16), 'TH-70': ('RBR', 'Ratchaburi', 13.54, 99.82),
    'TH-71': ('KRI', 'Kanchanaburi', 14.00, 99.55), 'TH-72': ('SPB', 'Suphan Buri', 14.47, 100.12),
    'TH-73': ('NPT', 'Nakhon Pathom', 13.82, 100.04), 'TH-74': ('SKN', 'Samut Sakhon', 13.55, 100.27),
    'TH-75': ('SKM', 'Samut Songkhram', 13.41, 100.00), 'TH-76': ('PBI', 'Phetchaburi', 13.11, 99.94),
    'TH-77': ('PKN', 'Prachuap Khiri Khan', 11.81, 99.80), 'TH-80': ('NST', 'Nakhon Si Thammarat', 8.43, 99.96),
    'TH-81': ('KBI', 'Krabi', 8.09, 98.91), 'TH-82': ('PNA', 'Phang Nga', 8.45, 98.53),
    'TH-83': ('PKT', 'Phuket', 7.88, 98.39), 'TH-84': ('SNI', 'Surat Thani', 9.14, 99.33),
    'TH-85': ('RNG', 'Ranong', 9.96, 98.64), 'TH-86': ('CPN', 'Chumphon', 10.49, 99.18),
    'TH-90': ('SKA', 'Songkhla', 7.19, 100.60), 'TH-91': ('STN', 'Satun', 6.62, 100.07),
    'TH-92': ('TRG', 'Trang', 7.56, 99.61), 'TH-93': ('PLG', 'Phatthalung', 7.62, 100.08),
    'TH-94': ('PTN', 'Pattani', 6.87, 101.25), 'TH-95': ('YLA', 'Yala', 6.54, 101.28),
    'TH-96': ('NWT', 'Narathiwat', 6.43, 101.82),
}

WIDTH = 600  # px of the drawing's width; height follows the country's shape
TOLERANCE = 0.55  # px; Douglas–Peucker
MIN_RING = 2.0  # px²; drops specks of islands smaller than this
K = math.cos(math.radians(13))
squash = lambda s: ''.join(ch for ch in s.lower() if ch.isalpha())


def dp(points, tol):
    """Douglas–Peucker on an open polyline."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-12
    best, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm if norm > 1e-12 else math.hypot(px - x1, py - y1)
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [points[0], points[-1]]
    return dp(points[: idx + 1], tol)[:-1] + dp(points[idx:], tol)


def area(ring):
    return 0.5 * sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1))


def main():
    if not os.path.exists(SRC):
        sys.exit(f'missing {SRC} (see the download link at the top of this script)')
    feats = json.load(open(SRC, encoding='utf-8'))['features']
    polys = {}
    for f in feats:
        iso = f['properties']['shapeISO']
        if iso not in PROVINCES:
            sys.exit(f'unknown province {iso} {f["properties"]["shapeName"]}')
        code, en, *_ = PROVINCES[iso]
        name = squash(f['properties']['shapeName'].replace('Province', ''))
        if squash(en) not in name and name not in squash(en):
            print(f'  note: {iso} source name "{f["properties"]["shapeName"]}" vs expected "{en}"')
        g = f['geometry']
        polys[code] = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    missing = {v[0] for v in PROVINCES.values()} - set(polys)
    if missing:
        sys.exit(f'missing provinces: {sorted(missing)}')

    lons = [p[0] for ps in polys.values() for poly in ps for ring in poly for p in ring]
    lats = [p[1] for ps in polys.values() for poly in ps for ring in poly for p in ring]
    lon0, lat1 = min(lons), max(lats)
    scale = WIDTH / ((max(lons) - lon0) * K)
    proj = lambda lon, lat: ((lon - lon0) * K * scale, (lat1 - lat) * scale)
    height = (lat1 - min(lats)) * scale

    out, worst = {}, 0.0
    for iso, (code, en, clat, clon) in PROVINCES.items():
        parts, best = [], None
        for poly in polys[code]:
            for ri, ring in enumerate(poly):
                pts = [proj(*p) for p in ring]
                simple = dp(pts, TOLERANCE)
                if len(simple) < 4 or abs(area(simple)) < MIN_RING:
                    continue
                parts.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in simple[:-1]) + 'Z')
                if ri == 0 and (best is None or abs(area(pts)) > abs(area(best))):
                    best = pts
        # label/pulse point: centre of the largest outer ring (area-weighted centroid)
        a = area(best)
        cx = sum((best[i][0] + best[i + 1][0]) * (best[i][0] * best[i + 1][1] - best[i + 1][0] * best[i][1]) for i in range(len(best) - 1)) / (6 * a)
        cy = sum((best[i][1] + best[i + 1][1]) * (best[i][0] * best[i + 1][1] - best[i + 1][0] * best[i][1]) for i in range(len(best) - 1)) / (6 * a)
        # sanity: the shape must lie around its capital (the capital may sit off-centre, so allow ~1 degree)
        tx, ty = proj(clon, clat)
        off = math.hypot(cx - tx, cy - ty) / scale
        worst = max(worst, off)
        if off > 1.2:
            sys.exit(f'{code} ({en}) centre is {off:.2f} deg from its capital — wrong match?')
        out[code] = {'d': ''.join(parts), 'cx': round(cx, 1), 'cy': round(cy, 1)}

    body = ',\n'.join(f"  {c}: {{ cx: {v['cx']}, cy: {v['cy']}, d: '{v['d']}' }}" for c, v in sorted(out.items()))
    ts = f"""// Generated by migration/build_thai_map.py — do not edit by hand.
// Province outlines: geoBoundaries gbOpen THA ADM1 (2017), from OpenStreetMap.
// © OpenStreetMap contributors, Open Database License 1.0 (https://www.openstreetmap.org/copyright).
// Any page that shows this map must credit: "© OpenStreetMap contributors (ODbL), via geoBoundaries".

export const THAI_MAP_VIEWBOX = '0 0 {WIDTH} {math.ceil(height)}'

/** provinces.code → SVG path, and a point inside the province for its marker. BKK is Bangkok (not one of the 76). */
export const THAI_MAP: Record<string, {{ d: string; cx: number; cy: number }}> = {{
{body},
}}
"""
    open(OUT, 'w', encoding='utf-8', newline='\n').write(ts)
    print(f'{len(out)} provinces, {WIDTH}x{math.ceil(height)} px, {len(ts) / 1024:.0f} KB, worst centre offset {worst:.2f} deg')


main()
