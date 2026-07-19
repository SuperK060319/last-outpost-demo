"""把已去除色键的美术图集拆成 Phaser 可直接加载的独立 PNG。"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


TOWER_ASSETS = (
    "heavy-mg.png",
    "mortar.png",
    "sniper-tower.png",
    "flame-turret.png",
    "auto-grenade.png",
    "anti-armor-rocket.png",
    "supply-depot.png",
    "deployment-pad.png",
)

ENEMY_ASSETS = (
    "zombie.png",
    "zombie-runner.png",
    "zombie-armored.png",
    "zombie-swarm.png",
    "zombie-shielded.png",
    "zombie-bomber.png",
    "zombie-toxic.png",
    "zombie-medic.png",
    "boss.png",
)


def crop_to_ratio(image: Image.Image, width: int, height: int) -> Image.Image:
    """只裁掉多余边缘，不拉伸战场透视。"""
    target_ratio = width / height
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    elif source_ratio < target_ratio:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def compose_battlefield(image: Image.Image) -> Image.Image:
    """把生成图的基地压到固定 700–890 区间，保证美术与交互坐标一致。"""
    # 先保持 9:16 比例，再分别缩放道路和基地；避免整图拉伸导致炮座继续错位。
    normalized = crop_to_ratio(image, 540, 960)
    source_base_top = 730
    road = normalized.crop((0, 0, 540, source_base_top)).resize(
        (540, 700), Image.Resampling.LANCZOS
    )
    base = normalized.crop((0, source_base_top, 540, 960)).resize(
        (540, 190), Image.Resampling.LANCZOS
    )
    result = Image.new("RGB", (540, 960), (17, 23, 25))
    result.paste(road, (0, 0))
    result.paste(base, (0, 700))
    # 890px 以下由游戏底栏覆盖，保留深色可避免过渡边缘在半透明弹窗中漏出。
    return result


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("图集单元没有可见像素，请检查色键去除结果")
    return bounds


def fit_sprite(cell: Image.Image, size: tuple[int, int], occupancy: float) -> Image.Image:
    """透明裁边后统一留白，避免不同源尺寸导致游戏内忽大忽小。"""
    sprite = cell.crop(alpha_bounds(cell))
    max_width = round(size[0] * occupancy)
    max_height = round(size[1] * occupancy)
    scale = min(max_width / sprite.width, max_height / sprite.height)
    fitted = sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - fitted.width) // 2
    # 脚底略向下放，炮塔/角色在 Phaser 里共用中心锚点时更稳。
    y = size[1] - fitted.height - round(size[1] * (1 - occupancy) / 2)
    canvas.alpha_composite(fitted, (x, max(0, y)))
    return canvas


def split_atlas(
    atlas_path: Path,
    columns: int,
    rows: int,
    names: tuple[str, ...],
    output_dir: Path,
    sprite_size: tuple[int, int],
    occupancy: float,
) -> None:
    atlas = Image.open(atlas_path).convert("RGBA")
    cell_width = atlas.width / columns
    cell_height = atlas.height / rows
    for index, name in enumerate(names):
        column = index % columns
        row = index // columns
        # 四舍五入网格边界，确保最右/最下单元不会少一列像素。
        bounds = (
            round(column * cell_width),
            round(row * cell_height),
            round((column + 1) * cell_width),
            round((row + 1) * cell_height),
        )
        cell = atlas.crop(bounds)
        fit_sprite(cell, sprite_size, occupancy).save(output_dir / name, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--background", type=Path, required=True)
    parser.add_argument("--tower-atlas", type=Path, required=True)
    parser.add_argument("--enemy-atlas", type=Path, required=True)
    parser.add_argument("--commander", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    background = Image.open(args.background).convert("RGB")
    compose_battlefield(background).save(
        args.out / "battlefield-background.jpg", quality=92, optimize=True
    )
    split_atlas(args.tower_atlas, 4, 2, TOWER_ASSETS, args.out, (512, 512), 0.9)
    split_atlas(args.enemy_atlas, 3, 3, ENEMY_ASSETS, args.out, (384, 512), 0.88)

    commander = Image.open(args.commander).convert("RGBA")
    fit_sprite(commander, (512, 768), 0.92).save(args.out / "commander.png", optimize=True)


if __name__ == "__main__":
    main()
