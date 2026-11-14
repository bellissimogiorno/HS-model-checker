#!/usr/bin/env python3
"""Check, commit and push the generated public HSM repository in one command.

First publication: python3 tools/push_github.py --repo OWNER/REPO --create
Later updates:     python3 tools/push_github.py
Read-only preview: python3 tools/push_github.py --dry-run

Python 3, Git and Node 20+ are required. GitHub CLI (`gh auth login`) is
required for explicit repository creation and automatic Pages configuration.
The script never force-pushes, resets, pulls, rebases or deletes user files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
MARKER = "PUBLICATION.json"
BRANCH = "main"


class PublishError(Exception):
    """An actionable refusal or failed publishing operation."""


def command(args, *, check=True, stream=False):
    result = subprocess.run(args, cwd=ROOT, text=True,
                            stdout=None if stream else subprocess.PIPE,
                            stderr=None if stream else subprocess.PIPE)
    if check and result.returncode:
        detail = (result.stderr or result.stdout or "").strip()
        raise PublishError(f"{args[0]} command failed (exit {result.returncode})."
                           + ("\n" + detail if detail else ""))
    return result


def git(*args, check=True):
    return command(["git", "--literal-pathspecs", *args], check=check)


def safe_name(name):
    if not isinstance(name, str) or not name or "\\" in name or ":" in name:
        raise PublishError("Invalid managed file path in PUBLICATION.json.")
    path = PurePosixPath(name)
    if (path.is_absolute() or "/".join(path.parts) != name
            or any(part in (".", "..", ".git", ".hsm-patches", ".hsm-sync") for part in path.parts)
            or any(ord(c) < 32 for c in name)):
        raise PublishError(f"Unsafe managed file path: {name!r}")
    return name


def managed_files(raw=None):
    try:
        data = json.loads((ROOT / MARKER).read_text(encoding="utf-8") if raw is None else raw)
        if data.get("format") != "hsm-public-repository/v1" or not isinstance(data.get("files"), list):
            raise ValueError("wrong format")
        names = [safe_name(name) for name in data["files"]]
        if len(set(names)) != len(names) or MARKER in names:
            raise ValueError("duplicate files or marker lists itself")
        if not {"VERSION", "package.json", "README.md", "MANIFEST.sha256"} <= set(names):
            raise ValueError("required files are not listed")
        return set(names) | {MARKER}
    except (OSError, ValueError, TypeError, AttributeError) as error:
        raise PublishError("Run this script inside the generated public repository: "
                           "PUBLICATION.json must contain its complete managed file list.") from error


def inspect_files(names):
    for name in sorted(names):
        path = ROOT
        for part in PurePosixPath(name).parts:
            path = path / part
            if path.is_symlink():
                raise PublishError(f"Managed paths must not be symbolic links: {name}")
        if not path.is_file():
            raise PublishError(f"Managed file is missing: {name}. Update PUBLICATION.json for deliberate additions/removals.")
    try:
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise PublishError("Cannot read VERSION/package.json.") from error
    if not re.fullmatch(r"\d+\.\d+\.\d+", version) or package.get("version") != version:
        raise PublishError("VERSION and package.json must state the same x.y.z version.")
    return version


def repository_state(names):
    """Require this exact directory, a normal checkout, and only managed paths."""
    found = git("rev-parse", "--show-toplevel", check=False)
    if found.returncode:
        if (ROOT / ".git").exists():
            raise PublishError("The local .git directory cannot be read; repair it before publishing.")
        # Ask Git to interpret .gitignore before creating a repository or making
        # any remote change. Its disposable metadata stays outside the export.
        with tempfile.TemporaryDirectory(prefix="hsm-public-inspect-") as temporary:
            command(["git", "init", "--quiet", temporary])
            listing = command(["git", "--git-dir", str(Path(temporary) / ".git"),
                               "--work-tree", str(ROOT), "ls-files", "--others",
                               "--exclude-standard", "-z"])
        extra = untracked_public_files(listing.stdout) - names
        if extra:
            raise PublishError("Unmanaged repository files must be moved elsewhere or deliberately listed "
                               "in PUBLICATION.json before first publication:\n  "
                               + "\n  ".join(sorted(extra)[:20]))
        return False, set(names)
    if Path(found.stdout.strip()).resolve() != ROOT:
        raise PublishError("This directory belongs to a parent Git repository. Export beside it instead.")
    if (ROOT / ".git").is_symlink() or not (ROOT / ".git").is_dir():
        raise PublishError("Use a normal standalone checkout, not a linked worktree or indirect .git file.")
    current = git("symbolic-ref", "--short", "HEAD", check=False)
    if current.returncode or current.stdout.strip() != BRANCH:
        raise PublishError("Check out the main branch before publishing; the Pages workflow deploys main.")
    if git("ls-files", "--unmerged").stdout:
        raise PublishError("Resolve existing Git conflicts before publishing.")
    old = git("show", f"HEAD:{MARKER}", check=False)
    allowed = names | (managed_files(old.stdout) if not old.returncode else set())
    tracked = set(filter(None, git("ls-files", "-z").stdout.split("\0")))
    extra = tracked - allowed
    extra |= untracked_public_files(git("ls-files", "--others", "--exclude-standard", "-z").stdout) - names
    if extra:
        raise PublishError("Unmanaged repository files would be left outside this publication. "
                           "Move them elsewhere or deliberately list public files in PUBLICATION.json:\n  "
                           + "\n  ".join(sorted(extra)[:20]))
    for retired in allowed - names:
        if (ROOT / retired).exists() or (ROOT / retired).is_symlink():
            raise PublishError(f"Removed managed file still exists: {retired}. Move it elsewhere before publishing.")
    return True, allowed


def untracked_public_files(listing):
    """Sync originals/journals stay local even with an older .gitignore.

    Tracked unexpected files are still refused by repository_state; this only
    recognises the updater's untracked bookkeeping, never publication inputs.
    """
    return {name for name in listing.split("\0") if name
            and name != ".hsm-sync" and not name.startswith(".hsm-sync/")}


def require_git_identity(exists):
    """Explain first-run identity setup before any source or Git mutation."""
    for identity in ("GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"):
        result = git("var", identity, check=False)
        if result.returncode:
            instructions = [
                "Git needs your commit name and email; GitHub login does not set them.",
                f"From this generated repository directory ({ROOT}), run:",
            ]
            if not exists:
                instructions.append("  git init -b main")
            instructions.extend([
                '  git config user.name "YOUR NAME"',
                '  git config user.email "YOUR_EMAIL_ADDRESS"',
                "Replace both placeholders with your own details, then retry this command.",
                "For a private email, copy your exact noreply address from GitHub Settings → Emails.",
                "These settings apply only to this repository. No files or remote settings were changed.",
            ])
            raise PublishError("\n".join(instructions))


def github_repo(url):
    """Parse ordinary GitHub HTTPS/SSH remotes, rejecting embedded credentials."""
    match = re.fullmatch(r"git@github\.com:([^/]+/[^/]+?)(?:\.git)?", url)
    if match:
        return match[1]
    parts = urlsplit(url)
    if parts.scheme == "https" and parts.hostname == "github.com" and not parts.username and not parts.password:
        path = parts.path.strip("/")
        if not parts.query and not parts.fragment and re.fullmatch(r"[^/]+/[^/]+", path):
            return path[:-4] if path.endswith(".git") else path
    if parts.scheme == "ssh" and parts.hostname == "github.com" and parts.username == "git" and not parts.password:
        path = parts.path.strip("/")
        if not parts.query and not parts.fragment and re.fullmatch(r"[^/]+/[^/]+", path):
            return path[:-4] if path.endswith(".git") else path
    return None


def remote_state(exists, requested, no_pages):
    if not exists:
        if not requested:
            raise PublishError("For first publication, supply --repo OWNER/REPO "
                               "(and --create to create a new public GitHub repository).")
        return None, requested
    remote = git("remote", "get-url", "origin", check=False)
    if remote.returncode:
        if not requested:
            raise PublishError("No origin remote. Supply --repo OWNER/REPO.")
        return None, requested
    fetch_urls = git("config", "--get-all", "remote.origin.url").stdout.splitlines()
    push_urls = git("remote", "get-url", "--push", "--all", "origin").stdout.splitlines()
    if len(fetch_urls) != 1 or len(push_urls) != 1:
        raise PublishError("Use exactly one origin URL and one matching push destination.")
    repository = github_repo(remote.stdout.strip())
    push_repository = github_repo(push_urls[0])
    if repository:
        if not push_repository or push_repository.lower() != repository.lower():
            raise PublishError("origin's fetch and push destinations differ; fix the remote before publishing.")
        if requested and requested.lower() != repository.lower():
            raise PublishError("--repo differs from the existing origin; no remote was changed.")
    elif requested or not no_pages or push_urls[0] != remote.stdout.strip():
        raise PublishError("origin must be a matching GitHub remote. Local/other remotes require --no-pages and no --repo.")
    return remote.stdout.strip(), repository


def refresh_manifest(names):
    lines = []
    for name in sorted(names - {"MANIFEST.sha256"}):
        digest = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        lines.append(f"{digest}  {name}\n")
    descriptor, temporary = tempfile.mkstemp(prefix=".hsm-manifest-", dir=ROOT)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            output.writelines(lines)
        os.chmod(temporary, 0o644)
        os.replace(temporary, ROOT / "MANIFEST.sha256")
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def ensure_remote_history():
    heads = git("ls-remote", "--heads", "origin", f"refs/heads/{BRANCH}")
    if not heads.stdout.strip():
        return
    if git("rev-parse", "--verify", "HEAD", check=False).returncode:
        raise PublishError("origin/main already has history. Clone that repository and copy the generated files into it; "
                           "this script does not replace or merge remote history.")
    git("fetch", "--no-tags", "origin", f"refs/heads/{BRANCH}:refs/remotes/origin/{BRANCH}")
    if git("merge-base", "--is-ancestor", f"origin/{BRANCH}", "HEAD", check=False).returncode:
        raise PublishError("origin/main has commits absent locally. Integrate them with Git, then rerun; "
                           "nothing was reset, merged or force-pushed.")


def configure_pages(repository):
    endpoint = f"repos/{repository}/pages"
    current = command(["gh", "api", endpoint, "--jq", ".build_type"], check=False)
    if current.returncode:
        if "404" not in (current.stderr or ""):
            raise PublishError("Cannot inspect GitHub Pages settings. Check gh authentication and repository permissions.\n"
                               + (current.stderr or ""))
        command(["gh", "api", "--method", "POST", endpoint, "-f", "build_type=workflow"])
    elif current.stdout.strip() != "workflow":
        command(["gh", "api", "--method", "PUT", endpoint, "-f", "build_type=workflow"])
    # Enabling Pages can race the initial push-triggered workflow. An explicit
    # dispatch after configuration gives that first publication a reliable run.
    command(["gh", "workflow", "run", "pages.yml", "--repo", repository, "--ref", BRANCH])
    site = command(["gh", "api", endpoint, "--jq", ".html_url"], check=False)
    if site.returncode == 0 and site.stdout.strip().startswith("https://"):
        print("Site URL: " + site.stdout.strip())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", metavar="OWNER/REPO", help="GitHub destination; required for first publication")
    parser.add_argument("--create", action="store_true", help="explicitly create a NEW PUBLIC GitHub repository")
    parser.add_argument("--message", help="commit message (default: Publish HSM VERSION)")
    parser.add_argument("--dry-run", action="store_true", help="read-only preview; no rebuild, Git writes or network requests")
    parser.add_argument("--no-pages", action="store_true", help="skip Pages setup; does not disable an existing deployment workflow")
    args = parser.parse_args(argv)
    pushed = False
    try:
        if args.repo and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+", args.repo):
            raise PublishError("--repo must be OWNER/REPO, without a URL, whitespace or credentials.")
        if args.create and not args.repo:
            raise PublishError("--create requires --repo OWNER/REPO.")
        if args.message is not None and (not args.message.strip() or "\0" in args.message):
            raise PublishError("Use a nonempty commit message without NUL characters.")
        if not shutil.which("git"):
            raise PublishError("Install Git before publishing.")
        names = managed_files()
        version = inspect_files(names)
        exists, allowed = repository_state(names)
        remote, repository = remote_state(exists, args.repo, args.no_pages)
        if args.create and remote:
            raise PublishError("origin already exists. Omit --create for updates; no remote was changed.")
        if args.dry_run:
            print(f"Read-only preview: HSM {version}, {len(names)} managed files, branch main.")
            print("Would rebuild the reader, refresh checksums, run Node/Python tests and replay verification.")
            print("Would " + ("create a public GitHub repository, " if args.create else "")
                  + "commit managed changes if needed and push to origin/main.")
            if not args.no_pages:
                print("Would configure GitHub Pages for Actions and run pages.yml.")
            print("No files, Git state or remote settings were changed; remote history was not contacted.")
            return 0
        for executable in ["node", *( ["gh"] if args.create or not args.no_pages else [] )]:
            if not shutil.which(executable):
                raise PublishError(f"Install {executable} before publishing. "
                                   + ("Run gh auth login for GitHub access, or use --no-pages for push-only updates." if executable == "gh" else "Node 20 or later is required."))
        # Keep identity refusal read-only, including a first run before init.
        require_git_identity(exists)
        print("Rebuilding the reader and checking the public repository...", flush=True)
        command(["node", "tools/build-reader.mjs"], stream=True)
        refresh_manifest(names)
        command(["node", "--test"], stream=True)
        command([sys.executable, "-m", "unittest", "discover", "-s", "test", "-p", "test_*.py"], stream=True)
        try:
            command(["node", "tools/verify-package.mjs", "--replay"], stream=True)
        except PublishError as error:
            raise PublishError(str(error) + "\nNo commit or push was attempted. If theory sources changed, regenerate "
                               "their evidence with: node demo.mjs --output reports/weakening-tour, then rerun.") from error
        if args.create:
            command(["gh", "repo", "create", args.repo, "--public", "--description", "History Structure Model-checker: a proof-of-concept for history structures and heterogeneous reliable broadcast"])
        if not exists:
            git("init", "-b", BRANCH)
        if not remote:
            git("remote", "add", "origin", f"https://github.com/{args.repo}.git")
        # This also rejects unexpected untracked/staged files after first init.
        _, allowed = repository_state(names)
        ensure_remote_history()
        git("diff", "--check")
        paths = sorted(allowed)
        for start in range(0, len(paths), 100):
            # A retired path may never have been committed; do not pass nonexistent
            # and untracked pathspecs to git add. Existing/known tracked paths are safe.
            batch = [name for name in paths[start:start + 100]
                     if (ROOT / name).exists() or git("ls-files", "--error-unmatch", "--", name, check=False).returncode == 0]
            if batch:
                git("add", "--", *batch)
        if git("diff", "--cached", "--quiet", check=False).returncode:
            git("commit", "-m", args.message or f"Publish HSM {version}")
        else:
            print("No managed file changes to commit.")
        git("push", "--set-upstream", "origin", f"HEAD:refs/heads/{BRANCH}")
        pushed = True
        if not args.no_pages:
            configure_pages(repository)
            print(f"Pushed main. GitHub Pages deployment requested: https://github.com/{repository}/actions")
            print("Deployment runs asynchronously; its workflow page reports the final site URL and any failure.")
        else:
            print("Pushed main; Pages settings were left unchanged.")
        return 0
    except (PublishError, OSError, UnicodeError) as error:
        print("Publishing stopped: " + str(error), file=sys.stderr)
        if pushed:
            print("The Git commit was already pushed. Rerun this command to retry Pages configuration/deployment; "
                  "it will not make another commit unless files changed.", file=sys.stderr)
        else:
            print("No force-push or automatic history rewrite was performed. Local edits and any new local commit remain available.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
