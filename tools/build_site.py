#!/usr/bin/env python3
"""Stage a clean copy of the public web files for GitHub Pages.

Run in the generated public repository (not the maintenance installation):

    python3 tools/build_site.py
    python3 tools/build_site.py --output "/path/to/new-site-directory"

The default output is a new _site directory inside the public checkout. Existing
outputs are refused: choose a new path or deliberately remove an old build after
checking it. The command reads PUBLICATION.json and stages only the listed web
assets, theories, guides and evidence. It does not stage Git data or run tests,
commit, push or deploy. The Pages workflow uploads this staged directory.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tempfile


ROOT = Path(__file__).resolve().parent.parent
WEB_DIRECTORIES = {'assets', 'docs', 'examples', 'reports', 'src'}
WEB_FILES = {'index.html', 'theories.html', 'VERSION', 'LICENSE', 'UPSTREAM.md', 'README.md', '.nojekyll'}


def stage(root: Path, output: Path) -> int:
    """Publish a new directory, preserving existing outputs and source files."""
    root = root.resolve()
    if output.is_symlink():
        raise ValueError('The output must not be a symbolic link.')
    output = output.resolve()
    if output == root or root.is_relative_to(output):
        raise ValueError('Choose an output directory separate from the source.')
    if output.is_relative_to(root) and output.relative_to(root).parts[0] != '_site':
        raise ValueError('Inside the repository, use _site; otherwise choose an external output directory.')
    if output.exists():
        raise ValueError(f'Output already exists: {output}. Choose an unused --output directory.')
    profile = json.loads((root / 'PUBLIC_RELEASE.json').read_text(encoding='utf-8'))
    if profile.get('format') != 'hsm-public-release/v1' or profile.get('profile') != 'public':
        raise ValueError('Run this command in the generated public repository.')
    if profile.get('version') != (root / 'VERSION').read_text().strip():
        raise ValueError('PUBLIC_RELEASE.json and VERSION disagree.')
    publication = json.loads((root / 'PUBLICATION.json').read_text(encoding='utf-8'))
    if publication.get('format') != 'hsm-public-repository/v1':
        raise ValueError('Expected a generated public repository file list.')
    names = publication.get('files')
    if not isinstance(names, list) or len(names) != len(set(names)):
        raise ValueError('Malformed or duplicated public repository paths.')
    selected = []
    for name in names:
        if not isinstance(name, str):
            raise ValueError('Repository paths must be strings.')
        path = PurePosixPath(name)
        if not path.parts or path.is_absolute() or '..' in path.parts or path.as_posix() != name or '\\' in name:
            raise ValueError(f'Unsafe repository path: {name!r}')
        if path.parts[0] not in WEB_DIRECTORIES and name not in WEB_FILES:
            continue
        source = root
        for part in path.parts:
            source = source / part
            if source.is_symlink():
                raise ValueError(f'Refusing symbolic link: {name}')
        if not source.is_file():
            raise ValueError(f'Missing web file: {name}')
        selected.append((name, source))
    if not {'index.html', 'theories.html', 'src/app.mjs', 'src/worker.mjs', 'src/style.css'} <= {name for name, _ in selected}:
        raise ValueError('Public file list is missing required web assets.')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.hsm-site-', dir=output.parent))
    try:
        for name, source in selected:
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        if output.exists() or output.is_symlink():
            raise ValueError('Output appeared while building; no existing output was replaced.')
        os.rename(temporary, output)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return len(selected)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--output', type=Path, default=ROOT / '_site', help='New output directory (default: repository/_site)')
    args = parser.parse_args()
    try:
        count = stage(ROOT, args.output)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, f'Cannot build Pages site: {error}\n')
    print(f'Built {count} public web files: {args.output.resolve()}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
