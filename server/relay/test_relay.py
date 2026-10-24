import json
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import relay  # noqa: E402


def _sample_log_report(**overrides):
    base = {
        "app": "uku-furigana",
        "version": "1.2.1",
        "platform": "android",
        "distribution": "website",
        "device": {
            "platform": "android",
            "userAgent": "Mozilla/5.0 /home/alice/secret",
            "screen": "412x915@2.6",
            "language": "zh-CN",
            "theme": "dark",
            "online": True,
        },
        "entries": [
            {
                "t": 1729753005000,
                "level": "error",
                "source": "export",
                "message": "Failed at C:\\Users\\bob\\Documents\\script.docx with あいうえおかき",
            },
            {
                "t": 1729753000000,
                "level": "info",
                "source": "engine",
                "message": "Init ok 日本語漢字",
            },
        ],
        "nativeLog": "Crash at /home/charlie/app: 一二三四五六七",
    }
    base.update(overrides)
    return base


class FakeGitHubClient:
    def __init__(self):
        self.issues_created = []
        self.fail_create_issue = False
        self.fail_latest_release = False
        self.release_calls = 0
        self.sums_calls = 0
        self.download_calls = []
        self.download_Barrier = None
        self.latest_release_payload = {
            "tag_name": "v1.3.0",
            "body": "### What's New\n- Bug fixes",
            "assets": [
                {
                    "name": "Uku-Furigana-v1.3.0.apk",
                    "size": 1024,
                    "browser_download_url": "https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/Uku-Furigana-v1.3.0.apk",
                },
                {
                    "name": "Uku-Furigana-v1.3.0-windows.exe",
                    "size": 2048,
                    "browser_download_url": "https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/Uku-Furigana-v1.3.0-windows.exe",
                },
                {
                    "name": "SHA256SUMS.txt",
                    "size": 256,
                    "browser_download_url": "https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/SHA256SUMS.txt",
                },
                {
                    "name": "notes.txt",
                    "size": 12,
                    "browser_download_url": "https://github.com/Cheese-nya/uku-furigana/releases/download/v1.3.0/notes.txt",
                },
            ],
        }
        self.sums_text = (
            "a" * 64 + "  Uku-Furigana-v1.3.0.apk\n"
            + "B" * 64 + " *Uku-Furigana-v1.3.0-windows.exe\n"
        )
        self.asset_bytes = b"0123456789abcdef" * 4

    def create_issue(self, title, body, labels):
        if self.fail_create_issue:
            raise relay.GitHubError("Simulated failure token=ghp_secret", 500)
        self.issues_created.append({"title": title, "body": body, "labels": labels})
        return {
            "number": 42,
            "url": "https://github.com/Cheese-nya/uku-furigana/issues/42",
        }

    def get_latest_release(self):
        self.release_calls += 1
        if self.fail_latest_release:
            raise relay.GitHubError("Simulated failure", 502)
        return self.latest_release_payload

    def fetch_text(self, url):
        self.sums_calls += 1
        if self.fail_latest_release:
            raise relay.GitHubError("Simulated sums failure", 502)
        return self.sums_text

    def download_asset(self, tag, name, dest_path, url=None):
        self.download_calls.append((tag, name))
        if self.download_Barrier is not None:
            self.download_Barrier()
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        part_path = dest_path.parent / f".{dest_path.name}.part"
        part_path.write_bytes(self.asset_bytes)
        part_path.replace(dest_path)


