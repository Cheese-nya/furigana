import hashlib
import importlib.util
import logging
import sys
import tempfile
import threading
import time
import types
import unittest
import unittest.mock
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# The launcher only needs pywebview for the window, which these tests never open.
sys.modules.setdefault('webview', types.ModuleType('webview'))
spec = importlib.util.spec_from_file_location('desktop_runner', Path(__file__).resolve().parents[1] / 'desktop_runner.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)

PACKAGE = b'MZ' + b'fake-windows-binary' * 8
SHA = hashlib.sha256(PACKAGE).hexdigest()


def make_args(**overrides):
    args = {
        'version': '1.3.0',
        'url': 'https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/Uku-Furigana-v1.3.0-windows.exe',
        'sha256': SHA,
        'size': len(PACKAGE),
    }
    args.update(overrides)
    return args


def wait_for(predicate, timeout=5.0):
    start = time.time()
    while time.time() - start < timeout:
        if predicate():
            return True
        time.sleep(0.02)
    return False


class FakeFetch:
    """Stands in for http_download: serves `payload` per URL or raises."""

    def __init__(self, payloads, fail=()):
        self.payloads = payloads
        self.fail = set(fail)
        self.calls = []

    def __call__(self, url, destination, on_progress, is_cancelled):
        self.calls.append(url)
        if url in self.fail:
            raise OSError(f'cannot reach {url}')
        payload = self.payloads[url]
        Path(destination).write_bytes(payload)
        on_progress(len(payload))


class ValidateArgsTest(unittest.TestCase):
    def test_accepts_well_formed_args(self):
        mirror = 'https://uku.saiaino.xyz/api/update/dl/v1.3.0/file.exe'
        validated = launcher.validate_update_args(make_args(mirrorUrl=mirror))
        self.assertEqual(validated['version'], '1.3.0')
        self.assertEqual(validated['mirrorUrl'], mirror)

    def test_mirror_is_optional(self):
        self.assertIsNone(launcher.validate_update_args(make_args())['mirrorUrl'])
        self.assertIsNone(launcher.validate_update_args(make_args(mirrorUrl=''))['mirrorUrl'])

    def test_rejects_bad_version(self):
        for version in ('v1.3.0', '1.3', '1.3.0.1', '1.3.0-beta', '', None, 130):
            with self.assertRaises(ValueError):
                launcher.validate_update_args(make_args(version=version))

    def test_rejects_non_https_urls(self):
        for url in ('http://github.com/x.exe', 'ftp://x/y.exe', 'file:///c:/x.exe', '', None):
            with self.assertRaises(ValueError):
                launcher.validate_update_args(make_args(url=url))
            if url in ('', None):
                continue  # an absent mirror is allowed
            with self.assertRaises(ValueError):
                launcher.validate_update_args(make_args(mirrorUrl=url))

    def test_rejects_bad_checksum(self):
        for sha in (SHA.upper(), SHA[:-1], 'z' * 64, '', None):
            with self.assertRaises(ValueError):
                launcher.validate_update_args(make_args(sha256=sha))

    def test_rejects_bad_size_and_shape(self):
        with self.assertRaises(ValueError):
            launcher.validate_update_args(make_args(size=0))
        with self.assertRaises(ValueError):
            launcher.validate_update_args(make_args(size=-1))
        with self.assertRaises(ValueError):
            launcher.validate_update_args(make_args(size='1024'))
        with self.assertRaises(ValueError):
            launcher.validate_update_args(make_args(size=True))
        with self.assertRaises(ValueError):
            launcher.validate_update_args(None)
        with self.assertRaises(ValueError):
            launcher.validate_update_args('1.3.0')

    def test_accepts_an_integral_float_size(self):
        self.assertEqual(launcher.validate_update_args(make_args(size=float(len(PACKAGE))))['size'], len(PACKAGE))


class UpdateDownloaderTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.directory = Path(self._tmp.name) / 'updates'

    def downloader(self, fetch):
        instance = launcher.UpdateDownloader(self.directory, fetch=fetch)
        self.addCleanup(instance.join, 5.0)
        return instance

    def test_downloads_verifies_and_marks_ready(self):
        fetch = FakeFetch({make_args()['url']: PACKAGE})
        downloader = self.downloader(fetch)
        result = downloader.start(launcher.validate_update_args(make_args()))
        self.assertEqual(result, {'success': True})
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready'))
        state = downloader.state()
        self.assertEqual(state['version'], '1.3.0')
        self.assertEqual(state['progress'], 1.0)
        self.assertNotIn('error', state)
        package = self.directory / 'UkuFurigana-v1.3.0.exe'
        self.assertEqual(package.read_bytes(), PACKAGE)
        self.assertFalse((self.directory / 'UkuFurigana-v1.3.0.exe.part').exists())
        self.assertEqual(downloader.package_path(), package)

    def test_progress_reaches_partial_values(self):
        progress = []
        payload = PACKAGE

        def fetch(url, destination, on_progress, is_cancelled):
            with open(destination, 'wb') as handle:
                for index in range(len(payload)):
                    handle.write(payload[index:index + 1])
                    on_progress(1)
                    progress.append(downloader.state()['progress'])

        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args()))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready'))
        self.assertTrue(any(0 < value < 1 for value in progress))

    def test_falls_back_to_mirror_when_primary_fails(self):
        primary = make_args()['url']
        mirror = 'https://uku.saiaino.xyz/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0-windows.exe'
        fetch = FakeFetch({primary: PACKAGE, mirror: PACKAGE}, fail={primary})
        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args(mirrorUrl=mirror)))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready'))
        self.assertEqual(fetch.calls, [primary, mirror])

    def test_reports_download_failed_when_both_sources_fail(self):
        primary = make_args()['url']
        mirror = 'https://uku.saiaino.xyz/dl/file.exe'
        fetch = FakeFetch({primary: PACKAGE, mirror: PACKAGE}, fail={primary, mirror})
        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args(mirrorUrl=mirror)))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'error'))
        self.assertEqual(downloader.state()['error'], 'download-failed')
        self.assertFalse((self.directory / 'UkuFurigana-v1.3.0.exe.part').exists())
        self.assertIsNone(downloader.package_path())

    def test_checksum_mismatch_deletes_the_partial_file(self):
        fetch = FakeFetch({make_args()['url']: PACKAGE})
        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args(sha256='0' * 64)))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'error'))
        self.assertEqual(downloader.state()['error'], 'checksum-mismatch')
        self.assertEqual(list(self.directory.glob('*')), [])
        self.assertIsNone(downloader.package_path())

    def test_rejects_a_package_without_an_mz_header(self):
        payload = b'PK' + b'not-a-windows-binary' * 8
        fetch = FakeFetch({make_args()['url']: payload})
        downloader = self.downloader(fetch)
        args = make_args(size=len(payload), sha256=hashlib.sha256(payload).hexdigest())
        downloader.start(launcher.validate_update_args(args))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'error'))
        self.assertEqual(downloader.state()['error'], 'invalid-package')
        self.assertEqual(list(self.directory.glob('*.exe')), [])

    def test_cancel_stops_the_download_and_removes_the_part_file(self):
        def fetch(url, destination, on_progress, is_cancelled):
            with open(destination, 'wb') as handle:
                for _ in range(200):
                    if is_cancelled():
                        raise launcher.UpdateCancelled()
                    handle.write(b'MZ')
                    on_progress(2)
                    time.sleep(0.01)

        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args(size=400)))
        self.assertTrue(wait_for(lambda: (self.directory / 'UkuFurigana-v1.3.0.exe.part').exists()))
        self.assertEqual(downloader.cancel(), {'success': True})
        downloader.join(5.0)
        self.assertEqual(downloader.state()['phase'], 'idle')
        self.assertFalse((self.directory / 'UkuFurigana-v1.3.0.exe.part').exists())
        self.assertIsNone(downloader.package_path())

    def test_repeat_call_while_ready_keeps_the_existing_package(self):
        fetch = FakeFetch({make_args()['url']: PACKAGE})
        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args()))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready'))
        self.assertEqual(downloader.start(launcher.validate_update_args(make_args())), {'success': True})
        self.assertEqual(len(fetch.calls), 1)
        self.assertEqual(downloader.state()['phase'], 'ready')
        # The verified package is kept on disk instead of being downloaded again.
        self.assertTrue((self.directory / 'UkuFurigana-v1.3.0.exe').is_file())

    def test_repeat_call_while_downloading_is_ignored(self):
        def fetch(url, destination, on_progress, is_cancelled):
            Path(destination).write_bytes(b'')
            time.sleep(0.4)
            with open(destination, 'ab') as handle:
                handle.write(PACKAGE)
            on_progress(len(PACKAGE))

        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args()))
        self.assertEqual(downloader.start(launcher.validate_update_args(make_args())), {'success': True})
        # A different version cannot start while the first download is running.
        other = launcher.validate_update_args(make_args(version='1.4.0'))
        self.assertEqual(downloader.start(other), {'success': False, 'error': 'busy'})
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready', timeout=10.0))
        self.assertEqual(downloader.state()['version'], '1.3.0')

    def test_start_clears_leftovers_of_other_versions(self):
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / 'UkuFurigana-v1.2.0.exe').write_bytes(b'MZ old')
        (self.directory / 'UkuFurigana-v1.2.0.exe.part').write_bytes(b'MZ partial')
        fetch = FakeFetch({make_args()['url']: PACKAGE})
        downloader = self.downloader(fetch)
        downloader.start(launcher.validate_update_args(make_args()))
        self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready'))
        self.assertEqual(sorted(path.name for path in self.directory.iterdir()), ['UkuFurigana-v1.3.0.exe'])


