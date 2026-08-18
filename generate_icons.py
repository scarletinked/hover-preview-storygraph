from PIL import Image, ImageDraw

BG = (14, 116, 144, 255)      # cyan-700, matches the popup's rating color
PAGE = (255, 255, 255, 255)
SPINE = (255, 219, 119, 255)  # matches the star-rating gold accent

SIZE = 512  # draw big, downsample for crisp small icons


def make_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # rounded-square background
    radius = int(SIZE * 0.22)
    d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=BG)

    # open book: two "pages" as quadrilaterals meeting at a center spine
    cx, cy = SIZE / 2, SIZE / 2 + SIZE * 0.03
    half_w = SIZE * 0.30
    top = cy - SIZE * 0.19
    bottom = cy + SIZE * 0.19
    lift = SIZE * 0.05  # outer corners lift up slightly for an open-book curve

    left_page = [
        (cx, top),
        (cx - half_w, top - lift),
        (cx - half_w, bottom - lift),
        (cx, bottom),
    ]
    right_page = [
        (cx, top),
        (cx + half_w, top - lift),
        (cx + half_w, bottom - lift),
        (cx, bottom),
    ]
    d.polygon(left_page, fill=PAGE)
    d.polygon(right_page, fill=PAGE)

    # spine
    d.line([(cx, top), (cx, bottom)], fill=SPINE, width=max(2, int(SIZE * 0.018)))

    # a couple of faint text lines on each page for detail at large sizes
    line_color = (14, 116, 144, 90)
    for i in range(3):
        ly = top + SIZE * 0.07 + i * SIZE * 0.07
        d.line([(cx - half_w * 0.75, ly - lift * (1 - i / 3)),
                (cx - half_w * 0.15, ly - lift * (1 - i / 3))], fill=line_color, width=max(2, int(SIZE * 0.012)))
        d.line([(cx + half_w * 0.15, ly - lift * (1 - i / 3)),
                (cx + half_w * 0.75, ly - lift * (1 - i / 3))], fill=line_color, width=max(2, int(SIZE * 0.012)))

    # small "preview" badge (magnifying glass) bottom-right, echoes the popup affordance
    badge_r = SIZE * 0.155
    badge_cx = SIZE * 0.775
    badge_cy = SIZE * 0.79
    d.ellipse([badge_cx - badge_r, badge_cy - badge_r, badge_cx + badge_r, badge_cy + badge_r],
              fill=(255, 219, 119, 255), outline=BG, width=int(SIZE * 0.02))
    glass_r = badge_r * 0.42
    glass_cx = badge_cx - badge_r * 0.18
    glass_cy = badge_cy - badge_r * 0.18
    d.ellipse([glass_cx - glass_r, glass_cy - glass_r, glass_cx + glass_r, glass_cy + glass_r],
              outline=BG, width=int(SIZE * 0.022))
    handle_start = (glass_cx + glass_r * 0.75, glass_cy + glass_r * 0.75)
    handle_end = (badge_cx + badge_r * 0.55, badge_cy + badge_r * 0.55)
    d.line([handle_start, handle_end], fill=BG, width=int(SIZE * 0.028))

    return img


base = make_icon()
for size in (16, 48, 128):
    resized = base.resize((size, size), Image.LANCZOS)
    resized.save(f"icons/icon{size}.png")

print("done")
