"""
Furigana Dubbing Studio - Native Standalone Windows Desktop Launcher
Bundles static Next.js export with built-in HTTP server & PyWebView Window mode.
"""

import sys
import os
import time
import socket
import threading
import urllib.request
from http.server import SimpleHTTPRequestHandler, HTTPServer
import webview


def get_free_port():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def get_bundle_dir():
    if getattr(sys, 'frozen', False):
        # Running inside PyInstaller EXE bundle
        return os.path.join(sys._MEIPASS, 'out')
    else:
        # Running in regular Python dev environment
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')


def start_http_server(web_dir, port, ready_event):
    """Start HTTP server and signal when ready."""
    class QuietHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=web_dir, **kwargs)

        def log_message(self, format, *args):
            pass  # Suppress HTTP request logs

    server = HTTPServer(('127.0.0.1', port), QuietHandler)
    ready_event.set()  # Signal that server is bound and listening
    server.serve_forever()


def wait_for_server(port, timeout=10):
    """Block until the HTTP server responds on the given port."""
    url = f"http://127.0.0.1:{port}/"
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = urllib.request.urlopen(url, timeout=2)
            if resp.status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


import base64


class Api:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def save_file(self, filename, base64_data):
        """Open native Windows Save File Dialog and write base64 file data."""
        try:
            if not self._window:
                return {'success': False, 'error': 'Window not ready'}

            ext = os.path.splitext(filename)[1].lower()
            if ext == '.docx':
                file_types = ('Word Document (*.docx)', 'All files (*.*)')
            elif ext == '.srt':
                file_types = ('SubRip Subtitle (*.srt)', 'All files (*.*)')
            else:
                file_types = ('Text Document (*.txt)', 'All files (*.*)')

            file_path = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=filename,
                file_types=file_types
            )

            if file_path:
                if isinstance(file_path, (list, tuple)):
                    if not file_path:
                        return {'success': False, 'error': 'Cancelled'}
                    file_path = file_path[0]

                raw_bytes = base64.b64decode(base64_data)
                with open(file_path, 'wb') as f:
                    f.write(raw_bytes)
                return {'success': True, 'path': file_path}
            else:
                return {'success': False, 'error': 'Cancelled'}
        except Exception as e:
            return {'success': False, 'error': str(e)}


def main():
    # Resolve static web assets directory
    web_dir = get_bundle_dir()

    if not os.path.exists(web_dir) or not os.path.isfile(os.path.join(web_dir, 'index.html')):
        # Write error to a log file next to the EXE for debugging
        log_path = os.path.join(os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else __file__), 'error.log')
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write(f"Error: Static web build not found at: {web_dir}\n")
        sys.exit(1)

    # Pick a free port and start the embedded server
    port = get_free_port()
    ready_event = threading.Event()

    server_thread = threading.Thread(target=start_http_server, args=(web_dir, port, ready_event), daemon=True)
    server_thread.start()

    # Wait for the server thread to bind the port
    ready_event.wait(timeout=5)

    # Wait for the server to actually respond to HTTP requests
    if not wait_for_server(port, timeout=10):
        log_path = os.path.join(os.path.dirname(sys.executable if getattr(sys, 'frozen', False) else __file__), 'error.log')
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write(f"Error: HTTP server failed to start on port {port}\n")
        sys.exit(1)

    url = f"http://127.0.0.1:{port}"

    # Use PyWebView for a stable, dedicated application window with Native Save Dialog API bridge
    api = Api()
    window = webview.create_window('Furigana Dubbing Studio', url, width=1280, height=830, js_api=api)
    api.set_window(window)
    webview.start(private_mode=False)


if __name__ == '__main__':
    main()
