"""Build aligned transparent Boss WebP sheets from the supplied GIF.

Only bright, nearly neutral pixels connected to a frame edge are treated as
studio background.  The lower floor band gets a slightly wider threshold so
the cast shadow disappears, while saturated red/orange emissive pixels remain
part of the character.  The source GIF is read-only and is never overwritten.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image, ImageFilter, ImageSequence


FRAME_W = 160
FRAME_H = 240
COLUMNS = 5
FRAMES_PER_SHEET = 25
ANCHOR_X = 80
ANCHOR_Y = 232
EDGE_PAD = 3


def edge_background_mask(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    corners = [pixels[0, 0][:3], pixels[width - 1, 0][:3],
               pixels[0, height - 1][:3], pixels[width - 1, height - 1][:3]]
    bg = tuple(int(median(channel)) for channel in zip(*corners))

    candidate = bytearray(width * height)
    for y in range(height):
        floor_band = y >= int(height * 0.78)
        for x in range(width):
            red, green, blue, _ = pixels[x, y]
            brightness = (red + green + blue) / 3
            chroma = max(red, green, blue) - min(red, green, blue)
            distance = ((red - bg[0]) ** 2 + (green - bg[1]) ** 2
                        + (blue - bg[2]) ** 2) ** 0.5
            # The glow is strongly chromatic, so it cannot enter this neutral
            # edge flood even when its red channel is close to white.
            normal_bg = brightness >= 208 and chroma <= 34 and distance <= 96
            floor_bg = floor_band and brightness >= 122 and chroma <= 28
            if normal_bg or floor_bg:
                candidate[y * width + x] = 1

    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            index = y * width + x
            if candidate[index] and not outside[index]:
                outside[index] = 1
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            index = y * width + x
            if candidate[index] and not outside[index]:
                outside[index] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                index = ny * width + nx
                if candidate[index] and not outside[index]:
                    outside[index] = 1
                    queue.append((nx, ny))

    # Arms and legs can enclose pieces of the white studio backdrop.  They are
    # not edge-connected, but they are still large neutral candidate regions.
    # Remove only sizeable enclosed components so small pale skin/highlight
    # details inside the Boss remain untouched.
    visited = bytearray(outside)
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or not candidate[index]:
                continue
            visited[index] = 1
            component: list[tuple[int, int]] = []
            enclosed_queue: deque[tuple[int, int]] = deque([(x, y)])
            while enclosed_queue:
                px, py = enclosed_queue.popleft()
                component.append((px, py))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = px + dx, py + dy
                        if not (0 <= nx < width and 0 <= ny < height):
                            continue
                        other = ny * width + nx
                        if not visited[other] and candidate[other]:
                            visited[other] = 1
                            enclosed_queue.append((nx, ny))
            if len(component) >= 64:
                for px, py in component:
                    outside[py * width + px] = 1

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if outside[y * width + x]:
                alpha_pixels[x, y] = 0

    # Restrict feathering to a two-pixel ring around the removed background.
    # This protects pale skin and white-hot glow cores inside the silhouette.
    outside_image = Image.new("L", (width, height), 0)
    outside_image.putdata([255 if value else 0 for value in outside])
    near_outside = outside_image.filter(ImageFilter.MaxFilter(5)).load()
    for y in range(height):
        for x in range(width):
            if alpha_pixels[x, y] == 0 or near_outside[x, y] == 0:
                continue
            red, green, blue, _ = pixels[x, y]
            delta = max(bg[0] - red, bg[1] - green, bg[2] - blue)
            chroma = max(red, green, blue) - min(red, green, blue)
            if delta < 92 or chroma > 22:
                # Neutral anti-aliasing and colored glow both get a soft alpha,
                # but saturated glow is deliberately retained more strongly.
                estimated = delta * (3.2 if chroma <= 22 else 4.0)
                alpha_pixels[x, y] = max(12, min(255, round(estimated)))

    rgba.putalpha(alpha)
    remove_floor_fragments(rgba)
    decontaminate_white_edge(rgba, bg)
    return rgba


def remove_floor_fragments(frame: Image.Image) -> None:
    """Remove disconnected floor-shadow remnants without deleting glow flecks."""
    alpha = frame.getchannel("A")
    width, height = frame.size
    values = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or values[x, y] < 18:
                continue
            visited[index] = 1
            queue: deque[tuple[int, int]] = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = px + dx, py + dy
                        if not (0 <= nx < width and 0 <= ny < height):
                            continue
                        other = ny * width + nx
                        if not visited[other] and values[nx, ny] >= 18:
                            visited[other] = 1
                            queue.append((nx, ny))
            components.append(component)

    if not components:
        return
    largest = max(components, key=len)
    left = min(x for x, _ in largest) - 8
    top = min(y for _, y in largest) - 8
    right = max(x for x, _ in largest) + 8
    bottom = max(y for _, y in largest) + 8
    keep: set[int] = set()
    for component in components:
        close_glow = len(component) >= 8 and any(
            left <= x <= right and top <= y <= bottom for x, y in component
        )
        if component is largest or close_glow:
            keep.update(y * width + x for x, y in component)
    for y in range(height):
        for x in range(width):
            if values[x, y] and y * width + x not in keep:
                values[x, y] = 0
    frame.putalpha(alpha)


def decontaminate_white_edge(frame: Image.Image, bg: tuple[int, int, int]) -> None:
    """Undo white matte contamination on semi-transparent edge pixels."""
    pixels = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 0 or alpha >= 248:
                continue
            amount = alpha / 255
            channels = []
            for observed, background in zip((red, green, blue), bg):
                foreground = (observed - background * (1 - amount)) / max(amount, 0.05)
                channels.append(max(0, min(255, round(foreground))))
            pixels[x, y] = (*channels, alpha)


def visible_bounds(frame: Image.Image) -> tuple[int, int, int, int]:
    mask = frame.getchannel("A").point(lambda value: 255 if value >= 28 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("Boss frame became empty after background extraction")
    return bounds


def frame_anchor(bounds: tuple[int, int, int, int]) -> tuple[float, float]:
    left, _, right, bottom = bounds
    return (left + right) * 0.5, float(bottom - 1)


def align_frames(frames: list[Image.Image]) -> list[Image.Image]:
    bounds = [visible_bounds(frame) for frame in frames]
    anchors = [frame_anchor(box) for box in bounds]

    left_extent = max(anchor[0] - box[0] for anchor, box in zip(anchors, bounds))
    right_extent = max(box[2] - anchor[0] for anchor, box in zip(anchors, bounds))
    top_extent = max(anchor[1] - box[1] for anchor, box in zip(anchors, bounds))
    scale = min(
        (ANCHOR_X - EDGE_PAD) / left_extent,
        (FRAME_W - ANCHOR_X - EDGE_PAD) / right_extent,
        (ANCHOR_Y - EDGE_PAD) / top_extent,
    )

    aligned: list[Image.Image] = []
    for frame, box, anchor in zip(frames, bounds, anchors):
        crop = frame.crop(box)
        resized = crop.resize(
            (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
            Image.Resampling.LANCZOS,
        )
        anchor_x = (anchor[0] - box[0]) * scale
        anchor_y = (anchor[1] - box[1]) * scale
        x = round(ANCHOR_X - anchor_x)
        y = round(ANCHOR_Y - anchor_y)
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        canvas.alpha_composite(resized, (x, y))
        aligned.append(canvas)
    return aligned


def save_sheets(frames: list[Image.Image], output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for sheet_index in range((len(frames) + FRAMES_PER_SHEET - 1) // FRAMES_PER_SHEET):
        sheet = Image.new("RGBA", (FRAME_W * COLUMNS, FRAME_H * 5), (0, 0, 0, 0))
        start = sheet_index * FRAMES_PER_SHEET
        for local_index, frame in enumerate(frames[start:start + FRAMES_PER_SHEET]):
            x = (local_index % COLUMNS) * FRAME_W
            y = (local_index // COLUMNS) * FRAME_H
            sheet.alpha_composite(frame, (x, y))
        sheet.save(output / f"boss_{sheet_index}.webp", "WEBP", lossless=True, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    gif = Image.open(args.source)
    durations: list[int] = []
    frames: list[Image.Image] = []
    for frame in ImageSequence.Iterator(gif):
        durations.append(int(frame.info.get("duration", gif.info.get("duration", 40))))
        frames.append(edge_background_mask(frame))

    aligned = align_frames(frames)
    save_sheets(aligned, args.output)
    print(f"frames={len(aligned)} duration_ms={sum(durations)} durations={durations} sheets="
          f"{(len(aligned) + FRAMES_PER_SHEET - 1) // FRAMES_PER_SHEET}")


if __name__ == "__main__":
    main()
