#!/usr/bin/env python3
"""Serve this package on localhost without third-party dependencies."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import webbrowser

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true', help='Open the checker in the default browser')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('--port must be between 0 and 65535 (0 chooses an available port)')
    root = str(Path(__file__).resolve().parent)
    handler = partial(SimpleHTTPRequestHandler, directory=root)
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(2, f'Cannot start checker: {error}. Try another --port.\n')
    url = f'http://127.0.0.1:{server.server_address[1]}/'
    print(f'History Structure Model-checker: {url}\nPress Ctrl+C to stop.', flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
