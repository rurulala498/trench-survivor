"""Build transparent, mouse-scrubbable HMG frame sheets from the supplied GIFs.

The source animations use an opaque, smoothly shaded studio background.  We
remove the dark background with a clean edge flood, then repair only narrow
false gaps that are also classified as weapon by a conservative silhouette
pass.  This keeps the studio glow out without punching holes through dark gun
parts that touch the image boundary.  Every output frame keeps the original
320x213 canvas so the baked camera/pivot never jitters.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


SOURCE_WIDTH = 320
SOURCE_HEIGHT = 213
OUTPUT_SCALE = 2
FRAME_WIDTH = SOURCE_WIDTH * OUTPUT_SCALE
FRAME_HEIGHT = SOURCE_HEIGHT * OUTPUT_SCALE
FRAMES_PER_SHEET = 25
COLUMNS = 5
ROWS = 5
EDGE_STEP_THRESHOLD = 8
TOP_EDGE_SMOOTHNESS = 18
SHAPE_REPAIR_DIAMETER = 13


def _edge_background_clean(frame: Image.Image) -> bytearray:
    """Return the aggressive studio-background flood used for clean edges.

    This pass removes the full glow reliably, but an extreme frame can put a
    dark weapon part on one of its seeds.  A second, conservative pass and the
    shape-preserving repair pass restores those occasional false removals.
    """
    rgb = frame.convert("RGB")
    pixels = rgb.load()
    width, height = rgb.size
    background = bytearray(width * height)
    queue: deque[int] = deque()

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not background[index]:
            background[index] = 1
            queue.append(index)

    for x in range(width):
        red, green, blue = pixels[x, 0]
        if (red + green + blue) / 3 < 55:
            seed(x, 0)
    for y in range(height):
        for x in (0, width - 1):
            red, green, blue = pixels[x, y]
            if (red + green + blue) / 3 < 35:
                seed(x, y)

    _grow_background(pixels, width, height, background, queue)
    return background


def _edge_background_preserve(frame: Image.Image) -> bytearray:
    rgb = frame.convert("RGB")
    pixels = rgb.load()
    width, height = rgb.size
    background = bytearray(width * height)
    queue: deque[int] = deque()

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not background[index]:
            background[index] = 1
            queue.append(index)

    # Extreme aim frames put dark weapon parts directly on the top/side edges.
    # Seeding every dark edge pixel therefore lets the flood enter the gun and
    # punch frame-dependent holes through the receiver or barrel.  Keep a safe
    # corner seed, then add only smooth top-edge samples.  Those samples cover
    # each brightness band of the studio gradient without selecting the highly
    # textured barrel that crosses the top edge in several frames.
    for y in range(4):
        for x in range(4):
            red, green, blue = pixels[x, y]
            if (red + green + blue) / 3 < 65:
                seed(x, y)
    for x in range(width):
        patch = [
            pixels[next_x, next_y]
            for next_y in range(3)
            for next_x in range(max(0, x - 1), min(width, x + 2))
        ]
        red, green, blue = pixels[x, 0]
        if (
            (red + green + blue) / 3 < 120
            and max(
                max(colour[channel] for colour in patch)
                - min(colour[channel] for colour in patch)
                for channel in range(3)
            ) <= TOP_EDGE_SMOOTHNESS
        ):
            seed(x, 0)

    _grow_background(pixels, width, height, background, queue)
    return background


def _grow_background(
    pixels: Image.PixelAccess,
    width: int,
    height: int,
    background: bytearray,
    queue: deque[int],
) -> None:
    while queue:
        index = queue.popleft()
        y, x = divmod(index, width)
        red, green, blue = pixels[x, y]
        neighbours = (
            index - 1 if x else -1,
            index + 1 if x + 1 < width else -1,
            index - width if y else -1,
            index + width if y + 1 < height else -1,
        )
        for neighbour in neighbours:
            if neighbour < 0 or background[neighbour]:
                continue
            next_y, next_x = divmod(neighbour, width)
            next_red, next_green, next_blue = pixels[next_x, next_y]
            if max(
                abs(next_red - red),
                abs(next_green - green),
                abs(next_blue - blue),
            ) <= EDGE_STEP_THRESHOLD:
                background[neighbour] = 1
                queue.append(neighbour)


def _largest_foreground(background: bytearray, width: int, height: int) -> bytearray:
    visited = bytearray(width * height)
    largest: list[int] = []

    for start, is_background in enumerate(background):
        if is_background or visited[start]:
            continue
        component: list[int] = []
        queue: deque[int] = deque([start])
        visited[start] = 1
        while queue:
            index = queue.popleft()
            component.append(index)
            y, x = divmod(index, width)
            neighbours = (
                index - 1 if x else -1,
                index + 1 if x + 1 < width else -1,
                index - width if y else -1,
                index + width if y + 1 < height else -1,
            )
            for neighbour in neighbours:
                if neighbour < 0 or visited[neighbour] or background[neighbour]:
                    continue
                visited[neighbour] = 1
                queue.append(neighbour)
        if len(component) > len(largest):
            largest = component

    mask = bytearray(width * height)
    for index in largest:
        mask[index] = 255
    return mask


def _shape_repair_envelope(
    foreground: bytearray,
    width: int,
    height: int,
) -> bytearray:
    """Close narrow false gaps without expanding the outer gun silhouette."""
    mask = Image.frombytes("L", (width, height), bytes(foreground))
    closed = mask.filter(ImageFilter.MaxFilter(SHAPE_REPAIR_DIAMETER)).filter(
        ImageFilter.MinFilter(SHAPE_REPAIR_DIAMETER)
    )
    return bytearray(closed.tobytes())


def remove_studio_background(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    width, height = rgba.size
    clean_background = _edge_background_clean(rgba)
    clean_foreground = _largest_foreground(clean_background, width, height)
    preserve_background = _edge_background_preserve(rgba)
    preserve_foreground = _largest_foreground(preserve_background, width, height)

    repair_envelope = _shape_repair_envelope(clean_foreground, width, height)
    foreground = bytearray(width * height)
    for index in range(width * height):
        if clean_foreground[index] or (
            preserve_foreground[index]
            and repair_envelope[index]
        ):
            foreground[index] = 255
    alpha = Image.frombytes("L", (width, height), bytes(foreground))
    # A narrow feather retains anti-aliasing.  The wider flood above removes the
    # studio glow first, so the feather cannot turn that glow into a dark halo.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.48))
    rgba.putalpha(alpha)
    decontaminate_edge_colors(rgba)
    return upscale_game_frame(rgba)


def decontaminate_edge_colors(frame: Image.Image) -> None:
    """Extend solid weapon colours through the feathered alpha edge.

    Transparent WebP still stores RGB values.  Keeping the studio-background
    RGB under a soft alpha produces a dark fringe when the browser scales the
    frame.  Four one-pixel colour dilations replace only those hidden RGB
    values while preserving the alpha and every visible weapon detail.
    """
    pixels = frame.load()
    alpha = frame.getchannel("A")
    alpha_pixels = alpha.load()
    width, height = frame.size
    valid = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            if alpha_pixels[x, y] >= 224:
                valid[y * width + x] = 1

    for _ in range(4):
        additions: list[tuple[int, int, tuple[int, int, int]]] = []
        for y in range(height):
            for x in range(width):
                index = y * width + x
                if valid[index]:
                    continue
                candidates: list[tuple[int, int, int, int]] = []
                if x and valid[index - 1]: candidates.append((*pixels[x - 1, y][:3], alpha_pixels[x - 1, y]))
                if x + 1 < width and valid[index + 1]: candidates.append((*pixels[x + 1, y][:3], alpha_pixels[x + 1, y]))
                if y and valid[index - width]: candidates.append((*pixels[x, y - 1][:3], alpha_pixels[x, y - 1]))
                if y + 1 < height and valid[index + width]: candidates.append((*pixels[x, y + 1][:3], alpha_pixels[x, y + 1]))
                if candidates:
                    red, green, blue, _ = max(candidates, key=lambda value: value[3])
                    additions.append((x, y, (red, green, blue)))
        for x, y, colour in additions:
            pixels[x, y] = (*colour, alpha_pixels[x, y])
            valid[y * width + x] = 1


def upscale_game_frame(frame: Image.Image) -> Image.Image:
    """Pre-upscale once so Canvas down/up sampling does not blur every frame."""
    high = frame.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)
    alpha = high.getchannel("A")
    rgb = high.convert("RGB").filter(
        ImageFilter.UnsharpMask(radius=0.85, percent=62, threshold=3)
    )
    high = rgb.convert("RGBA")
    high.putalpha(alpha)
    return high


def read_frames(path: Path) -> list[Image.Image]:
    source = Image.open(path)
    if source.size != (SOURCE_WIDTH, SOURCE_HEIGHT):
        raise ValueError(f"Unexpected HMG GIF size {source.size}: {path}")
    source_frames: list[Image.Image] = []
    for index in range(source.n_frames):
        source.seek(index)
        source_frames.append(source.convert("RGBA"))
    frames = [
        remove_studio_background(frame)
        for frame in source_frames
    ]
    if len(frames) != 125:
        raise ValueError(f"Expected 125 frames, got {len(frames)}: {path}")
    return frames


def write_sheets(frames: list[Image.Image], output_dir: Path, prefix: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for sheet_index in range(5):
        sheet = Image.new(
            "RGBA",
            (FRAME_WIDTH * COLUMNS, FRAME_HEIGHT * ROWS),
            (0, 0, 0, 0),
        )
        first = sheet_index * FRAMES_PER_SHEET
        for local_index, frame in enumerate(frames[first:first + FRAMES_PER_SHEET]):
            x = (local_index % COLUMNS) * FRAME_WIDTH
            y = (local_index // COLUMNS) * FRAME_HEIGHT
            sheet.alpha_composite(frame, (x, y))
        target = output_dir / f"{prefix}_{sheet_index}.webp"
        # 2x sheets remain much sharper in Canvas, while high-quality WebP
        # keeps the critical startup payload close to the former 1x assets.
        # Alpha is still encoded losslessly by WebP.
        sheet.save(target, "WEBP", lossless=False, quality=94, method=6)
        print(target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("left", type=Path)
    parser.add_argument("right", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    write_sheets(read_frames(args.left), args.output / "left", "hmg_left")
    write_sheets(read_frames(args.right), args.output / "right", "hmg_right")


if __name__ == "__main__":
    main()
