#!/usr/bin/env python3
"""
Extract clean individual material, furniture, door, window, and fixture textures
from the 15 user-provided 3x3 1024x1024 architectural texture atlases.
"""
import os
import json
import numpy as np
from PIL import Image, ImageDraw

UPLOAD_DIR = "/home/antigravity/upload"
OUT_DIR = "/home/antigravity/sc8z35a-collab/GIT-Y4/public/textures"
os.makedirs(OUT_DIR, exist_ok=True)

ATLAS_FILES = {
    "a01": "ChatGPT_画像_2026年11月17日_08_48_40-1.png",
    "a02": "ChatGPT_画像_2026年11月17日_08_48_40-2.png",
    "a03": "ChatGPT_画像_2026年11月17日_08_48_41-3.png",
    "a04": "ChatGPT_画像_2026年11月17日_08_48_42-4.png",
    "a05": "ChatGPT_画像_2026年11月17日_08_48_42-5.png",
    "a06": "ChatGPT_画像_2026年11月17日_08_48_44-6.png",
    "a07": "ChatGPT_画像_2026年11月17日_08_48_44-7.png",
    "a08": "ChatGPT_画像_2026年11月17日_08_48_45-8.png",
    "a09": "ChatGPT_画像_2026年11月16日_16_18_44-1.png",
    "a10": "ChatGPT_画像_2026年11月16日_16_18_46-2.png",
    "a11": "ChatGPT_画像_2026年11月16日_16_18_47-3.png",
    "a12": "ChatGPT_画像_2026年11月16日_16_18_48-4.png",
    "a13": "ChatGPT_画像_2026年11月16日_16_20_06-1.png",
    "a14": "ChatGPT_画像_2026年11月16日_16_20_08-2.png",
    "a15": "ChatGPT_画像_2026年11月16日_16_20_09-3.png",
}