class TestRedactLogText(unittest.TestCase):
    def test_five_cjk_or_kana_not_redacted(self):
        self.assertEqual(relay.redact_log_text("あいうえお"), "あいうえお")
        self.assertEqual(relay.redact_log_text("アイウエオ"), "アイウエオ")
        self.assertEqual(relay.redact_log_text("一二三四五"), "一二三四五")
        self.assertEqual(
            relay.redact_log_text("prefix あいうえお suffix"),
            "prefix あいうえお suffix",
        )

    def test_six_or_more_cjk_or_kana_redacted(self):
        self.assertEqual(relay.redact_log_text("あいうえおか"), "[文本已隐去]")
        self.assertEqual(relay.redact_log_text("アイウエオカキ"), "[文本已隐去]")
        self.assertEqual(relay.redact_log_text("一二三四五六"), "[文本已隐去]")
        self.assertEqual(
            relay.redact_log_text("err: 漢字あいうえ! ok: 漢字あいう"),
            "err: [文本已隐去]! ok: 漢字あいう",
        )

    def test_user_paths_redacted(self):
        self.assertEqual(
            relay.redact_log_text("open /home/cheese/project/a.txt failed"),
            "open /home/<user>/project/a.txt failed",
        )
        self.assertEqual(
            relay.redact_log_text(r"File C:\Users\Administrator\AppData\Local\uku.log"),
            r"File C:\Users\<user>\AppData\Local\uku.log",
        )
        self.assertEqual(
            relay.redact_log_text("File C:/Users/alice/Desktop/script.docx"),
            "File C:/Users/<user>/Desktop/script.docx",
        )
        self.assertEqual(
            relay.redact_log_text("File /Users/macuser/Library/Logs/uku.log"),
            "File /Users/<user>/Library/Logs/uku.log",
        )


class TestValidateFeedback(unittest.TestCase):
    def test_valid_log_and_text_payloads(self):
        self.assertTrue(
            relay.validate_feedback(
                {
                    "kind": "log",
                    "includeLog": True,
                    "log": _sample_log_report(),
                }
            )
        )
        self.assertTrue(
            relay.validate_feedback(
                {
                    "kind": "text",
                    "title": "导出 Word 失败",
                    "message": "点击导出按钮没有任何反应",
                    "contact": "qq:123456",
                    "includeLog": False,
                }
            )
        )

    def test_invalid_inputs(self):
        self.assertFalse(relay.validate_feedback(None))
        self.assertFalse(relay.validate_feedback([]))
        # Bad kind
        self.assertFalse(
            relay.validate_feedback({"kind": "other", "includeLog": False})
        )
        # kind == 'text' requires title 1..80 chars
        self.assertFalse(
            relay.validate_feedback({"kind": "text", "includeLog": False})
        )
        self.assertFalse(
            relay.validate_feedback(
                {"kind": "text", "title": "   ", "includeLog": False}
            )
        )
        self.assertFalse(
            relay.validate_feedback(
                {"kind": "text", "title": "x" * 81, "includeLog": False}
            )
        )
        # message > 4000
        self.assertFalse(
            relay.validate_feedback(
                {
                    "kind": "text",
                    "title": "ok",
                    "message": "m" * 4001,
                    "includeLog": False,
                }
            )
        )
        # contact > 80
        self.assertFalse(
            relay.validate_feedback(
                {
                    "kind": "text",
                    "title": "ok",
                    "contact": "c" * 81,
                    "includeLog": False,
                }
            )
        )
        # includeLog true but missing or wrong app
        self.assertFalse(
            relay.validate_feedback(
                {"kind": "text", "title": "ok", "includeLog": True}
            )
        )
        self.assertFalse(
            relay.validate_feedback(
                {
                    "kind": "log",
                    "includeLog": True,
                    "log": _sample_log_report(app="other-app"),
                }
            )
        )
        # entries > 500
        many_entries = [
            {"t": i, "level": "info", "source": "s", "message": "ok"}
            for i in range(501)
        ]
        self.assertFalse(
            relay.validate_feedback(
                {
                    "kind": "log",
                    "includeLog": True,
                    "log": _sample_log_report(entries=many_entries),
                }
            )
        )
        # single entry message > 500
        long_entry = [
            {"t": 1, "level": "error", "source": "s", "message": "e" * 501}
        ]
        self.assertFalse(
            relay.validate_feedback(
                {
                    "kind": "log",
                    "includeLog": True,
                    "log": _sample_log_report(entries=long_entry),
                }
            )
        )


