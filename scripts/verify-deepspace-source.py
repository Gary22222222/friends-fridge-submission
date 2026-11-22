"""Verify the review snapshot against its immutable DeepSpace release manifest."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Also check the public platform release stamp and health endpoint')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    manifest = json.loads((repo / 'release/deepspace.json').read_text(encoding='utf-8'))
    app = (repo / 'deepspace-app').resolve()
    expected = manifest['source_files']

    def git(*argv: str) -> str:
        return subprocess.check_output(['git', '-c', 'core.autocrlf=input', *argv], cwd=repo, text=True, stderr=subprocess.PIPE).strip()

    if git('rev-parse', 'HEAD:deepspace-app') != manifest['cloud_tree']:
        print('Committed application tree differs from the cloud source tree.', file=sys.stderr)
        return 1
    paths = git('ls-files', '--cached', '--others', '--exclude-standard', 'deepspace-app').splitlines()
    actual = {Path(path).relative_to('deepspace-app').as_posix() for path in paths if (repo / path).is_file()}
    problems = [f'Missing: {path}' for path in sorted(set(expected) - actual)]
    problems += [f'Extra: {path}' for path in sorted(actual - set(expected))]
    for path in sorted(set(expected) & actual):
        target = (app / path).resolve()
        if not target.is_relative_to(app) or '.git' in target.relative_to(app).parts:
            problems.append(f'Invalid path: {path}')
            continue
        relative = target.relative_to(repo).as_posix()
        # Git's text filters normalize Windows line endings; binary bytes stay exact.
        oid = git('hash-object', f'--path={relative}', relative)
        if oid != expected[path]:
            problems.append(f'Changed: {path}')
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        return 1
    print(f"Verified {len(expected)} app files against DeepSpace commit {manifest['cloud_commit']}.")
    if args.live:
        origin = manifest['live_url'].rstrip('/')

        def fetch(path: str) -> dict:
            request = urllib.request.Request(origin + path + '?verify=' + str(time.time_ns()), headers={'Cache-Control': 'no-cache', 'User-Agent': 'FriendsFridge-ReleaseVerifier/1.0'})
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.loads(response.read(65536))

        stamp = fetch('/.well-known/deepspace/release.json')
        if stamp.get('release') != manifest['release_stamp']:
            print('Live release stamp differs from the reviewed release.', file=sys.stderr)
            return 1
        health = fetch('/api/health')
        if health.get('status') != 'ok' or health.get('lookup_protocol') != 'lookup-v1':
            print('Live database/lookup health check failed.', file=sys.stderr)
            return 1
        print(f"Live release {manifest['release_id']} and lookup health confirmed.")
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f'Verification failed: {error}', file=sys.stderr)
        raise SystemExit(1)
