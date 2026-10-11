import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest

# Storage does not require a GUI; isolate the launcher from pywebview here.
sys.modules.setdefault('webview', types.ModuleType('webview'))
spec = importlib.util.spec_from_file_location('desktop_runner', Path(__file__).resolve().parents[1] / 'desktop_runner.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class DesktopCorrectionsTest(unittest.TestCase):
    def test_corrections_survive_new_api_instance_and_unicode_titles(self):
        with tempfile.TemporaryDirectory() as directory:
            api = launcher.Api(directory)
            self.assertEqual(api.load_corrections(), {})
            data = {'歪な鳥篭': [{'line': '二人で', 'start': 0, 'surface': '二人', 'reading': 'ふたり', 'type': 'hiragana'}]}
            self.assertTrue(api.save_corrections(data)['success'])
            self.assertEqual(launcher.Api(directory).load_corrections(), data)
            self.assertFalse((Path(directory) / 'corrections.tmp').exists())
            self.assertTrue(api.save_corrections({'歪な鳥篭': []})['success'])
            self.assertEqual(launcher.Api(directory).load_corrections(), {'歪な鳥篭': []})

    def test_invalid_data_does_not_replace_existing_corrections(self):
        with tempfile.TemporaryDirectory() as directory:
            api = launcher.Api(directory)
            api.save_corrections({'test': []})
            self.assertFalse(api.save_corrections(None)['success'])
            self.assertEqual(api.load_corrections(), {'test': []})


if __name__ == '__main__':
    unittest.main()