# (out_name, atlas_key, row, col, mode, margin)
# mode:
#   "tile"       -> inset by margin on all sides (repeating surface)
#   "trim_white" -> inset by margin, then tight crop around non-white pixels (objects on white bg)
#   "trim_beige" -> inset by margin, crop tight around object on light textured wall bg (atlas 8)
SPECS = [
    # Atlas 1: Tiles, panels, ceiling
    ("tile_beige_grid",      "a01", 0, 1, "tile", 7),
    ("panel_white_vert",     "a01", 1, 0, "tile", 7),
    ("tile_grey_stone",      "a01", 1, 1, "tile", 7),
    ("ceiling_acoustic",     "a01", 1, 2, "tile", 7),
    ("ceiling_hatch",        "a01", 2, 0, "tile", 7),

    # Atlas 2: Concrete, marble, wood slats, terrazzo
    ("concrete_clean",       "a02", 1, 0, "tile", 7),
    ("marble_white",         "a02", 1, 1, "tile", 7),
    ("wood_slats",           "a02", 1, 2, "tile", 7),
    ("terrazzo_white",       "a02", 2, 0, "tile", 7),
    ("tile_white_large",     "a02", 2, 1, "tile", 7),

    # Atlas 3: Weathered dark planks
    ("wood_planks_dark",     "a03", 1, 1, "tile", 7),

    # Atlas 4: Japanese residential finishes
    ("wood_floor",           "a04", 0, 0, "tile", 7),
    ("tatami",               "a04", 0, 1, "tile", 7),
    ("plaster_beige",        "a04", 0, 2, "tile", 7),
    ("carpet_beige",         "a04", 1, 0, "tile", 7),
    ("tile_white_small",     "a04", 1, 1, "tile", 7),
    ("wallpaper_woven",      "a04", 1, 2, "tile", 7),
    ("wainscot_wood",        "a04", 2, 1, "tile", 7),
    ("tile_blue_bath",       "a04", 2, 2, "tile", 7),

    # Atlas 5: Appliances & furniture fronts (tight crop around white bg)
    ("appliance_fridge",     "a05", 0, 0, "trim_white", 6),
    ("appliance_washer",     "a05", 0, 1, "trim_white", 6),
    ("appliance_tv",         "a05", 0, 2, "trim_white", 6),
    ("furniture_wardrobe",   "a05", 1, 0, "trim_white", 6),
    ("furniture_kitchen_cab","a05", 1, 1, "trim_white", 6),
    ("furniture_chest",      "a05", 1, 2, "trim_white", 6),
    ("appliance_ac",         "a05", 2, 0, "trim_white", 6),
    ("furniture_bookshelf",  "a05", 2, 1, "trim_white", 6),
    ("furniture_vanity",     "a05", 2, 2, "trim_white", 6),

    # Atlas 6: Wallpapers, fabrics, curtains, meal
    ("wallpaper_white",      "a06", 0, 0, "tile", 7),
    ("tile_cream",           "a06", 0, 1, "tile", 7),
    ("fabric_floral_quilt",  "a06", 0, 2, "tile", 7),
    ("fabric_sakura",        "a06", 1, 0, "tile", 7),
    ("zabuton_red",          "a06", 1, 1, "tile", 7),
    ("fabric_grey_sofa",     "a06", 1, 2, "tile", 7),
    ("curtain_botanical",    "a06", 2, 0, "tile", 7),
    ("folded_clothes",       "a06", 2, 1, "tile", 7),
    ("meal_teishoku",        "a06", 2, 2, "tile", 7),

    # Atlas 7: Doors, windows, doormat
    ("door_white",           "a07", 0, 0, "trim_white", 6),
    ("door_walnut",          "a07", 0, 1, "trim_white", 6),
    ("door_navy",            "a07", 0, 2, "trim_white", 6),
    ("door_oak",             "a07", 1, 1, "trim_white", 6),
    ("door_glass_white",     "a07", 1, 2, "trim_white", 6),
    ("window_sky",           "a07", 2, 0, "trim_white", 6),
    ("window_frosted",       "a07", 2, 1, "trim_white", 6),
    ("doormat_coir",         "a07", 2, 2, "trim_white", 6),

    # Atlas 8: Fixtures & wall art
    ("fixture_intercom",     "a08", 0, 0, "tile", 8),
    ("fixture_meter",        "a08", 0, 2, "tile", 8),
    ("fixture_pinboard",     "a08", 2, 0, "tile", 8),
    ("art_posters",          "a08", 2, 1, "tile", 8),
    ("sign_recycle",         "a08", 2, 2, "tile", 8),

    # Atlas 9: Stone & glazed brick
    ("travertine",           "a09", 0, 0, "tile", 6),
    ("brick_cream",          "a09", 1, 0, "tile", 6),
    ("tile_caramel_brick",   "a09", 1, 1, "tile", 6),
    ("stone_grey_block",     "a09", 2, 2, "tile", 6),

    # Atlas 10: Bronze, slate, fluted glass, weave
    ("metal_bronze",         "a10", 1, 0, "tile", 6),
    ("panel_slate_blue",     "a10", 1, 1, "tile", 6),
    ("glass_fluted",         "a10", 2, 0, "tile", 6),
    ("mesh_rattan",          "a10", 2, 1, "tile", 6),

    # Atlas 11: Japanese exterior & lattice
    ("shikkui_white",        "a11", 0, 1, "tile", 6),
    ("yakisugi_dark",        "a11", 0, 2, "tile", 6),
    ("bamboo_sudare",        "a11", 1, 0, "tile", 6),
    ("wood_lattice_dark",    "a11", 1, 1, "tile", 6),

    # Atlas 12: Greenery, acoustic grille, shoji grid, wood deck
    ("green_wall",           "a12", 0, 0, "tile", 6),
    ("panel_perforated",     "a12", 1, 0, "tile", 6),
    ("shoji_grid",           "a12", 1, 1, "tile", 6),
    ("wood_deck",            "a12", 1, 2, "tile", 6),

    # Atlas 13: Mint mosaic & ochre plaster
    ("tile_mosaic_mint",     "a13", 1, 1, "tile", 6),
    ("plaster_ochre",        "a13", 1, 2, "tile", 6),

    # Atlas 14: Exterior red brick pavers
    ("paver_red_brick",      "a14", 1, 2, "tile", 6),

    # Atlas 15: Exterior louver & balcony
    ("exterior_louver",      "a15", 0, 2, "tile", 6),
    ("exterior_siding_grey", "a15", 2, 1, "tile", 6),
]

loaded = {}
for k, fname in ATLAS_FILES.items():
    loaded[k] = Image.open(os.path.join(UPLOAD_DIR, fname)).convert("RGB")

manifest = {}