class BuildApplyScriptTest(unittest.TestCase):
    def test_waits_for_pid_quotes_paths_and_can_roll_back(self):
        script = launcher.build_apply_script(
            4321,
            r'C:\Users\me\AppData\Local\Programs\Uku Furigana\UkuFurigana.exe',
            r'C:\Users\me\AppData\Local\UkuFurigana\updates\UkuFurigana-v1.3.0.exe',
        )
        self.assertIn('tasklist /NH /FI "PID eq 4321"', script)
        self.assertIn('findstr /C:" 4321 "', script)
        # A pipeline aborts the detached, console-less helper before the swap (found on real Windows).
        self.assertFalse(any('|' in line for line in script.split('\r\n')), script)
        self.assertIn('ping -n 2 127.0.0.1', script)
        self.assertIn('GEQ 30', script)
        self.assertGreaterEqual(script.count('ping -n 5 127.0.0.1'), 2)  # settle before the swap and before cleanup
        self.assertIn('goto wait', script)
        self.assertIn('"C:\\Users\\me\\AppData\\Local\\Programs\\Uku Furigana\\UkuFurigana.exe"', script)
        self.assertIn('.exe.old"', script)
        self.assertIn('move /y', script)
        self.assertIn('copy /y', script)
        self.assertIn(':rollback', script)
        self.assertIn(':relaunch_old', script)
        self.assertIn('start ""', script)
        # The old file is removed only on the success path.
        success = script.split(':rollback')[0]
        self.assertIn('del /f /q', success)

    def test_escapes_percent_signs_in_paths(self):
        script = launcher.build_apply_script(7, r'C:\100%\Uku.exe', r'C:\updates\new.exe')
        self.assertIn(r'"C:\100%%\Uku.exe"', script)
        self.assertIn('tasklist /NH /FI "PID eq 7"', script)