class TestRateLimiter(unittest.TestCase):
    def test_hourly_and_daily_per_ip_limits(self):
        now = [100000.0]
        limiter = relay.RateLimiter(
            per_hour=5, per_day=20, global_per_day=200, clock=lambda: now[0]
        )
        for _ in range(5):
            self.assertTrue(limiter.allow("1.2.3.4"))
        # 6th in the same hour is blocked
        self.assertFalse(limiter.allow("1.2.3.4"))
        # Different IP is still allowed
        self.assertTrue(limiter.allow("5.6.7.8"))

        # Advance 1h + 1s -> 3 more hours of 5 requests (total 20 in day)
        for _ in range(3):
            now[0] += 3601.0
            for _ in range(5):
                self.assertTrue(limiter.allow("1.2.3.4"))
            self.assertFalse(limiter.allow("1.2.3.4"))

        # 5th hour within same 24h window -> blocked by daily limit (20)
        now[0] += 3601.0
        self.assertFalse(limiter.allow("1.2.3.4"))

        # Advance past 24h from initial batch -> allowed again
        now[0] += 86401.0
        self.assertTrue(limiter.allow("1.2.3.4"))

    def test_global_daily_limit(self):
        now = [200000.0]
        limiter = relay.RateLimiter(
            per_hour=5, per_day=20, global_per_day=10, clock=lambda: now[0]
        )
        for i in range(10):
            self.assertTrue(limiter.allow(f"10.0.0.{i}"))
        self.assertFalse(limiter.allow("10.0.0.99"))
        now[0] += 86401.0
        self.assertTrue(limiter.allow("10.0.0.99"))


class TestBuildIssue(unittest.TestCase):
    def test_log_feedback_redacts_and_sorts_entries(self):
        payload = {
            "kind": "log",
            "message": "附加说明：あいうえおかきく",
            "contact": "user@example.com",
            "includeLog": True,
            "log": _sample_log_report(),
        }
        issue = relay.build_issue(payload)
        self.assertEqual(issue.title, "[自动反馈] 1.2.1 / android")
        self.assertEqual(issue.labels, ["from-app", "bug"])
        self.assertIn("user@example.com", issue.body)
        self.assertIn("<details><summary>诊断日志</summary>", issue.body)
        self.assertNotIn("あいうえおか", issue.body)
        self.assertNotIn("一二三四五六", issue.body)
        self.assertNotIn("/home/alice/", issue.body)
        self.assertIn("/home/<user>/secret", issue.body)
        self.assertNotIn(r"C:\Users\bob", issue.body)
        self.assertIn(r"C:\Users\<user>\Documents", issue.body)
        self.assertIn("日本語漢字", issue.body)  # 5 chars preserved
        # Earlier timestamp (1729753000000) appears before later (1729753005000)
        idx_first = issue.body.index("[info] engine:")
        idx_second = issue.body.index("[error] export:")
        self.assertLess(idx_first, idx_second)

    def test_text_feedback_preserves_user_title_and_message_cjk(self):
        payload = {
            "kind": "text",
            "title": "在导出包含大量假名的文档时软件会卡住不动",
            "message": "当我打开一篇文章并点击导出按钮的时候，界面一直转圈无法完成导出。",
            "includeLog": True,
            "log": _sample_log_report(),
        }
        title, body, labels = relay.build_issue(payload)
        self.assertEqual(title, "在导出包含大量假名的文档时软件会卡住不动")
        self.assertEqual(labels, ["from-app", "feedback"])
        self.assertIn("当我打开一篇文章并点击导出按钮的时候", body)
        # Log entries are still redacted
        self.assertNotIn("あいうえおか", body)

    def test_issue_body_truncation_over_60000_chars(self):
        huge_entries = [
            {
                "t": 1729753000000 + i * 1000,
                "level": "error",
                "source": "worker",
                "message": f"line-{i}-" + ("x" * 450),
            }
            for i in range(200)
        ]
        payload = {
            "kind": "log",
            "includeLog": True,
            "log": _sample_log_report(entries=huge_entries),
        }
        issue = relay.build_issue(payload)
        self.assertLessEqual(len(issue.body), 60000)
        self.assertIn("<details><summary>诊断日志</summary>", issue.body)
        self.assertIn("日志过长已截断", issue.body)
        self.assertTrue(issue.body.endswith("```\n</details>"))


