#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "numpy>=1.26,<3",
#   "requests>=2.31",
#   "rasterio>=1.3",
#   "pyproj>=3.6",
# ]
# ///
"""
Build the terrain data for the website's geobn demo (Lyngen Alps avalanche risk).

Follows geobn's examples/lyngen_alps/run_example.py: fetches Kartverket's DTM
over WCS, derives slope angle, aspect and forest cover, and discretizes them
into the states of avalanche_risk.bif. The result is resampled onto a Web
Mercator grid (so it lines up with a Leaflet image overlay), packed as one code
per cell, compressed and written to assets/data/lyngen-terrain.js.

Differences from the example, both deliberate:
- The DTM is requested in its native EPSG:25833 at 50 m, so slope is computed
  on square metre cells before resampling.
- Aspect is the direction a slope faces (downhill), not the direction of
  steepest ascent.

Usage:
    uv run scripts/build_lyngen_demo.py
"""

import base64
import json
import zlib
from pathlib import Path

import numpy as np
import requests
from pyproj import Transformer
from rasterio.io import MemoryFile

WEST, SOUTH, EAST, NORTH = 19.8, 69.35, 21.0, 69.75  # same area as geobn's example
WCS_URL = "https://hoydedata.no/arcgis/services/las_dtm_somlos/ImageServer/WCSServer"
DTM_CRS = "EPSG:25833"
DTM_RESOLUTION = 50.0  # metres
GRID_RESOLUTION = 250.0  # Web Mercator metres (~85 m on the ground at 70°N)
NO_DATA = 255

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "assets" / "data" / "lyngen-terrain.js"

SLOPE_BREAKPOINTS = [0, 5, 25, 40, 90]  # flat / gentle / steep / extreme (degrees)
ASPECT_STATES = ["north", "east", "west", "south"]  # order in avalanche_risk.bif
FOREST_STATES = ["sparse", "moderate", "dense"]


def fetch_dtm() -> tuple[np.ndarray, object]:
    to_utm = Transformer.from_crs("EPSG:4326", DTM_CRS, always_xy=True)
    lons = np.array([WEST, EAST, EAST, WEST, (WEST + EAST) / 2, (WEST + EAST) / 2])
    lats = np.array([SOUTH, SOUTH, NORTH, NORTH, SOUTH, NORTH])
    xs, ys = to_utm.transform(lons, lats)
    xmin, xmax = np.floor(xs.min() / DTM_RESOLUTION) * DTM_RESOLUTION, np.ceil(xs.max() / DTM_RESOLUTION) * DTM_RESOLUTION
    ymin, ymax = np.floor(ys.min() / DTM_RESOLUTION) * DTM_RESOLUTION, np.ceil(ys.max() / DTM_RESOLUTION) * DTM_RESOLUTION
    width = int(round((xmax - xmin) / DTM_RESOLUTION))
    height = int(round((ymax - ymin) / DTM_RESOLUTION))

    print(f"Fetching Kartverket DTM: {width} × {height} cells at {DTM_RESOLUTION:.0f} m ({DTM_CRS}) …")
    params = {
        "SERVICE": "WCS",
        "VERSION": "1.0.0",
        "REQUEST": "GetCoverage",
        "COVERAGE": "las_dtm",
        "FORMAT": "GeoTIFF",
        "BBOX": f"{xmin},{ymin},{xmax},{ymax}",
        "CRS": DTM_CRS,
        "RESPONSE_CRS": DTM_CRS,
        "WIDTH": width,
        "HEIGHT": height,
    }
    response = requests.get(WCS_URL, params=params, timeout=180)
    if not response.ok or not response.content.startswith((b"II", b"MM")):
        raise SystemExit(f"WCS request failed ({response.status_code}): {response.text[:300]}")

    with MemoryFile(response.content) as memfile, memfile.open() as src:
        dem = src.read(1).astype(np.float32)
        transform = src.transform

    dem[(dem < -500) | (dem > 9000)] = np.nan
    dem[dem <= 0] = np.nan  # sea and fjords
    return dem, transform


