"""Generate the PWA icon assets without network access."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent / "public"
for size in (192, 512):
    image = Image.new("RGB", (size, size), "#112830")
    draw = ImageDraw.Draw(image)
    scale = size / 512
    points = [(92, 310), (124, 256), (162, 235), (204, 144), (222, 114),
              (290, 114), (308, 144), (350, 235), (388, 256), (420, 310),
              (420, 380), (92, 380)]
    draw.polygon([(int(x * scale), int(y * scale)) for x, y in points], fill="#73e8b3")
    for x in (164, 348):
        draw.ellipse(tuple(int(v * scale) for v in (x-30, 288, x+30, 348)), fill="#112830")
    draw.polygon([(int(x * scale), int(y * scale)) for x, y in [(192,240),(219,182),(293,182),(320,240)]], fill="#112830")
    image.save(root / f"icon-{size}.png", optimize=True)
