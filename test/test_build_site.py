"""Check Pages artifact boundaries and project-subpath HTTP serving."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import tempfile
from threading import Thread
import unittest
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('hsm_build_site', ROOT / 'tools/build_site.py')
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


class PagesArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='.hsm-site-test-', dir=ROOT.parent)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'source with spaces'
        self.root.mkdir()
        self.contents = {'index.html': '<link href="src/style.css"><script type="module" src="src/app.mjs"></script>',
                         'theories.html': '<a href="index.html">Checker</a>', 'src/app.mjs': 'export const ready=true;',
                         'src/worker.mjs': 'postMessage("ready");', 'src/style.css': 'body {color:navy}',
                         'assets/font.woff': 'font', 'docs/guide.md': 'Guide', 'VERSION': '0.6.9\n'}
        for name, content in self.contents.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        (self.root / 'PUBLIC_RELEASE.json').write_text(json.dumps({'format': 'hsm-public-release/v1', 'profile': 'public', 'version': '0.6.9'}))
        (self.root / '.env').write_text('TOKEN=private')
        self.names = sorted([*self.contents, '.env', 'tools/push_github.py'])
        self.save_list()

    def save_list(self):
        (self.root / 'PUBLICATION.json').write_text(json.dumps({'format': 'hsm-public-repository/v1', 'files': self.names}))

    def test_project_subpath_assets_load_with_javascript_mime_and_private_files_are_absent(self):
        parent = Path(self.temp.name) / 'web'
        output = parent / 'project-name'
        self.assertEqual(build.stage(self.root, output), len(self.contents))
        self.assertFalse((output / '.env').exists())
        self.assertFalse((output / 'tools').exists())
        class QuietHandler(SimpleHTTPRequestHandler):
            def log_message(self, *_args):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(parent)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f'http://127.0.0.1:{server.server_port}/project-name/'
            for name, expected in self.contents.items():
                with urlopen(base + name, timeout=5) as response:
                    self.assertEqual(response.read().decode(), expected)
                    if name.endswith('.mjs'):
                        self.assertIn(response.headers.get_content_type(), ['text/javascript', 'application/javascript'])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_existing_output_and_source_directory_are_never_replaced(self):
        output = Path(self.temp.name) / 'existing'
        output.mkdir()
        (output / 'user.txt').write_text('preserve')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            build.stage(self.root, output)
        self.assertEqual((output / 'user.txt').read_text(), 'preserve')
        with self.assertRaisesRegex(ValueError, 'separate'):
            build.stage(self.root, self.root)

    def test_unsafe_path_or_symbolic_link_is_rejected_before_output(self):
        output = Path(self.temp.name) / 'site'
        self.names.append('../outside')
        self.save_list()
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            build.stage(self.root, output)
        self.assertFalse(output.exists())
        self.names.remove('../outside')
        self.save_list()
        source = self.root / 'src/app.mjs'
        source.unlink()
        source.symlink_to(self.root / 'src/worker.mjs')
        with self.assertRaisesRegex(ValueError, 'symbolic'):
            build.stage(self.root, output)
        self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