class HttpDownloadTest(unittest.TestCase):
    """Exercises the real urllib download path against a local server."""

    def setUp(self):
        payload = PACKAGE * 200
        self.payload = payload

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                try:
                    self.send_response(200)
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = HTTPServer(('127.0.0.1', 0), Handler)
        self.addCleanup(self.server.server_close)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.shutdown)
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def test_streams_the_body_and_reports_progress(self):
        destination = Path(self._tmp.name) / 'download.part'
        received = []
        url = f'http://127.0.0.1:{self.server.server_port}/file.exe'
        launcher.http_download(url, destination, lambda count: received.append(count), lambda: False)
        self.assertEqual(destination.read_bytes(), self.payload)
        self.assertEqual(sum(received), len(self.payload))

    def test_honours_the_cancel_callback(self):
        destination = Path(self._tmp.name) / 'download.part'
        url = f'http://127.0.0.1:{self.server.server_port}/file.exe'
        with self.assertRaises(launcher.UpdateCancelled):
            launcher.http_download(url, destination, lambda count: None, lambda: True)


class StaleBackupTest(unittest.TestCase):
    def test_removes_the_old_copy_next_to_a_working_exe(self):
        with tempfile.TemporaryDirectory() as directory:
            exe = Path(directory) / 'UkuFurigana.exe'
            exe.write_bytes(PACKAGE)
            backup = Path(directory) / 'UkuFurigana.exe.old'
            backup.write_bytes(PACKAGE)
            self.assertTrue(launcher.cleanup_stale_backup(exe))
            self.assertFalse(backup.exists())
            self.assertTrue(exe.exists())
            self.assertFalse(launcher.cleanup_stale_backup(exe))

    def test_keeps_the_backup_when_the_exe_looks_broken(self):
        with tempfile.TemporaryDirectory() as directory:
            exe = Path(directory) / 'UkuFurigana.exe'
            exe.write_bytes(b'not-an-executable')
            backup = Path(directory) / 'UkuFurigana.exe.old'
            backup.write_bytes(PACKAGE)
            self.assertFalse(launcher.cleanup_stale_backup(exe))
            self.assertTrue(backup.exists())