class TestSumsAndReleaseInfo(unittest.TestCase):
    def test_parse_sums_with_star_and_blank_lines(self):
        h1 = "0123456789abcdef" * 4
        h2 = "FEDCBA9876543210" * 4
        raw = f"\n  \n{h1}  Uku-Furigana-v1.2.1.apk\n{h2} *Uku-Furigana-v1.2.1-windows.exe\ninvalid line\n"
        parsed = relay.parse_sums(raw)
        self.assertEqual(
            parsed,
            {
                "Uku-Furigana-v1.2.1.apk": h1,
                "Uku-Furigana-v1.2.1-windows.exe": h2.lower(),
            },
        )

    def test_valid_tag_and_asset_name(self):
        self.assertTrue(relay.valid_tag("v1.2.1"))
        self.assertFalse(relay.valid_tag("1.2.1"))
        self.assertFalse(relay.valid_tag("v1.2"))
        self.assertFalse(relay.valid_tag("v1.2.1-rc1"))

        self.assertTrue(relay.valid_asset_name("Uku-Furigana-v1.2.1.apk"))
        self.assertTrue(relay.valid_asset_name("Uku-Furigana-v1.2.1-windows.exe"))
        self.assertFalse(relay.valid_asset_name("Uku-Furigana-v1.2.1.zip"))
        self.assertFalse(relay.valid_asset_name("../Uku-Furigana-v1.2.1.apk"))

        # Tag/version consistency
        self.assertTrue(
            relay.valid_asset_name("Uku-Furigana-v1.2.1.apk", "v1.2.1")
        )
        self.assertFalse(
            relay.valid_asset_name("Uku-Furigana-v1.2.1.apk", "v1.2.2")
        )
        self.assertFalse(
            relay.valid_asset_name("Uku-Furigana-v1.2.1-windows.exe", "v2.0.0")
        )

    def test_build_release_info(self):
        fake = FakeGitHubClient()
        # Add an asset with mismatched version to ensure it is filtered out
        release_data = dict(fake.latest_release_payload)
        release_data["assets"] = list(fake.latest_release_payload["assets"]) + [
            {
                "name": "Uku-Furigana-v1.2.9.apk",
                "size": 999,
                "browser_download_url": "https://example.com/old.apk",
            }
        ]
        info = relay.build_release_info(release_data, fake.sums_text)
        self.assertEqual(info["version"], "1.3.0")
        self.assertEqual(info["tag"], "v1.3.0")
        self.assertEqual(len(info["assets"]), 2)
        apk, exe = info["assets"][0], info["assets"][1]
        self.assertEqual(apk["name"], "Uku-Furigana-v1.3.0.apk")
        self.assertEqual(
            apk["mirrorUrl"],
            "https://uku.saiaino.xyz/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0.apk",
        )
        self.assertEqual(apk["sha256"], "a" * 64)
        self.assertEqual(exe["sha256"], "b" * 64)


