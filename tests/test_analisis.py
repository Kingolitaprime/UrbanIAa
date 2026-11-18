import unittest
import io

import numpy as np
from PIL import Image

import analisis


class CompararTest(unittest.TestCase):
    def test_overlay_usa_la_nueva_paleta_de_cambios(self):
        mascara = {
            "nuevas": np.array([[True, False, False, False]]),
            "verde_a_urbano": np.array([[False, True, False, False]]),
            "verde_perdido": np.array([[False, False, True, False]]),
            "verde_ganado": np.array([[False, False, False, True]]),
        }

        with Image.open(io.BytesIO(analisis.overlay_png(mascara))) as imagen:
            self.assertEqual(imagen.mode, "RGBA")
            self.assertEqual([imagen.getpixel((x, 0)) for x in range(imagen.width)], [
                (220, 38, 38, 215), (153, 27, 27, 240),
                (255, 255, 255, 200), (125, 211, 252, 170),
            ])

    def test_coberturas_reparten_toda_el_area_valida(self):
        inicio = np.full((20, 20), analisis.CL_SUELO, dtype=np.uint8)
        inicio[:, :5] = analisis.CL_VEG
        inicio[:, 5:10] = analisis.CL_URBANO
        inicio[:, 10:15] = analisis.CL_AGUA
        fin = inicio.copy()
        fin[:, :5] = analisis.CL_URBANO

        stats, _, _, coberturas = analisis.comparar(inicio, fin, 1)

        for periodo in ("inicio", "fin"):
            clases = coberturas[periodo]
            self.assertAlmostEqual(sum(clase["pct"] for clase in clases.values()), 100.0)
            self.assertAlmostEqual(sum(clase["ha"] for clase in clases.values()), stats["ha_analizadas"])
        self.assertGreater(coberturas["inicio"]["agua"]["ha"], 0)
        self.assertGreater(coberturas["fin"]["urbano"]["ha"], coberturas["inicio"]["urbano"]["ha"])

    def test_falla_si_no_hay_pixeles_validos_comunes(self):
        invalido = np.full((2, 2), analisis.CL_INVALIDO, dtype=np.uint8)
        with self.assertRaisesRegex(ValueError, "No hay píxeles válidos"):
            analisis.comparar(invalido, invalido, 1)


if __name__ == "__main__":
    unittest.main()