class CleanupUpdateDirTest(unittest.TestCase):
    def test_drops_helper_script_and_partial_downloads_only(self):
        with tempfile.TemporaryDirectory() as directory:
            updates = Path(directory) / 'updates'
            self.assertIsNone(launcher.cleanup_update_dir(updates))
            updates.mkdir()
            (updates / 'apply_update.bat').write_text('@echo off', encoding='utf-8')
            (updates / 'UkuFurigana-v1.3.0.exe.part').write_bytes(b'MZ part')
            (updates / 'UkuFurigana-v1.3.0.exe').write_bytes(PACKAGE)
            launcher.cleanup_update_dir(updates)
            self.assertEqual([path.name for path in updates.iterdir()], ['UkuFurigana-v1.3.0.exe'])


class ReadLogTailTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / 'uku.log'

    def test_missing_file_returns_empty_string(self):
        self.assertEqual(launcher.read_log_tail(self.path), '')

    def test_returns_only_the_tail_of_a_large_file(self):
        lines = [f'line {index:05d} ' + 'x' * 90 for index in range(2000)]
        self.path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        tail = launcher.read_log_tail(self.path, limit=1024)
        self.assertLessEqual(len(tail.encode('utf-8')), 1024)
        self.assertTrue(tail.endswith(lines[-1] + '\n'))
        self.assertNotIn(lines[0], tail)
        self.assertTrue(tail.startswith('line '))

    def test_default_limit_is_64_kb(self):
        payload = 'y' * (200 * 1024)
        self.path.write_text(payload, encoding='utf-8')
        self.assertEqual(len(launcher.read_log_tail(self.path).encode('utf-8')), launcher.LOG_TAIL_BYTES)

    def test_api_get_log_reads_from_the_data_dir(self):
        data_dir = Path(self._tmp.name) / 'data'
        logs = data_dir / 'logs'
        logs.mkdir(parents=True)
        (logs / 'uku.log').write_text('started\n', encoding='utf-8')
        api = launcher.Api(data_dir)
        self.assertIn('started', api.get_log())
        self.assertEqual(launcher.Api(Path(self._tmp.name) / 'empty').get_log(), '')


class LoggingSetupTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.data_dir = Path(self._tmp.name)
        root = logging.getLogger()
        self._handlers = list(root.handlers)
        self._level = root.level
        self.addCleanup(self._restore)

    def _restore(self):
        root = logging.getLogger()
        for handler in list(root.handlers):
            if handler not in self._handlers:
                root.removeHandler(handler)
                handler.close()
        root.setLevel(self._level)

    def test_configures_a_rotating_handler_in_the_data_dir(self):
        path = launcher.setup_logging(self.data_dir)
        self.assertEqual(path, self.data_dir / 'logs' / 'uku.log')
        logging.getLogger('uku.test').info('hello log')
        for handler in logging.getLogger().handlers:
            handler.flush()
        text = (self.data_dir / 'logs' / 'uku.log').read_text(encoding='utf-8')
        self.assertIn('INFO uku.test: hello log', text)

    def test_uncaught_exceptions_are_written_to_the_log(self):
        launcher.setup_logging(self.data_dir)
        self.addCleanup(setattr, sys, 'excepthook', sys.excepthook)
        self.addCleanup(setattr, threading, 'excepthook', threading.excepthook)
        launcher.install_exception_logging()
        try:
            raise RuntimeError('boom')
        except RuntimeError:
            sys.excepthook(*sys.exc_info())
        for handler in logging.getLogger().handlers:
            handler.flush()
        text = (self.data_dir / 'logs' / 'uku.log').read_text(encoding='utf-8')
        self.assertIn('CRITICAL uku.crash: Uncaught exception', text)
        self.assertIn('RuntimeError: boom', text)


class UpdateApiTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.api = launcher.Api(self._tmp.name)

    def test_initial_state_is_idle(self):
        self.assertEqual(self.api.update_state(), {'phase': 'idle', 'progress': 0.0})

    def test_download_rejects_invalid_arguments_without_raising(self):
        result = self.api.update_download(make_args(sha256='nope'))
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'invalid-sha256')
        self.assertEqual(self.api.update_state()['phase'], 'idle')
        self.assertFalse(self.api.update_download(None)['success'])

    def test_cancel_always_succeeds(self):
        self.assertEqual(self.api.update_cancel(), {'success': True})

    def test_apply_refuses_in_development_mode(self):
        result = self.api.update_apply()
        self.assertEqual(result, {'success': False, 'error': 'not-frozen'})
        self.assertFalse((Path(self._tmp.name) / 'updates' / 'apply_update.bat').exists())


class FrozenApplyTest(unittest.TestCase):
    def test_writes_a_quoted_helper_and_launches_it_detached(self):
        fetch = FakeFetch({make_args()['url']: PACKAGE})
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            api = launcher.Api(root)
            downloader = launcher.UpdateDownloader(root / 'updates', fetch=fetch)
            api._downloader = downloader
            downloader.start(launcher.validate_update_args(make_args()))
            self.assertTrue(wait_for(lambda: downloader.state()['phase'] == 'ready'))

            launched = []
            quits = []

            def fake_popen(*args, **kwargs):
                launched.append((args, kwargs))

            with unittest.mock.patch.object(sys, 'frozen', True, create=True), \
                    unittest.mock.patch.object(launcher.subprocess, 'Popen', fake_popen), \
                    unittest.mock.patch.object(api, '_schedule_quit', lambda: quits.append(True)):
                result = api.update_apply()

            self.assertEqual(result, {'success': True})
            self.assertEqual(len(launched), 1)
            self.assertEqual(quits, [True])
            args, kwargs = launched[0]
            script = Path(args[0][2])
            self.assertEqual(script, root / 'updates' / 'apply_update.bat')
            self.assertTrue(kwargs['close_fds'])
            self.assertEqual(kwargs['creationflags'] & 0x00000008, 0x00000008)
            self.assertEqual(kwargs['creationflags'] & 0x00000200, 0x00000200)
            text = script.read_text(encoding='utf-8')
            package = root / 'updates' / 'UkuFurigana-v1.3.0.exe'
            self.assertIn('"' + str(Path(sys.executable)) + '.old"', text)
            self.assertIn('"' + str(package) + '"', text)

    def test_apply_without_a_ready_package_reports_an_error(self):
        with tempfile.TemporaryDirectory() as directory:
            api = launcher.Api(directory)
            with unittest.mock.patch.object(sys, 'frozen', True, create=True), \
                    unittest.mock.patch.object(api, '_schedule_quit', lambda: None):
                result = api.update_apply()
            self.assertEqual(result, {'success': False, 'error': 'no-update'})


class TestHostTest(unittest.TestCase):
    def test_http_is_refused_unless_a_test_host_is_named(self):
        import os
        url = 'http://192.168.122.1:8788/api/update/dl/v1.2.2/Uku-Furigana-v1.2.2-windows.exe'
        os.environ.pop('UKU_UPDATE_TEST_HOST', None)
        self.assertFalse(launcher._is_https_url(url))
        os.environ['UKU_UPDATE_TEST_HOST'] = '192.168.122.1:8788'
        try:
            self.assertTrue(launcher._is_https_url(url))
            self.assertFalse(launcher._is_https_url('http://evil.example/x.exe'))
        finally:
            os.environ.pop('UKU_UPDATE_TEST_HOST', None)


class RelaunchEnvironmentTest(unittest.TestCase):
    def test_strips_the_old_extraction_dir_and_resets_pyinstaller(self):
        env = launcher.relaunch_environment({
            '_MEIPASS2': r'C:\\Temp\\_MEI123', '_PYI_APPLICATION_HOME_DIR': 'x', '_PYI_PARENT_PROCESS_LEVEL': '1',
            'PATH': 'keep', 'UKU_UPDATE_TEST_HOST': 'h',
        })
        self.assertEqual(env['PYINSTALLER_RESET_ENVIRONMENT'], '1')
        self.assertNotIn('_MEIPASS2', env)
        self.assertFalse([k for k in env if k.startswith('_PYI_')])
        self.assertEqual(env['PATH'], 'keep')
        self.assertEqual(env['UKU_UPDATE_TEST_HOST'], 'h')


if __name__ == '__main__':
    unittest.main()
