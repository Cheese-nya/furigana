#!/usr/bin/env python3
"""Local stand-in for the production relay, serving a fake release from a directory.

  dev_relay.py --dir <releases> --public-base http://10.0.2.2:8788

The directory holds the files of ONE release: Uku-Furigana-vX.Y.Z.apk and/or
Uku-Furigana-vX.Y.Z-windows.exe (SHA256SUMS.txt is generated when missing). The real relay code runs
unchanged; only its GitHub layer is replaced, so /api/update/latest, the mirror download (with Range)
and /api/feedback behave exactly as in production. Feedback "issues" are appended to <dir>/issues.jsonl.
"""
import argparse
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'server' / 'relay'))
import relay  # noqa: E402

ASSET = re.compile(r'^Uku-Furigana-v(\d+\.\d+\.\d+)(\.apk|-windows\.exe)$')


class LocalRelease(relay.GitHubClient):
    def __init__(self, directory, public_base):
        super().__init__(token='local-test-token')
        self.directory = Path(directory)
        self.public_base = public_base.rstrip('/')
        self.issue_count = 0

    def _assets(self):
        return sorted(p for p in self.directory.iterdir() if ASSET.match(p.name))

    def get_latest_release(self):
        assets = self._assets()
        if not assets:
            raise relay.GitHubError('no release files in ' + str(self.directory))
        version = ASSET.match(assets[0].name).group(1)
        sums = self.directory / 'SHA256SUMS.txt'
        sums.write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in assets), encoding='utf-8')
        listed = assets + [sums]
        return {
            'tag_name': f'v{version}',
            'body': f'Local test release v{version}',
            'assets': [{'name': p.name, 'size': p.stat().st_size, 'browser_download_url': f'{self.public_base}/api/update/dl/v{version}/{p.name}'} for p in listed],
        }

    def fetch_text(self, url):
        return (self.directory / url.rsplit('/', 1)[-1]).read_text(encoding='utf-8')

    def download_asset(self, tag, name, dest_path, url=None):
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes((self.directory / name).read_bytes())

    def create_issue(self, title, body, labels):
        self.issue_count += 1
        with (self.directory / 'issues.jsonl').open('a', encoding='utf-8') as out:
            out.write(json.dumps({'number': self.issue_count, 'title': title, 'labels': labels, 'body': body}, ensure_ascii=False) + '\n')
        return {'number': self.issue_count, 'url': f'http://local.test/issues/{self.issue_count}'}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dir', required=True)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8788)
    parser.add_argument('--public-base', required=True, help='URL the device uses to reach this server, e.g. http://10.0.2.2:8788')
    args = parser.parse_args()
    service = relay.RelayService(
        github_client=LocalRelease(args.dir, args.public_base),
        cache_dir=tempfile.mkdtemp(prefix='uku-dev-relay-'),
        allowed_origins=relay.DEFAULT_ALLOWED_ORIGINS,
        mirror_base=args.public_base,
    )
    server = relay.create_server(service, bind=args.host, port=args.port)
    relay.log_stdout(f'dev relay on http://{args.host}:{args.port} serving {args.dir}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
