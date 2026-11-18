import os
import sys
import types
import unittest
from unittest.mock import patch

import ia


class InformeFallbackTest(unittest.TestCase):
    def _stats(self):
        return {
            "ha_analizadas": 100.0,
            "pct_pixeles_validos": 90.0,
            "ha_urbanas_inicio": 20.0,
            "ha_urbanas_fin": 32.0,
            "ha_urbanizadas": 12.0,
            "ha_verdes_perdidas": 4.0,
            "ha_verdes_ganadas": 2.0,
            "ha_verde_a_urbano": 3.0,
            "pct_verde_inicio": 25.0,
            "pct_verde_fin": 20.0,
        }

    def _escenas(self):
        return (
            {"satelite": "Sentinel-2", "fecha": "01/05/2020", "nubes": 5.0},
            {"satelite": "Sentinel-2", "fecha": "01/05/2024", "nubes": 4.0},
        )

    def test_error_de_gemini_no_interrumpe_el_informe(self):
        class Cliente:
            class models:
                @staticmethod
                def generate_content(**_):
                    raise RuntimeError("error simulado")

        genai = types.ModuleType("google.genai")
        genai.Client = lambda **_: Cliente()
        genai_types = types.SimpleNamespace(
            Part=types.SimpleNamespace(from_bytes=lambda **_: None),
            GenerateContentConfig=lambda **_: None,
        )
        genai.types = genai_types
        google = types.ModuleType("google")
        google.genai = genai
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), patch.dict(
                sys.modules, {"google": google, "google.genai": genai}):
            informe = ia.generar_informe(
                {"nombre": "Ciudad de prueba", "cluster": "Gran Córdoba"},
                (2020, 2024), self._stats(), [], self._escenas())

        self.assertTrue(informe["es_fallback"])
        self.assertIn("SIN inteligencia artificial", informe["impacto_ambiental"])

    def test_falta_de_clave_genera_informe_alternativo_completo(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            informe = ia.generar_informe(
                {"nombre": "Ciudad de prueba", "cluster": "Gran Córdoba"},
                (2020, 2024), self._stats(), [], self._escenas())

        self.assertTrue(informe["es_fallback"])
        self.assertEqual(informe["modelo"], "reglas (sin IA)")
        for campo in ("diagnostico", "impacto_ambiental", "recomendaciones", "limitaciones"):
            self.assertTrue(informe[campo])

    def test_prompt_incluye_cobertura_fisica(self):
        texto = ia._detalle_para_prompt({
            "parcelas": [],
            "direcciones": [],
            "coberturas": {
                "inicio": {"agua": {"ha": 3.2, "pct": 4.0}},
                "fin": {"agua": {"ha": 4.1, "pct": 5.0}},
            },
        })

        self.assertIn("agua: 3.2 ha (4.0 %)", texto)
        self.assertIn("agua: 4.1 ha (5.0 %)", texto)


if __name__ == "__main__":
    unittest.main()