def classify_terrain(dem: np.ndarray, transform) -> np.ndarray:
    """Return one code per DTM cell: slope * 12 + aspect * 3 + forest (NO_DATA where missing)."""
    dx = abs(transform.a)
    dy = abs(transform.e)
    filled = np.where(np.isnan(dem), 0.0, dem)
    dz_drow, dz_dcol = np.gradient(filled, dy, dx)  # rows increase southwards

    slope = np.degrees(np.arctan(np.hypot(dz_dcol, dz_drow)))
    # Downhill direction as a compass bearing: east component -dz/dx, north component +dz/drow.
    facing = np.degrees(np.arctan2(-dz_dcol, dz_drow)) % 360.0

    slope_cls = np.clip(np.digitize(slope, SLOPE_BREAKPOINTS[1:-1]), 0, 3)
    aspect_cls = np.select(
        [(facing >= 315) | (facing < 45), facing < 135, facing < 225],
        [0, 1, 3],  # north, east, south
        default=2,  # west
    )
    # Treeline heuristic from the example: dense < 400 m, moderate 400–800 m, sparse above.
    forest_cls = np.where(dem < 400, 2, np.where(dem < 800, 1, 0))

    codes = (slope_cls * 12 + aspect_cls * 3 + forest_cls).astype(np.uint8)
    codes[np.isnan(dem)] = NO_DATA
    return codes


def resample_to_mercator(codes: np.ndarray, transform) -> dict:
    to_merc = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    to_wgs = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    merc_to_utm = Transformer.from_crs("EPSG:3857", DTM_CRS, always_xy=True)

    xmin, ymin = to_merc.transform(WEST, SOUTH)
    xmax, ymax = to_merc.transform(EAST, NORTH)
    width = int(round((xmax - xmin) / GRID_RESOLUTION))
    height = int(round((ymax - ymin) / GRID_RESOLUTION))
    xmax = xmin + width * GRID_RESOLUTION
    ymin = ymax - height * GRID_RESOLUTION

    cols, rows = np.meshgrid(np.arange(width) + 0.5, np.arange(height) + 0.5)
    mx = xmin + cols * GRID_RESOLUTION
    my = ymax - rows * GRID_RESOLUTION
    ux, uy = merc_to_utm.transform(mx.ravel(), my.ravel())

    inv = ~transform
    src_col = np.floor(inv.a * ux + inv.b * uy + inv.c).astype(np.int64)
    src_row = np.floor(inv.d * ux + inv.e * uy + inv.f).astype(np.int64)
    inside = (src_col >= 0) & (src_row >= 0) & (src_col < codes.shape[1]) & (src_row < codes.shape[0])

    out = np.full(width * height, NO_DATA, dtype=np.uint8)
    out[inside] = codes[src_row[inside], src_col[inside]]  # nearest neighbour: codes are categorical

    west, south = to_wgs.transform(xmin, ymin)
    east, north = to_wgs.transform(xmax, ymax)
    return {
        "codes": out,
        "width": width,
        "height": height,
        "extent3857": [xmin, ymin, xmax, ymax],
        "bounds": [[south, west], [north, east]],
    }


def write_js(grid: dict) -> None:
    packed = base64.b64encode(zlib.compress(grid["codes"].tobytes(), 9)).decode("ascii")
    payload = {
        "width": grid["width"],
        "height": grid["height"],
        "resolution": GRID_RESOLUTION,
        "extent3857": [round(v, 3) for v in grid["extent3857"]],
        "bounds": [[round(v, 6) for v in corner] for corner in grid["bounds"]],
        "codes": packed,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    header = (
        "/* Terrain classes for the geobn demo (Lyngen Alps), one code per cell:\n"
        "   slope * 12 + aspect * 3 + forest; 255 = sea or no data. zlib-compressed, base64.\n"
        "   Derived from Kartverket's terrain model (© Kartverket, CC BY 4.0).\n"
        "   Generated by scripts/build_lyngen_demo.py — do not edit by hand. */\n"
    )
    OUT_FILE.write_text(f"{header}window.GEOBN_LYNGEN = {json.dumps(payload)};\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(ROOT)} ({OUT_FILE.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    dem, transform = fetch_dtm()
    land = np.isfinite(dem)
    print(f"DTM: {int(land.sum()):,} land cells, elevation {np.nanmin(dem):.0f}–{np.nanmax(dem):.0f} m")

    codes = classify_terrain(dem, transform)
    grid = resample_to_mercator(codes, transform)

    c = grid["codes"]
    valid = c != NO_DATA
    print(f"Grid: {grid['width']} × {grid['height']} cells, {int(valid.sum()):,} on land, "
          f"{len(np.unique(c[valid]))} distinct terrain combinations")
    slope = c[valid] // 12
    aspect = (c[valid] // 3) % 4
    forest = c[valid] % 3
    print("  slope  :", {s: f"{np.mean(slope == i):.0%}" for i, s in enumerate(["flat", "gentle", "steep", "extreme"])})
    print("  aspect :", {s: f"{np.mean(aspect == i):.0%}" for i, s in enumerate(ASPECT_STATES)})
    print("  forest :", {s: f"{np.mean(forest == i):.0%}" for i, s in enumerate(FOREST_STATES)})

    write_js(grid)


if __name__ == "__main__":
    main()
