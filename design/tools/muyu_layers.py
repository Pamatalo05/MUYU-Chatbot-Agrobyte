"""Convierte las capas JPEG de Muyu en PNG transparentes alineadas.

Quita solo el fondo blanco conectado al borde (no el relleno crema interno),
separa las 3 variantes de ojos y las coloca a la altura del visor.
Uso (requiere numpy, pillow y scipy):
    python design/tools/muyu_layers.py design/muyu-original web/public/muyu
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

LAYERS = {
    "brote.jpeg": "sprout",
    "brazo-izquierdo.jpeg": "arm-left",
    "brazo-derecho.jpeg": "arm-right",
    "visor.jpeg": "visor",
    "cabeza.jpeg": "head",
    "cuerpo.jpeg": "body",
}
EYES_FILE = "ojos.jpeg"


def remove_background(rgb: np.ndarray) -> np.ndarray:
    """Devuelve RGBA con el fondo blanco (conectado al borde) transparente."""
    near_white = (rgb.astype(int).min(axis=2) > 225)
    labels, _ = ndimage.label(near_white)
    border = np.unique(np.concatenate(
        [labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])
    # Suavizar el borde: 1 px de transición
    alpha = np.where(background, 0, 255).astype(np.uint8)
    alpha = ndimage.uniform_filter(alpha.astype(float), size=3).astype(np.uint8)
    alpha[~ndimage.binary_dilation(~background, iterations=1)] = 0
    return np.dstack([rgb, alpha])


MIN_AREA = 300  # px: elimina manchas sueltas del JPEG
SCALE = 0.5     # 1254 px -> 627 px, suficiente para mostrar a ~300 px en 2x


def clean_specks(rgba: np.ndarray) -> np.ndarray:
    labels, count = ndimage.label(rgba[..., 3] > 0)
    if count:
        areas = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
        small = np.isin(labels, np.nonzero(areas < MIN_AREA)[0] + 1)
        rgba = rgba.copy()
        rgba[small, 3] = 0
    return rgba


def save(rgba: np.ndarray, name: str) -> None:
    image = Image.fromarray(clean_specks(rgba), "RGBA")
    size = round(image.width * SCALE)
    image.resize((size, size), Image.LANCZOS).save(
        OUT / f"{name}.png", optimize=True)


def bbox(alpha: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha > 0)
    return ys.min(), ys.max(), xs.min(), xs.max()


for file_name, name in LAYERS.items():
    rgb = np.array(Image.open(SRC / file_name).convert("RGB"))
    rgba = remove_background(rgb)
    save(rgba, name)
    print(name, "bbox (y0,y1,x0,x1):", bbox(rgba[..., 3]))

# Ojos: 3 filas (abiertos, felices, ^^). Se recortan y se alinean
# verticalmente al centro de la fila "abiertos", que ya está sobre el visor.
eyes = remove_background(np.array(Image.open(SRC / EYES_FILE).convert("RGB")))
rows = (eyes[..., 3] > 0).any(axis=1)
row_labels, count = ndimage.label(rows)
print("filas de ojos encontradas:", count)
names = ["eyes-open", "eyes-happy", "eyes-closed-happy"]
spans = [np.nonzero(row_labels == i + 1)[0] for i in range(count)]
target_center = int(spans[0].mean())
for name, span in zip(names, spans):
    layer = np.zeros_like(eyes)
    y0, y1 = span.min(), span.max()
    shift = target_center - int(span.mean())
    layer[y0 + shift:y1 + 1 + shift] = eyes[y0:y1 + 1]
    save(layer, name)
    print(name, "rows", y0, y1, "shift", shift)