def trim_white_bg(img, thresh=246):
    arr = np.array(img)
    # Non-white mask: any channel below thresh
    mask = np.any(arr < thresh, axis=2)
    coords = np.argwhere(mask)
    if coords.size == 0:
        return img
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1
    return img.crop((int(x0), int(y0), int(x1), int(y1)))

# Cell pixel bounds for 1024x1024 divided cleanly into 3x3
BOUNDS = [(0, 341), (341, 682), (682, 1024)]

extracted_thumbs = []

for name, atlas_key, r, c, mode, margin in SPECS:
    atlas = loaded[atlas_key]
    y0, y1 = BOUNDS[r]
    x0, x1 = BOUNDS[c]
    crop = atlas.crop((x0 + margin, y0 + margin, x1 - margin, y1 - margin))
    if mode == "trim_white":
        crop = trim_white_bg(crop, thresh=245)
        # For TV, also trim bottom legs if needed? Actually keep whole TV or make separate screen!
    out_path = os.path.join(OUT_DIR, f"{name}.png")
    crop.save(out_path, optimize=True)
    manifest[name] = {
        "file": f"textures/{name}.png",
        "width": crop.width,
        "height": crop.height,
        "atlas": ATLAS_FILES[atlas_key],
        "cell": [r, c],
    }
    extracted_thumbs.append((name, crop))

# Also extract just the vanity base and vanity mirror separately from furniture_vanity!
vanity_full = Image.open(os.path.join(OUT_DIR, "furniture_vanity.png"))
# Mirror is top ~48%, base cabinet is bottom ~42%
arr_v = np.array(vanity_full)
# Find horizontal split row where mirror ends (around middle white band)
vh, vw = vanity_full.height, vanity_full.width
vanity_mirror = trim_white_bg(vanity_full.crop((0, 0, vw, int(vh * 0.56))), thresh=245)
vanity_base = trim_white_bg(vanity_full.crop((0, int(vh * 0.55), vw, vh)), thresh=245)
vanity_mirror.save(os.path.join(OUT_DIR, "furniture_vanity_mirror.png"), optimize=True)
vanity_base.save(os.path.join(OUT_DIR, "furniture_vanity_base.png"), optimize=True)
manifest["furniture_vanity_mirror"] = {"file": "textures/furniture_vanity_mirror.png", "width": vanity_mirror.width, "height": vanity_mirror.height}
manifest["furniture_vanity_base"] = {"file": "textures/furniture_vanity_base.png", "width": vanity_base.width, "height": vanity_base.height}
extracted_thumbs.append(("vanity_mirror", vanity_mirror))
extracted_thumbs.append(("vanity_base", vanity_base))

# Also crop just the screen/frame of TV without legs for wall/stand mounting
tv_full = Image.open(os.path.join(OUT_DIR, "appliance_tv.png"))
tv_screen = tv_full.crop((0, 0, tv_full.width, int(tv_full.height * 0.87)))
tv_screen.save(os.path.join(OUT_DIR, "appliance_tv_screen.png"), optimize=True)
manifest["appliance_tv_screen"] = {"file": "textures/appliance_tv_screen.png", "width": tv_screen.width, "height": tv_screen.height}

# Save manifest
with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

# Create verification contact sheet
cols = 8
cell_sz = 140
rows = (len(extracted_thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell_sz, rows * (cell_sz + 20)), (24, 24, 28))
draw = ImageDraw.Draw(sheet)
for idx, (name, im) in enumerate(extracted_thumbs):
    rr, cc = divmod(idx, cols)
    th = im.copy()
    th.thumbnail((cell_sz - 12, cell_sz - 12))
    px = cc * cell_sz + (cell_sz - th.width) // 2
    py = rr * (cell_sz + 20) + 6 + (cell_sz - 12 - th.height) // 2
    sheet.paste(th, (px, py))
    draw.text((cc * cell_sz + 4, rr * (cell_sz + 20) + cell_sz - 2), name[:18], fill=(220, 220, 225))

os.makedirs("/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/73f6e9fb-0973-4224-a1e8-f6e9d1ba159c/scratch", exist_ok=True)
sheet_path = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/73f6e9fb-0973-4224-a1e8-f6e9d1ba159c/scratch/texture_contact_sheet.png"
sheet.save(sheet_path)
print(f"Extracted {len(manifest)} textures successfully. Contact sheet saved to {sheet_path}")
