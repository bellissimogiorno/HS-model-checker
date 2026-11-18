#!/usr/bin/env python3
"""Offline publisher integration tests: real Git, bare remotes, fake Node/gh.

Run: python3 -m unittest discover -s test -p 'test_push_github.py' -v
No test contacts GitHub or any other network service.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "tools/push_github.py"
REAL_GIT = shutil.which("git")


def snapshot(root):
    return {path.relative_to(root).as_posix(): (path.read_bytes(), path.stat().st_mode & 0o777)
            for path in root.rglob("*") if path.is_file()}


@unittest.skipUnless(REAL_GIT, "Git is required for the offline integration tests")
class PublisherTests(unittest.TestCase):
    def setUp(self):
        # Do not let a platform's temporary-directory fallback put fixtures
        # inside the real checkout being published and tested.
        self.temporary = tempfile.TemporaryDirectory(prefix="hsm-push-test-", dir=SOURCE.parent.parent.parent)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "public checkout with spaces"
        self.root.mkdir()
        self.remote = self.base / "remote.git"
        self.bin = self.base / "bin"
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ.get("PATH", ""),
                        GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=str(self.base / "git-global"),
                        GIT_CEILING_DIRECTORIES=str(self.base),
                        GIT_AUTHOR_NAME="HSM local test", GIT_AUTHOR_EMAIL="test@example.invalid",
                        GIT_COMMITTER_NAME="HSM local test", GIT_COMMITTER_EMAIL="test@example.invalid",
                        HSM_TEST_LOG=str(self.base / "commands.jsonl"),
                        HSM_TEST_REMOTE=str(self.remote), HSM_REAL_GIT=REAL_GIT,
                        HSM_TEST_GH_STATE=str(self.base / "gh-state"))
        for key in ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]:
            self.env.pop(key, None)
        self.files = {
            "VERSION": "0.7.1\n", "package.json": '{"version":"0.7.1"}\n',
            "README.md": "# Public checker\n", "MANIFEST.sha256": "",
            ".gitignore": "__pycache__/\n*.pyc\n",
            "src/value.mjs": "export const value = 1;\n",
            "tools/build-reader.mjs": "// fixture\n",
            "tools/verify-package.mjs": "// fixture\n",
            "tools/push_github.py": SOURCE.read_text(encoding="utf-8"),
            "test/test_fixture.py": "import unittest\nclass Fixture(unittest.TestCase):\n def test_check(self): self.assertTrue(True)\n",
        }
        for name, text in self.files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        self.marker()
        self.executable("node", '''import json,os,sys
with open(os.environ['HSM_TEST_LOG'],'a') as log:log.write(json.dumps(['node',*sys.argv[1:]])+'\\n')
sys.exit(7 if os.environ.get('HSM_TEST_NODE_FAIL')==sys.argv[1] else 0)
''')
        self.executable("gh", '''import json,os,sys
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['HSM_TEST_LOG'],'a') as log:log.write(json.dumps(['gh',*args])+'\\n')
state=Path(os.environ['HSM_TEST_GH_STATE'])
if args[:2]==['repo','create']:
 state.write_text('absent')
elif args[:1]==['api']:
 if '--method' in args:
  state.write_text('workflow')
 elif '--jq' in args and args[args.index('--jq')+1]=='.html_url':
  print('https://example.github.io/Checker/')
 elif not state.exists() or state.read_text()=='absent':
  print('gh: Not Found (HTTP 404)',file=sys.stderr);sys.exit(1)
 else:print(state.read_text())
elif args[:2]==['workflow','run'] and os.environ.get('HSM_TEST_DISPATCH_FAIL'):
 print('test dispatch failure',file=sys.stderr);sys.exit(1)
''')
        # For the fake-gh first-publication test only, transport commands use a
        # local bare remote while the checked origin remains a GitHub URL.
        self.executable("git", '''import os,sys
args=sys.argv[1:]
if os.environ.get('HSM_TEST_ROUTE_GITHUB'):
 for name in ['ls-remote','fetch','push']:
  if name in args:
   args=[os.environ['HSM_TEST_REMOTE'] if a=='origin' else a for a in args]
   break
os.execv(os.environ['HSM_REAL_GIT'],[os.environ['HSM_REAL_GIT'],*args])
''')
        self.git("init", "--bare", "-b", "main", str(self.remote), cwd=self.base)

    def executable(self, name, source):
        path = self.bin / name
        path.write_text(f"#!{sys.executable}\n" + source, encoding="utf-8")
        path.chmod(0o755)

    def marker(self):
        (self.root / "PUBLICATION.json").write_text(json.dumps({
            "format": "hsm-public-repository/v1", "files": sorted(self.files)
        }, indent=2) + "\n", encoding="utf-8")

    def git(self, *args, cwd=None, check=True):
        result = subprocess.run([REAL_GIT, *args], cwd=cwd or self.root, env=self.env,
                                text=True, capture_output=True)
        if check:
            self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def init_checkout(self, github=False):
        self.git("init", "-b", "main")
        self.git("remote", "add", "origin", "https://github.com/Example/Checker.git" if github else str(self.remote))
        if github:
            self.env["HSM_TEST_ROUTE_GITHUB"] = "1"

    def remove_test_identity(self):
        for name in ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL"]:
            self.env.pop(name, None)
        # Deterministic refusal rather than depending on hostname-based email
        # inference. This is a fixture-only global config outside the checkout.
        (self.base / "git-global").write_text("[user]\n\tuseConfigOnly = true\n")

    def push(self, *args, ok=True):
        result = subprocess.run([sys.executable, str(self.root / "tools/push_github.py"), *args],
                                cwd=self.base, env=self.env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0 if ok else 1, result.stdout + result.stderr)
        return result

    def log(self):
        path = self.base / "commands.jsonl"
        return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []

    def head(self, remote=False):
        return self.git("rev-parse", "main", cwd=self.remote if remote else self.root).stdout.strip()

    def test_first_push_update_and_noop_use_real_bare_git(self):
        self.init_checkout()
        self.push("--no-pages")
        first = self.head()
        self.assertEqual(first, self.head(remote=True))
        (self.root / "src/value.mjs").write_text("export const value = 2;\n")
        self.push("--no-pages", "--message", "Change value")
        second = self.head()
        self.assertNotEqual(second, first)
        self.assertEqual(second, self.head(remote=True))
        self.assertEqual(self.git("log", "-1", "--format=%s").stdout.strip(), "Change value")
        result = self.push("--no-pages")
        self.assertEqual(self.head(), second)
        self.assertIn("No managed file changes", result.stdout)
        for line in (self.root / "MANIFEST.sha256").read_text().splitlines():
            digest, name = line.split("  ", 1)
            self.assertEqual(digest, hashlib.sha256((self.root / name).read_bytes()).hexdigest())

    def test_dry_run_does_not_create_git_or_rebuild_or_contact_remote(self):
        before = snapshot(self.root)
        result = self.push("--repo", "Example/Checker", "--create", "--dry-run")
        self.assertEqual(snapshot(self.root), before)
        self.assertFalse((self.root / ".git").exists())
        self.assertEqual(self.log(), [])
        self.assertIn("No files, Git state or remote settings", result.stdout)

    def test_fresh_fixture_is_isolated_even_when_its_parent_is_a_git_repository(self):
        self.git("init", "-b", "main", str(self.base), cwd=self.base)
        before = snapshot(self.root)
        parent_git = snapshot(self.base / ".git")
        self.push("--repo", "Example/Checker", "--create", "--dry-run")
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(snapshot(self.base / ".git"), parent_git)
        self.assertFalse((self.root / ".git").exists())
        self.assertEqual(self.log(), [])

    def test_missing_first_run_identity_has_local_setup_commands_before_any_change(self):
        self.remove_test_identity()
        before = snapshot(self.root)
        result = self.push("--repo", "Example/Checker", "--create", ok=False)
        self.assertIn("Git needs your commit name and email", result.stderr)
        self.assertIn("git init -b main", result.stderr)
        self.assertIn('git config user.name "YOUR NAME"', result.stderr)
        self.assertIn('git config user.email "YOUR_EMAIL_ADDRESS"', result.stderr)
        self.assertNotIn("git config --global", result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertFalse((self.root / ".git").exists())
        self.assertEqual(self.log(), [])
        self.assertFalse((self.base / "gh-state").exists())

    def test_missing_identity_does_not_block_read_only_preview(self):
        self.remove_test_identity()
        before = snapshot(self.root)
        self.push("--repo", "Example/Checker", "--no-pages", "--dry-run")
        self.assertEqual(snapshot(self.root), before)
        self.assertFalse((self.root / ".git").exists())
        self.assertEqual(self.log(), [])

    def test_existing_checkout_identity_refusal_then_local_configuration_pushes(self):
        self.remove_test_identity()
        self.init_checkout()
        before = snapshot(self.root)
        result = self.push("--no-pages", ok=False)
        self.assertNotIn("git init -b main", result.stderr)
        self.assertIn("git config user.name", result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(self.log(), [])
        self.git("config", "user.name", "Fixture author")
        self.git("config", "user.email", "fixture@example.invalid")
        self.push("--no-pages")
        self.assertEqual(self.head(), self.head(remote=True))
        self.assertEqual(self.git("log", "-1", "--format=%an <%ae>").stdout.strip(),
                         "Fixture author <fixture@example.invalid>")
        self.assertEqual((self.base / "git-global").read_text(), "[user]\n\tuseConfigOnly = true\n")

    def test_checks_failure_does_not_create_repo_or_stage_or_push(self):
        self.env["HSM_TEST_NODE_FAIL"] = "--test"
        self.push("--repo", "Example/Checker", "--create", ok=False)
        self.assertFalse((self.root / ".git").exists())
        self.assertFalse(any(row[0] == "gh" for row in self.log()))
        self.assertNotEqual((self.root / "MANIFEST.sha256").read_text(), "")

    def test_first_create_and_pages_configuration_use_fake_gh_after_checks(self):
        self.env["HSM_TEST_ROUTE_GITHUB"] = "1"
        result = self.push("--repo", "Example/Checker", "--create")
        self.assertEqual(self.head(), self.head(remote=True))
        log = self.log()
        gh = [row for row in log if row[0] == "gh"]
        self.assertEqual(gh[0][1:4], ["repo", "create", "Example/Checker"])
        self.assertIn("--public", gh[0])
        self.assertTrue(any("POST" in row and "build_type=workflow" in row for row in gh))
        self.assertIn(["gh", "workflow", "run", "pages.yml", "--repo", "Example/Checker", "--ref", "main"], log)
        self.assertIn("Site URL: https://example.github.io/Checker/", result.stdout)
        self.assertLess(max(i for i, row in enumerate(log) if row[0] == "node"),
                        min(i for i, row in enumerate(log) if row[0] == "gh"))

    def test_existing_pages_setting_is_updated_and_rerun_recovers_dispatch_failure(self):
        self.init_checkout(github=True)
        (self.base / "gh-state").write_text("legacy")
        self.env["HSM_TEST_DISPATCH_FAIL"] = "1"
        failed = self.push(ok=False)
        self.assertIn("already pushed", failed.stderr)
        first = self.head()
        self.assertEqual(first, self.head(remote=True))
        self.assertTrue(any("PUT" in row for row in self.log() if row[0] == "gh"))
        del self.env["HSM_TEST_DISPATCH_FAIL"]
        self.push()
        self.assertEqual(self.head(), first)

    def test_wrong_remote_refused_before_any_generated_file_change(self):
        self.init_checkout(github=True)
        before = snapshot(self.root)
        result = self.push("--repo", "Someone/Else", ok=False)
        self.assertIn("differs", result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(self.log(), [])

    def committed_checkout(self):
        self.init_checkout()
        self.git('add', '--all')
        self.git('commit', '-m', 'Canonical input fixture')

    def stage_distinct_draft(self):
        path = self.root/'README.md'
        path.write_bytes(b'Indexed draft only\x00binary\n')
        self.git('add', '--', 'README.md')
        path.write_text(self.files['README.md'])

    def test_indexed_draft_refuses_before_reader_or_manifest_writes(self):
        self.committed_checkout()
        self.stage_distinct_draft()
        before = snapshot(self.root)
        result = self.push('--no-pages', ok=False)
        self.assertIn('Indexed draft differs', result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(self.log(), [])

    def test_flagged_indexed_drafts_are_not_hidden_from_read_only_preview(self):
        self.committed_checkout()
        self.stage_distinct_draft()
        for flag in ['assume-unchanged', 'skip-worktree']:
            self.git('update-index', '--' + flag, '--', 'README.md')
            before = snapshot(self.root)
            result = self.push('--no-pages', '--dry-run', ok=False)
            self.assertIn('Indexed draft differs', result.stderr)
            self.assertEqual(snapshot(self.root), before)
            self.assertEqual(self.log(), [])
            self.git('update-index', '--no-' + flag, '--', 'README.md')

    def test_indexed_deletion_with_a_restored_working_file_refuses(self):
        self.committed_checkout()
        self.git('rm', '--', 'README.md')
        (self.root/'README.md').write_text(self.files['README.md'])
        before = snapshot(self.root)
        result = self.push('--no-pages', ok=False)
        self.assertIn('staged deletion', result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(self.log(), [])

    def test_indexed_executable_change_with_restored_working_mode_refuses(self):
        self.committed_checkout()
        self.git('update-index', '--chmod=+x', '--', 'README.md')
        before = snapshot(self.root)
        result = self.push('--no-pages', ok=False)
        self.assertIn('Indexed draft differs', result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertEqual(self.log(), [])

    def test_a_matching_staged_update_can_be_published(self):
        self.committed_checkout()
        text = 'Intentional staged and visible update\n'
        (self.root/'README.md').write_text(text)
        self.git('add', '--', 'README.md')
        self.push('--no-pages')
        self.assertEqual(self.git('show', 'main:README.md', cwd=self.remote).stdout, text)

    def test_staged_first_publication_survives_its_own_manifest_generation(self):
        self.init_checkout()
        self.git('add', '--all')
        self.push('--no-pages')
        self.assertEqual(self.head(), self.head(remote=True))

    def test_a_draft_staged_during_checks_is_preserved_before_final_add(self):
        self.committed_checkout()
        before_head = self.head()
        self.executable('node', '''import os,subprocess,sys
from pathlib import Path
if sys.argv[1]=='--test':
 path=Path('README.md');original=path.read_bytes()
 path.write_bytes(b'Draft staged while checks run\\n')
 subprocess.run([os.environ['HSM_REAL_GIT'],'add','--','README.md'],check=True)
 path.write_bytes(original)
''')
        result = self.push('--no-pages', ok=False)
        self.assertIn('Indexed draft differs', result.stderr)
        self.assertEqual(self.head(), before_head)
        self.assertEqual(self.git('show', ':README.md').stdout, 'Draft staged while checks run\n')
        self.assertEqual(self.git('ls-remote', '--heads', 'origin').stdout, '')

    def test_extra_user_files_are_never_staged(self):
        self.init_checkout()
        (self.root / "private.txt").write_text("not for publication")
        before = snapshot(self.root)
        result = self.push("--no-pages", ok=False)
        self.assertIn("Unmanaged repository files", result.stderr)
        self.assertEqual(snapshot(self.root), before)
        self.assertFalse(self.git("ls-files", "private.txt").stdout)

    def test_uninitialized_extra_file_refused_before_create_and_dry_run(self):
        (self.root / "private.txt").write_text("not for publication")
        before = snapshot(self.root)
        for args in [("--repo", "Example/Checker", "--create"),
                     ("--repo", "Example/Checker", "--create", "--dry-run")]:
            result = self.push(*args, ok=False)
            self.assertIn("Unmanaged repository files", result.stderr)
            self.assertEqual(snapshot(self.root), before)
            self.assertEqual(self.log(), [])
            self.assertFalse((self.root / ".git").exists())

    def test_initial_inspection_honours_gitignore_without_changing_export(self):
        ignored = self.root / "test/__pycache__/cache.pyc"
        ignored.parent.mkdir()
        ignored.write_bytes(b"cache")
        before = snapshot(self.root)
        self.push("--repo", "Example/Checker", "--create", "--dry-run")
        self.assertEqual(snapshot(self.root), before)

    def test_sync_bookkeeping_stays_local_even_with_an_older_ignore_file(self):
        backup = self.root / ".hsm-sync/fixture/originals/private.txt.bak"
        backup.parent.mkdir(parents=True)
        backup.write_text("local recovery data")
        before = snapshot(self.root)
        self.push("--repo", "Example/Checker", "--create", "--dry-run")
        self.assertEqual(snapshot(self.root), before)
        self.init_checkout()
        self.push("--no-pages")
        self.assertEqual(backup.read_text(), "local recovery data")
        self.assertFalse(self.git("ls-files", ".hsm-sync").stdout)
        self.assertFalse(self.git("ls-tree", "-r", "main", ".hsm-sync", cwd=self.remote).stdout)

    def test_sync_bookkeeping_cannot_be_added_to_the_publication_list(self):
        self.files[".hsm-sync/recovery.json"] = "{}\n"
        self.marker()
        result = self.push("--repo", "Example/Checker", "--dry-run", ok=False)
        self.assertIn("Unsafe managed file", result.stderr)

    def test_deliberate_managed_file_addition_and_removal(self):
        self.init_checkout()
        self.push("--no-pages")
        del self.files["src/value.mjs"]
        (self.root / "src/value.mjs").unlink()
        self.files["src/new.mjs"] = "export const n = 2;\n"
        (self.root / "src/new.mjs").write_text(self.files["src/new.mjs"])
        self.marker()
        self.push("--no-pages")
        tracked = self.git("ls-files").stdout.splitlines()
        self.assertNotIn("src/value.mjs", tracked)
        self.assertIn("src/new.mjs", tracked)

    def test_behind_remote_refused_without_commit_or_overwrite(self):
        self.init_checkout()
        self.push("--no-pages")
        original = self.head()
        other = self.base / "other"
        self.git("clone", str(self.remote), str(other), cwd=self.base)
        (other / "README.md").write_text("Remote edit\n")
        self.git("add", "README.md", cwd=other)
        self.git("commit", "-m", "Other author", cwd=other)
        self.git("push", cwd=other)
        remote = self.head(remote=True)
        (self.root / "src/value.mjs").write_text("export const value = 3;\n")
        result = self.push("--no-pages", ok=False)
        self.assertIn("commits absent locally", result.stderr)
        self.assertEqual(self.head(), original)
        self.assertEqual(self.head(remote=True), remote)
        self.assertIn("value = 3", (self.root / "src/value.mjs").read_text())

    def test_non_main_branch_is_refused(self):
        self.init_checkout()
        self.git("symbolic-ref", "HEAD", "refs/heads/topic")
        result = self.push("--no-pages", ok=False)
        self.assertIn("main branch", result.stderr)
        self.assertEqual(self.log(), [])

    def test_symbolic_link_managed_path_is_refused(self):
        outside = self.base / "outside"
        outside.write_text("private")
        path = self.root / "src/value.mjs"
        path.unlink()
        path.symlink_to(outside)
        result = self.push("--repo", "Example/Checker", "--dry-run", ok=False)
        self.assertIn("symbolic links", result.stderr)
        self.assertFalse((self.root / ".git").exists())

    def test_unsafe_manifest_path_is_refused(self):
        self.files["../private"] = ""
        self.marker()
        result = self.push("--repo", "Example/Checker", "--dry-run", ok=False)
        self.assertIn("Unsafe managed file", result.stderr)


if __name__ == "__main__":
    unittest.main()
