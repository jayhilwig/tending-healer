from io import BytesIO
from pathlib import Path

from PIL import Image
from reportlab.graphics import renderPDF
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from svglib.svglib import svg2rlg


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
FONTS = PUBLIC / "fonts"
ICONS = PUBLIC / "icons"
OUTPUT = ROOT / "output"
OUTPUT.mkdir(exist_ok=True)

AKASHA = PUBLIC / "akasha.webp"
KARI = PUBLIC / "kari.webp"
HUMMINGBIRD = PUBLIC / "hummingbird.webp"
WHEEL = PUBLIC / "medicine-wheel.png"
QR = PUBLIC / "tend-healer-qr.svg"
CALENDAR_ICON = ICONS / "calendar-days.svg"
CLOCK_ICON = ICONS / "clock.svg"
PIN_ICON = ICONS / "map-pin.svg"
DOLLAR_ICON = ICONS / "dollar-sign.svg"
COOKIE_ICON = ICONS / "cookie.svg"
OUT = OUTPUT / "tending-the-healer-flyer.pdf"
REGISTRATION_URL = "https://tinyurl.com/tend-healer"

PAGE_W, PAGE_H = letter
ART_X = 42
ART_W = 528

CREAM = colors.HexColor("#FBF6EC")
PALE = colors.HexColor("#FFF9F0")
DEEP = colors.HexColor("#123F35")
INK = colors.HexColor("#173B35")
RUST = colors.HexColor("#A84B31")
GOLD = colors.HexColor("#C99638")
SAGE = colors.HexColor("#6F7C45")
LINE = colors.HexColor("#E8D5AF")
ICON_DRAWINGS = {}


def register_font(name, filename):
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))


register_font("AssistantRegular", "Assistant-Regular.ttf")
register_font("AssistantMedium", "Assistant-Medium.ttf")
register_font("AssistantSemiBold", "Assistant-SemiBold.ttf")
register_font("AssistantBold", "Assistant-Bold.ttf")
register_font("CormorantRegular", "Cormorant-Regular.ttf")
register_font("CormorantMedium", "Cormorant-Medium.ttf")
register_font("CormorantSemiBold", "Cormorant-SemiBold.ttf")
register_font("CormorantBold", "Cormorant-Bold.ttf")

BODY = "AssistantRegular"
BODY_MEDIUM = "AssistantMedium"
BODY_SEMIBOLD = "AssistantSemiBold"
BOLD = "AssistantBold"
SERIF = "CormorantRegular"
SERIF_MEDIUM = "CormorantMedium"
SERIF_SEMIBOLD = "CormorantSemiBold"
SERIF_BOLD = "CormorantBold"