class TestRangeParsing(unittest.TestCase):
    def test_valid_ranges(self):
        self.assertEqual(relay.parse_range("bytes=0-99", 1000), (0, 99))
        self.assertEqual(relay.parse_range("bytes=500-", 1000), (500, 999))
        self.assertEqual(relay.parse_range("bytes=-200", 1000), (800, 999))
        self.assertEqual(relay.parse_range("bytes=900-5000", 1000), (900, 999))
        self.assertEqual(relay.parse_range("bytes=-5000", 1000), (0, 999))

    def test_invalid_ranges(self):
        self.assertIsNone(relay.parse_range(None, 1000))
        self.assertIsNone(relay.parse_range("", 1000))
        self.assertIsNone(relay.parse_range("bytes=0-10", 0))
        self.assertIsNone(relay.parse_range("bytes=1000-1000", 1000))
        self.assertIsNone(relay.parse_range("bytes=500-100", 1000))
        self.assertIsNone(relay.parse_range("bytes=-0", 1000))
        self.assertIsNone(relay.parse_range("bytes=-", 1000))
        self.assertIsNone(relay.parse_range("items=0-10", 1000))
        self.assertIsNone(relay.parse_range("bytes=0-1, 3-4", 1000))


class TestRelayServerHTTP(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.fake_gh = FakeGitHubClient()
        self.now = [1000000.0]
        self.service = relay.RelayService(
            github_client=self.fake_gh,
            cache_dir=self.temp_dir.name,
            clock=lambda: self.now[0],
        )
        self.server = relay.create_server(self.service, bind="127.0.0.1", port=0)
        self.port = self.server.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.temp_dir.cleanup()

    def _request(self, method, path, body=None, headers=None):
        req_headers = dict(headers or {})
        data = None
        if body is not None:
            data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
            req_headers.setdefault("Content-Type", "application/json")
        req = urllib.request.Request(
            f"{self.base_url}{path}", data=data, headers=req_headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), exc.read()

    def test_health_and_cors(self):
        status, headers, raw = self._request(
            "GET", "/api/health", headers={"Origin": "http://127.0.0.1:49152"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw), {"ok": True})
        self.assertEqual(
            headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:49152"
        )

        # Disallowed origin does not receive ACAO header
        status, headers, _ = self._request(
            "GET", "/api/health", headers={"Origin": "https://evil.example"}
        )
        self.assertEqual(status, 200)
        self.assertIsNone(headers.get("Access-Control-Allow-Origin"))

    def test_feedback_endpoint_statuses(self):
        # Too large (> 64KB)
        status, _, raw = self._request(
            "POST", "/api/feedback", body=b"x" * (64 * 1024 + 10)
        )
        self.assertEqual(status, 413)
        self.assertEqual(json.loads(raw), {"ok": False, "error": "too-large"})

        # Invalid payload -> 400
        status, _, raw = self._request(
            "POST", "/api/feedback", body={"kind": "text", "includeLog": False}
        )
        self.assertEqual(status, 400)
        self.assertEqual(json.loads(raw), {"ok": False, "error": "invalid"})

        # Valid submission -> 200
        valid_body = {
            "kind": "log",
            "includeLog": True,
            "log": _sample_log_report(),
        }
        status, _, raw = self._request(
            "POST",
            "/api/feedback",
            body=valid_body,
            headers={"X-Real-IP": "203.0.113.10"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            json.loads(raw),
            {
                "ok": True,
                "number": 42,
                "url": "https://github.com/Cheese-nya/uku-furigana/issues/42",
            },
        )

        # GitHub failure -> 502 without leaking secret details
        self.fake_gh.fail_create_issue = True
        status, _, raw = self._request(
            "POST",
            "/api/feedback",
            body=valid_body,
            headers={"X-Real-IP": "203.0.113.11"},
        )
        self.assertEqual(status, 502)
        self.assertEqual(json.loads(raw), {"ok": False, "error": "server"})
        self.assertNotIn(b"ghp_secret", raw)

    def test_release_latest_caching_and_stale_fallback(self):
        status, _, raw = self._request("GET", "/api/update/latest")
        self.assertEqual(status, 200)
        data = json.loads(raw)
        self.assertEqual(data["version"], "1.3.0")
        self.assertEqual(self.fake_gh.release_calls, 1)

        # Within 10m: served from memory cache
        self.now[0] += 300
        status, _, _ = self._request("GET", "/api/update/latest")
        self.assertEqual(status, 200)
        self.assertEqual(self.fake_gh.release_calls, 1)

        # After 15m with upstream failure: serves stale cache (< 1h)
        self.now[0] += 600
        self.fake_gh.fail_latest_release = True
        status, _, raw = self._request("GET", "/api/update/latest")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["version"], "1.3.0")

        # After > 1h with upstream failure: returns 502
        self.now[0] += 3600
        status, _, raw = self._request("GET", "/api/update/latest")
        self.assertEqual(status, 502)

    def test_mirror_download_range_cache_eviction_and_concurrency(self):
        # Mismatched tag and asset version -> 404
        status, _, _ = self._request(
            "GET", "/api/update/dl/v1.3.0/Uku-Furigana-v1.2.0.apk"
        )
        self.assertEqual(status, 404)

        # Full download -> 200
        status, headers, raw = self._request(
            "GET", "/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0.apk"
        )
        self.assertEqual(status, 200)
        self.assertEqual(raw, self.fake_gh.asset_bytes)
        self.assertEqual(len(self.fake_gh.download_calls), 1)

        # Range request -> 206 served from disk cache (no new upstream download)
        status, headers, raw = self._request(
            "GET",
            "/api/update/dl/v1.3.0/Uku-Furigana-v1.3.0.apk",
            headers={"Range": "bytes=4-9"},
        )
        self.assertEqual(status, 206)
        self.assertEqual(raw, b"456789")
        self.assertEqual(
            headers.get("Content-Range"),
            f"bytes 4-9/{len(self.fake_gh.asset_bytes)}",
        )
        self.assertEqual(len(self.fake_gh.download_calls), 1)

        # Download v1.4.0 and v1.5.0 -> v1.3.0 is evicted (keeps 2 latest versions)
        self._request("GET", "/api/update/dl/v1.4.0/Uku-Furigana-v1.4.0.apk")
        self._request("GET", "/api/update/dl/v1.5.0/Uku-Furigana-v1.5.0.apk")
        cached_names = sorted(p.name for p in Path(self.temp_dir.name).iterdir())
        self.assertEqual(
            cached_names,
            ["Uku-Furigana-v1.4.0.apk", "Uku-Furigana-v1.5.0.apk"],
        )

        # Concurrency limit: hold 2 slots and verify 3rd returns 503 + Retry-After: 5
        self.assertTrue(self.service._download_sem.acquire(blocking=False))
        self.assertTrue(self.service._download_sem.acquire(blocking=False))
        try:
            status, headers, _ = self._request(
                "GET", "/api/update/dl/v1.5.0/Uku-Furigana-v1.5.0.apk"
            )
            self.assertEqual(status, 503)
            self.assertEqual(headers.get("Retry-After"), "5")
        finally:
            self.service._download_sem.release()
            self.service._download_sem.release()


class RateLimitKeyTest(unittest.TestCase):
    def test_client_id_wins_over_ip_and_bad_ids_fall_back(self):
        good = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        self.assertEqual(relay.rate_limit_key({"clientId": good}, "127.0.0.1"), f"id:{good}")
        for bad in ("short", "x" * 65, "has space in it 1234567", 123, None):
            self.assertEqual(relay.rate_limit_key({"clientId": bad}, "127.0.0.1"), "ip:127.0.0.1")

    def test_global_hourly_cap_applies_across_clients(self):
        limiter = relay.RateLimiter(per_hour=5, per_day=20, global_per_day=200, global_per_hour=3, clock=lambda: 1000.0)
        self.assertTrue(all(limiter.allow(f"id:{n}") for n in range(3)))
        self.assertFalse(limiter.allow("id:other"))
        self.assertTrue(limiter.allow("id:later", now=1000.0 + 3601))


if __name__ == "__main__":
    unittest.main()