def wrap_lines(text, font, size, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, max_width, font=BODY, size=9, leading=12, color=INK):
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap_lines(text, font, size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_centered_tracked(c, text, center_x, y, font, size, tracking, color):
    widths = [pdfmetrics.stringWidth(char, font, size) for char in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = center_x - total / 2
    c.setFillColor(color)
    c.setFont(font, size)
    for char, width in zip(text, widths):
        c.drawString(x, y, char)
        x += width + tracking


def draw_tracked(c, text, x, y, font, size, tracking, color):
    c.setFillColor(color)
    c.setFont(font, size)
    for char in text:
        c.drawString(x, y, char)
        x += pdfmetrics.stringWidth(char, font, size) + tracking


def trimmed_image(path):
    image = Image.open(path).convert("RGBA")
    alpha_bounds = image.getchannel("A").point(
        lambda alpha: 255 if alpha > 8 else 0
    ).getbbox()
    if alpha_bounds:
        image = image.crop(alpha_bounds)
    return image


def draw_trimmed_image(c, path, x, y, width, height):
    image = trimmed_image(path)
    scale = min(width / image.width, height / image.height)
    draw_w = image.width * scale
    draw_h = image.height * scale
    stream = BytesIO()
    image.save(stream, format="PNG")
    stream.seek(0)
    c.drawImage(
        ImageReader(stream),
        x + (width - draw_w) / 2,
        y + (height - draw_h) / 2,
        draw_w,
        draw_h,
        preserveAspectRatio=True,
        mask="auto",
    )


def draw_circle_photo(c, path, center_x, center_y, diameter, border_color=GOLD):
    image = Image.open(path).convert("RGB")
    scale = max(diameter / image.width, diameter / image.height)
    draw_w = image.width * scale
    draw_h = image.height * scale
    c.saveState()
    clip = c.beginPath()
    clip.circle(center_x, center_y, diameter / 2)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(
        ImageReader(image),
        center_x - draw_w / 2,
        center_y - draw_h / 2,
        draw_w,
        draw_h,
        preserveAspectRatio=True,
        mask="auto",
    )
    c.restoreState()
    c.setStrokeColor(border_color)
    c.setLineWidth(1.15)
    c.circle(center_x, center_y, diameter / 2, stroke=1, fill=0)


def draw_qr_svg(c, path, x, y, size):
    drawing = svg2rlg(str(path))
    scale = min(size / drawing.width, size / drawing.height)
    c.saveState()
    c.translate(x, y)
    c.scale(scale, scale)
    renderPDF.draw(drawing, c, 0, 0)
    c.restoreState()


def color_svg_shapes(node, color):
    if hasattr(node, "strokeColor") and node.strokeColor is not None:
        node.strokeColor = color
    if hasattr(node, "fillColor") and node.fillColor is not None:
        node.fillColor = color
    for child in getattr(node, "contents", []):
        color_svg_shapes(child, color)


def lucide_icon(path):
    if path not in ICON_DRAWINGS:
        svg = path.read_text(encoding="utf-8").replace("currentColor", "#FFFFFF")
        drawing = svg2rlg(BytesIO(svg.encode("utf-8")))
        color_svg_shapes(drawing, colors.white)
        ICON_DRAWINGS[path] = drawing
    return ICON_DRAWINGS[path]


def draw_lucide_icon(c, path, cx, cy, size=17.5):
    drawing = lucide_icon(path)
    scale = min(size / drawing.width, size / drawing.height)
    draw_w = drawing.width * scale
    draw_h = drawing.height * scale
    c.saveState()
    c.translate(cx - draw_w / 2, cy - draw_h / 2)
    c.scale(scale, scale)
    renderPDF.draw(drawing, c, 0, 0)
    c.restoreState()


def draw_ornament(c, x1, x2, y, color=GOLD):
    center = (x1 + x2) / 2
    c.setStrokeColor(color)
    c.setLineWidth(0.55)
    c.line(x1, y, center - 10, y)
    c.line(center + 10, y, x2, y)
    path = c.beginPath()
    path.moveTo(center - 10, y)
    path.lineTo(center - 5, y + 3)
    path.lineTo(center, y)
    path.lineTo(center - 5, y - 3)
    path.close()
    c.drawPath(path, stroke=1, fill=0)
    path = c.beginPath()
    path.moveTo(center, y)
    path.lineTo(center + 5, y + 3)
    path.lineTo(center + 10, y)
    path.lineTo(center + 5, y - 3)
    path.close()
    c.drawPath(path, stroke=1, fill=0)


def draw_leaf_sprig(c, x, y, direction=1):
    c.saveState()
    c.setStrokeColor(SAGE)
    c.setFillColor(SAGE)
    c.setLineWidth(0.55)
    c.line(x, y, x + direction * 28, y + 1)
    for offset, lift in ((6, 1), (12, -1), (18, 2), (24, 0)):
        px = x + direction * offset
        path = c.beginPath()
        path.moveTo(px, y)
        path.curveTo(px + direction * 4, y + lift + 4, px + direction * 7, y + lift + 4, px + direction * 8, y + lift + 1)
        path.curveTo(px + direction * 5, y + lift, px + direction * 2, y - 1, px, y)
        path.close()
        c.drawPath(path, stroke=0, fill=1)
    c.restoreState()


def draw_calendar_icon(c, cx, cy):
    draw_lucide_icon(c, CALENDAR_ICON, cx, cy, 18)


def draw_clock_icon(c, cx, cy):
    draw_lucide_icon(c, CLOCK_ICON, cx, cy, 18)


def draw_pin_icon(c, cx, cy):
    draw_lucide_icon(c, PIN_ICON, cx, cy, 18)


def draw_dollar_icon(c, cx, cy):
    draw_lucide_icon(c, DOLLAR_ICON, cx, cy, 18)


def draw_cookie_icon(c, cx, cy):
    draw_lucide_icon(c, COOKIE_ICON, cx, cy, 18)


def draw_detail_row(c, cy, lines, icon_drawer, card_x, card_w, size=9.7, line_height=13):
    cx = card_x + 29
    c.setFillColor(SAGE)
    c.circle(cx, cy, 15.5, stroke=0, fill=1)
    icon_drawer(c, cx, cy)
    text_x = card_x + 58
    text_y = cy + ((len(lines) - 1) * line_height / 2) - 2.5
    c.setFillColor(INK)
    c.setFont(BODY_MEDIUM, size)
    for line in lines:
        c.drawString(text_x, text_y, line)
        text_y -= line_height


c = canvas.Canvas(str(OUT), pagesize=letter)
c.setTitle("Tending the Healer - Retreat Flyer")
c.setAuthor("Threshold Therapy & Consulting")

# Keep the Letter page size while extending the cream artwork to both page edges.
c.setFillColor(CREAM)
c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

# Hero
LEFT = 54
c.setFillColor(DEEP)
c.setFont(SERIF_MEDIUM, 55)
c.drawString(LEFT, 715, "Tending")
c.drawString(LEFT, 649, "the Healer")
draw_ornament(c, LEFT, 312, 620)
draw_tracked(
    c,
    "A RETREAT FOR HEALTHCARE PROFESSIONALS",
    LEFT,
    597,
    SERIF_BOLD,
    10.2,
    0.22,
    RUST,
)
draw_trimmed_image(c, WHEEL, 322, 536, 254, 246)

# Intro copy
paragraphs = [
    "Healthcare professionals witness loss, suffering, and profound moments of humanity every day. While we are often called to care for others, we rarely have dedicated space to care for the grief we carry ourselves.",
    "This restorative retreat invites healthcare professionals to slow down, reconnect with themselves, and gently tend to grief related to patient loss, cumulative caregiving, moral distress, personal loss, and the many invisible burdens carried in this work.",
    "Together, we will explore self-compassion, reflection, meaningful ritual, community, and Indigenous teachings rooted in the Medicine Wheel. Participants will be invited to honor their experiences, reconnect with inner resilience, and develop practices to support well-being in both personal and professional lives.",
    "Held at the House of Welcome Longhouse at The Evergreen State College in Olympia, this retreat welcomes healthcare professionals from all disciplines and backgrounds. No prior experience with Indigenous teachings or mindfulness practices is needed - only a willingness to come as you are.",
]
y = 568
for index, paragraph in enumerate(paragraphs):
    y = draw_wrapped(c, paragraph, LEFT, y, 239, size=10.5, leading=12)
    if index < len(paragraphs) - 1:
        y -= 13

# Retreat details card
CARD_X, CARD_Y, CARD_W, CARD_H = 331, 274, 230, 260
c.setFillColor(PALE)
c.setStrokeColor(LINE)
c.setLineWidth(0.75)
c.roundRect(CARD_X, CARD_Y, CARD_W, CARD_H, 17, fill=1, stroke=1)
c.setFillColor(DEEP)
c.setFont(SERIF_MEDIUM, 24.5)
c.drawCentredString(CARD_X + CARD_W / 2, 500, "Retreat Details")
draw_ornament(c, CARD_X + 45, CARD_X + CARD_W - 45, 486)

detail_rows = [
    (463, ["Saturday,", "October 10th, 2026"], draw_calendar_icon, 9.7, 13),
    (426, ["9:30am - 4:00pm"], draw_clock_icon, 9.7, 13),
    (383, ["House of Welcome Longhouse,", "Evergreen State College,", "Olympia, WA"], draw_pin_icon, 9.7, 13),
    (339, ["Cost per person: $195", "(discount available for", "enrolled tribal members)"], draw_dollar_icon, 9.7, 13),
    (296, ["Beverages & light refreshments", "provided. Bring lunch or", "purchase at Evergreen dining."], draw_cookie_icon, 9.7, 13),
]
for index, (cy, lines, icon, size, line_height) in enumerate(detail_rows):
    draw_detail_row(c, cy, lines, icon, CARD_X, CARD_W, size, line_height)
    if index < len(detail_rows) - 1:
        separator_y = (cy + detail_rows[index + 1][0]) / 2
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.7)
        c.setDash(0.8, 1.8)
        c.line(CARD_X + 14, separator_y, CARD_X + CARD_W - 14, separator_y)
        c.setDash()

# Facilitators
FAC_X, FAC_Y, FAC_W, FAC_H = 54, 109, 504, 148
c.setFillColor(PALE)
c.setStrokeColor(LINE)
c.setLineWidth(0.7)
c.roundRect(FAC_X, FAC_Y, FAC_W, FAC_H, 14, fill=1, stroke=1)
draw_centered_tracked(c, "FACILITATORS", PAGE_W / 2, 236, SERIF_MEDIUM, 15.5, 0.8, DEEP)

PORTRAIT_DIAMETER = 91
draw_circle_photo(c, AKASHA, 128, 169, PORTRAIT_DIAMETER)
draw_circle_photo(c, KARI, 379, 169, PORTRAIT_DIAMETER)

c.setFillColor(DEEP)
c.setFont(BODY_SEMIBOLD, 9.5)
c.drawString(187, 218, "Akasha Balkman, LICSW")
c.drawString(438, 218, "Kari Hilwig, LICSW")

akasha_bio = (
    "Licensed Clinical Social Worker, Pediatric Palliative Care Specialist at Seattle Children's Hospital, founder of Sweetgrass & Sage Counseling, and co-founder of Hello Angel. As an enrolled member of the Yankton Sioux Tribe, she integrates Indigenous teachings, traditional practices, and the Medicine Wheel framework into her work."
)
kari_bio = (
    "Licensed Clinical Social Worker and psychotherapist specializing in serious and chronic illness, grief and loss, and supporting caregivers. Her background in palliative care and oncology social work informs her relational, existential, and strengths-based approach."
)
draw_wrapped(c, akasha_bio, 187, 203, 116, size=6.45, leading=9.35)
draw_wrapped(c, kari_bio, 438, 203, 109, size=6.35, leading=9.35)
c.setStrokeColor(LINE)
c.setLineWidth(0.65)
c.line(319, 117, 319, 208)

# Registration footer
FOOT_X, FOOT_Y, FOOT_W, FOOT_H = 54, 16, 504, 75
c.setFillColor(PALE)
c.setStrokeColor(LINE)
c.setLineWidth(0.7)
c.roundRect(FOOT_X, FOOT_Y, FOOT_W, FOOT_H, 14, fill=1, stroke=1)
draw_trimmed_image(c, HUMMINGBIRD, 56, 20, 124, 66)

c.setFillColor(DEEP)
c.setFont(SERIF_MEDIUM, 18)
c.drawCentredString(247, 66, "Register by")
c.setFillColor(RUST)
c.setFont(BOLD, 12.8)
c.drawCentredString(247, 42, "SEPTEMBER 25TH, 2026")
draw_ornament(c, 220, 274, 27)

c.setStrokeColor(GOLD)
c.setLineWidth(0.7)
c.line(339, 20, 339, 84)
CTA_X, CTA_Y, CTA_W, CTA_H = 360, 56, 108, 25
c.setFillColor(RUST)
c.roundRect(CTA_X, CTA_Y, CTA_W, CTA_H, 9, fill=1, stroke=0)
c.setFillColor(colors.white)
c.setFont(BOLD, 14)
c.drawCentredString(CTA_X + CTA_W / 2, CTA_Y + 7.5, "Register")
c.linkURL(REGISTRATION_URL, (CTA_X, CTA_Y, CTA_X + CTA_W, CTA_Y + CTA_H), relative=0)
c.setFillColor(RUST)
c.setFont(BODY_SEMIBOLD, 8.2)
c.drawString(360, 42, "tinyurl.com/tend-healer")
c.linkURL(REGISTRATION_URL, (360, 40, 457, 51), relative=0)
c.setFillColor(INK)
c.setFont(BODY_SEMIBOLD, 8.2)
c.drawCentredString(512, 20, "Scan to register")
draw_qr_svg(c, QR, 486, 29, 53)

c.showPage()
c.save()
print(f"Created: {OUT}")
