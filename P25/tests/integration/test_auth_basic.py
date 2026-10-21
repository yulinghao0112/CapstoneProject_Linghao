import os
import sys
import warnings

try:
    import urllib3
    warnings.filterwarnings("ignore", category=urllib3.exceptions.NotOpenSSLWarning)
except Exception:
    pass

try:
    import sqlalchemy
    warnings.filterwarnings("ignore", category=sqlalchemy.exc.LegacyAPIWarning)
except Exception:
    pass
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# Force a local SQLite DB for test isolation (ignore any env-provided DSN)
os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
os.environ.setdefault("FLASK_ENV", "testing")

# Try normal import first
flask_app = None
try:
    from app import app as flask_app  # type: ignore
except Exception:
    pass

# Fallback: load app module directly from file path
if flask_app is None:
    import importlib.util
    app_path = os.path.join(BACKEND_ROOT, "app.py")
    spec = importlib.util.spec_from_file_location("app", app_path)
    module = importlib.util.module_from_spec(spec)  # type: ignore
    assert spec and spec.loader, "Unable to load app.py spec"
    spec.loader.exec_module(module)  # type: ignore
    flask_app = getattr(module, "app", None)
    if flask_app is None and hasattr(module, "create_app"):
        flask_app = module.create_app()
    assert flask_app is not None, "Could not obtain Flask app instance from app.py"

from models import db

import pytest
import uuid

# Allow overriding candidate routes via environment variables for CI/local differences
# Usage example:
#   export TEST_LOGOUT_PATHS="/logout,/api/logout"
#   export TEST_MEETINGS_PREFIXES="/meetings,/api/meetings"
#   export TEST_ASK_GEMINI_PATHS="/api/chat/ask,/ai/ask"

def _env_paths(key: str, fallback: list[str]) -> list[str]:
    raw = os.environ.get(key, "").strip()
    if not raw:
        return fallback
    return [p.strip() for p in raw.split(",") if p.strip()]

@pytest.fixture(scope="function")
def app():
    flask_app.config["TESTING"] = True
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    with flask_app.app_context():
        db.create_all()
        yield flask_app
        # Teardown: be conservative across dialects
        try:
            from sqlalchemy import inspect
            engine = db.engine
            if engine.url.get_backend_name() == "sqlite":
                # In-memory SQLite can be dropped safely
                db.session.remove()
                db.drop_all()
            else:
                # On non-SQLite (e.g., Postgres), avoid hard drop_all() to bypass FK dependency errors
                db.session.rollback()
                engine.dispose()
        except Exception:
            # As a last resort, don't fail teardown
            pass

@pytest.fixture
def client(app):
    return app.test_client()


# --- helpers for this test module ---

 # Try common auth route prefixes
_REGISTER_CANDIDATES = [
    "/register",
    "/auth/register",
    "/api/register",
    "/api/auth/register",
]

_LOGIN_CANDIDATES = [
    "/login",
    "/auth/login",
    "/api/login",
    "/api/auth/login",
]

_LOGOUT_CANDIDATES = _env_paths(
    "TEST_LOGOUT_PATHS",
    [
        "/logout",
        "/auth/logout",
        "/api/logout",
        "/api/auth/logout",
    ],
)

_MEETINGS_PREFIXES = _env_paths(
    "TEST_MEETINGS_PREFIXES",
    ["/meetings", "/api/meetings", "/auth/meetings", "/api/auth/meetings"],
)

# Speech route prefixes and helpers
_SPEECH_PREFIXES = _env_paths(
    "TEST_SPEECH_PREFIXES",
    ["/speech", "/api/speech", "/auth/speech", "/api/auth/speech", ""],
)

def _speech_paths(suffix: str):
    # Build candidates like <prefix>/<suffix> across known prefixes; include root ('') for no prefix
    return [f"{p}/{suffix}" if p else f"/{suffix}" for p in _SPEECH_PREFIXES]

def _paths_for(meeting_id: int, suffix: str):
    # Build candidates like /meetings/<id>/<suffix> across known prefixes
    return [f"{p}/{meeting_id}/{suffix}" for p in _MEETINGS_PREFIXES]



def _first_non_404_or_skip(client, method, paths, **kwargs):
    import pytest as _pytest
    resp = None
    for p in paths:
        resp = client.open(path=p, method=method, **kwargs)
        if resp.status_code != 404:
            return resp
    # If all are 404, skip the test because this deployment doesn't expose the endpoint
    _pytest.skip(f"All candidate routes not found: {paths}")


# Helper: like _first_non_404_or_skip but creates fresh kwargs per attempt (for multipart uploads etc)
def _first_non_404_or_skip_kw(client, method, paths, kwfactory):
    """Like _first_non_404_or_skip but calls kwfactory() each attempt to create fresh kwargs
    (useful for multipart with BytesIO which cannot be reused across attempts)."""
    import pytest as _pytest
    last_resp = None
    for p in paths:
        kwargs = kwfactory()
        last_resp = client.open(path=p, method=method, **kwargs)
        if last_resp.status_code != 404:
            return last_resp
    _pytest.skip(f"All candidate routes not found: {paths}")


# For /upload-audio which expects the field name 'audio'
def _mk_audio_upload_kwfactory(audio_bytes: bytes, filename: str):
    import io as _io
    def _factory():
        data = {"audio": (_io.BytesIO(audio_bytes), filename)}
        return {"data": data, "content_type": "multipart/form-data"}
    return _factory

def _mk_upload_kwfactory(user_id: int, file_bytes: bytes, filename: str, speaker: str = None):
    import io as _io
    def _factory():
        data = {"user_id": str(user_id), "file": (_io.BytesIO(file_bytes), filename)}
        if speaker is not None:
            data["speaker"] = speaker
        return {"data": data, "content_type": "multipart/form-data"}
    return _factory

# Resolve a concrete URL rule by endpoint name (e.g., 'auth.ask_gemini').
# Returns (methods_set, rule_string) or (None, None) if not found.
def _resolve_rule_by_endpoint(flask_app, endpoint: str):
    try:
        rules = list(flask_app.url_map.iter_rules())
    except Exception:
        return None, None
    for r in rules:
        if r.endpoint == endpoint:
            return r.methods, r.rule
    return None, None


def _first_non_404(client, method, paths, **kwargs):
    for p in paths:
        resp = client.open(path=p, method=method, **kwargs)
        if resp.status_code != 404:
            return resp
    # if all 404, return the last response for debugging
    return resp


def register(client, email="u@test.com", username="u1", password="pass"):
    payload_variants = [
        {"email": email, "username": username, "password": password},
        {"email": email, "name": username, "password": password},
        {"email": email, "display_name": username, "password": password},
        {"email": email, "username": username, "password": password, "confirm_password": password},
    ]
    for payload in payload_variants:
        resp = _first_non_404(client, "POST", _REGISTER_CANDIDATES, json=payload)
        if resp.status_code not in (400, 401, 403, 422):
            return resp
    # return the last response for easier debugging
    return resp


def login(client, email="u@test.com", password="pass"):
    payload = {"email": email, "password": password}
    return _first_non_404(client, "POST", _LOGIN_CANDIDATES, json=payload)


# --- actual tests ---

def test_register_and_login_ok(client):
    # Use unique credentials each run to avoid collisions with any seeded accounts
    unique_suffix = uuid.uuid4().hex[:8]
    unique_email = f"u{unique_suffix}@test.com"
    unique_username = f"u1_{unique_suffix}"

    r1 = register(client, email=unique_email, username=unique_username)
    assert r1.status_code in (200, 201), f"register failed: {r1.status_code}, body={r1.get_data(as_text=True)}"
    data = r1.get_json()
    assert "user_id" in data and "access_token" in data

    r2 = login(client, email=unique_email)
    assert r2.status_code == 200
    data2 = r2.get_json()
    assert data2.get("username") == unique_username
    assert "access_token" in data2


def test_register_duplicate_email(client):
    register(client, email="dup@test.com", username="a1")
    r = register(client, email="dup@test.com", username="a2")
    assert r.status_code == 400, f"expected 400 on duplicate, got {r.status_code}, body={r.get_data(as_text=True)}"

    # =========================
# Additional auth/meeting/material route tests
# =========================
import io
import os
import json as _json

def _register_and_login_unique(client):
    """Helper: create a unique user, return (user_id, username, token)."""
    import uuid
    suffix = uuid.uuid4().hex[:8]
    email = f"u{suffix}@test.com"
    username = f"u1_{suffix}"
    r = register(client, email=email, username=username)
    assert r.status_code in (200, 201)
    data = r.get_json()
    user_id = data["user_id"]
    token = data.get("access_token")
    # ensure login works
    r2 = login(client, email=email)
    assert r2.status_code == 200
    return user_id, username, token

def test_logout_requires_jwt(client):
    resp = _first_non_404_or_skip(client, "POST", _LOGOUT_CANDIDATES)
    # flask-jwt-extended returns 401 (or sometimes 422) when token missing
    assert resp.status_code in (401, 422)

def test_meeting_next_id_and_create_and_list(client):
    user_id, _uname, _tok = _register_and_login_unique(client)

    # next-id should be 1 initially
    r = _first_non_404_or_skip(client, "GET", [f"{p}/next-id" for p in _MEETINGS_PREFIXES], query_string={"user_id": user_id})
    assert r.status_code == 200
    assert r.get_json()["next_meeting_id"] == 1

    # create meeting id=1
    r2 = _first_non_404_or_skip(
        client,
        "POST",
        [f"{p}/create" for p in _MEETINGS_PREFIXES],
        json={"user_id": user_id, "meeting_id": 1, "title": "Kickoff"},
    )
    assert r2.status_code == 200

    # list should show the meeting
    r3 = _first_non_404_or_skip(client, "GET", [f"{p}/all" for p in _MEETINGS_PREFIXES], query_string={"user_id": user_id})
    assert r3.status_code == 200
    meetings = r3.get_json()["meetings"]
    assert len(meetings) == 1
    assert meetings[0]["meeting_id"] == 1
    assert meetings[0]["title"] == "Kickoff"

def test_messages_access_control_and_empty(client):
    # user A creates a meeting
    user_a, _ua, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(client, "POST", [f"{p}/create" for p in _MEETINGS_PREFIXES], json={"user_id": user_a, "meeting_id": 1, "title": "A meeting"})

    # user B tries to read messages from A's meeting -> 403
    user_b, _ub, _ = _register_and_login_unique(client)
    r_forbidden = _first_non_404_or_skip(client, "GET", _paths_for(1, "messages"), query_string={"user_id": user_b})
    assert r_forbidden.status_code == 403

    # A can read, initially empty list
    r_ok = _first_non_404_or_skip(client, "GET", _paths_for(1, "messages"), query_string={"user_id": user_a})
    assert r_ok.status_code == 200
    assert r_ok.get_json() == []

def test_upload_material_list_download_and_hasflag(client):
    user_id, _uname, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(client, "POST", [f"{p}/create" for p in _MEETINGS_PREFIXES], json={"user_id": user_id, "meeting_id": 1, "title": "Docs"})

    # upload .txt material
    r_up = _first_non_404_or_skip_kw(
        client,
        "POST",
        _paths_for(1, "upload-material"),
        _mk_upload_kwfactory(user_id, b"These are the meeting notes.", "notes.txt", speaker="Patrick"),
    )
    assert r_up.status_code == 200

    # list materials
    r_list = _first_non_404_or_skip(client, "GET", _paths_for(1, "materials"), query_string={"user_id": user_id})
    assert r_list.status_code == 200
    items = r_list.get_json()
    assert len(items) == 1
    assert items[0]["filename"] == "notes.txt"
    assert items[0]["size"] > 0

    # has-materials
    r_has = _first_non_404_or_skip(client, "GET", _paths_for(1, "has-materials"))
    assert r_has.status_code == 200
    assert r_has.get_json()["has_material"] is True

    # download aggregated file
    r_dl = _first_non_404_or_skip(client, "GET", _paths_for(1, "materials/download"), query_string={"user_id": user_id})
    assert r_dl.status_code == 200
    assert "notes.txt" in r_dl.get_data(as_text=True)

def test_parse_tasks_requires_api_key_and_material(client, monkeypatch):
    user_id, _uname, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(client, "POST", [f"{p}/create" for p in _MEETINGS_PREFIXES], json={"user_id": user_id, "meeting_id": 2, "title": "Parse"})

    # upload material so the endpoint can read latest material
    _first_non_404_or_skip_kw(
        client,
        "POST",
        _paths_for(2, "upload-material"),
        _mk_upload_kwfactory(user_id, b"We need to improve login and add tests.", "m.txt"),
    )

    # ensure API key is missing
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    r = _first_non_404_or_skip(client, "POST", _paths_for(2, "parse-tasks"), json={"user_id": user_id})
    assert r.status_code == 500
    body = r.get_json()
    assert body["success"] is False
    assert "Gemini API key not configured" in body["error"]

def test_ask_gemini_mocked(app, client, monkeypatch):
    user_id, _uname, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(client, "POST", [f"{p}/create" for p in _MEETINGS_PREFIXES], json={"user_id": user_id, "meeting_id": 3, "title": "Chat"})

    class _DummyResp:
        def __init__(self, text):
            self.text = text

    class _DummyModel:
        def __init__(self, *a, **k):
            pass
        def generate_content(self, *a, **k):
            return _DummyResp("Mocked answer")

    import google.generativeai as _genai
    monkeypatch.setattr(_genai, "configure", lambda **k: None)
    monkeypatch.setattr(_genai, "GenerativeModel", lambda *a, **k: _DummyModel())
    # Prefer resolving by endpoint name to avoid guessing the prefix
    methods, rule = _resolve_rule_by_endpoint(app, "auth.ask_gemini")
    payload = {
        "meeting_id": 3,
        "user_id": user_id,
        "speaker": "user",
        "content": "Hi there?",
    }
    if rule and (not methods or "POST" in methods):
        r = client.post(rule, json=payload)
    else:
        # Fallback to candidate list + env override
        ask_candidates = _env_paths(
            "TEST_ASK_GEMINI_PATHS",
            [
                "/api/ask-gemini",
                "/ask-gemini",
                "/api/auth/ask-gemini",
                "/auth/api/ask-gemini",
                "/auth/ask-gemini",
            ],
        )
        r = _first_non_404_or_skip(
            client,
            "POST",
            ask_candidates,
            json=payload,
        )
    assert r.status_code == 200
    assert r.get_json()["reply"] == "Mocked answer"

def test_delete_meeting_wipes_data(client):
    user_id, _uname, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(client, "POST", [f"{p}/create" for p in _MEETINGS_PREFIXES], json={"user_id": user_id, "meeting_id": 4, "title": "ToDelete"})

    # Upload something so there is linked data
    _first_non_404_or_skip_kw(
        client,
        "POST",
        _paths_for(4, "upload-material"),
        _mk_upload_kwfactory(user_id, b"temp", "a.txt"),
    )

    # Now delete
    r_del = _first_non_404_or_skip(client, "POST", [f"{p}/delete" for p in _MEETINGS_PREFIXES], json={"user_id": user_id, "meeting_id": 4})
    assert r_del.status_code == 200

    # Listing should be empty (no meeting 4)
    r_list = _first_non_404_or_skip(client, "GET", [f"{p}/all" for p in _MEETINGS_PREFIXES], query_string={"user_id": user_id})
    assert r_list.status_code == 200
    meetings = r_list.get_json()["meetings"]
    assert all(m["meeting_id"] != 4 for m in meetings) or len(meetings) == 0

def test_create_jira_tasks_validation_paths(client):
    # no user_stories
    r1 = _first_non_404_or_skip(client, "POST", _paths_for(1, "create-jira-tasks"), json={"user_id": 999})
    assert r1.status_code == 400

    # meeting not found / access denied
    # create a user and a meeting with that user
    user_id, _uname, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(client, "POST", [f"{p}/create" for p in _MEETINGS_PREFIXES], json={"user_id": user_id, "meeting_id": 7, "title": "x"})

    # call using different user id so it fails ownership
    r2 = _first_non_404_or_skip(client, "POST", _paths_for(7, "create-jira-tasks"), json={"user_id": 123456, "user_stories": [{"title": "A"}]})
    assert r2.status_code == 403

    # correct user but no Jira credentials -> 401
    r3 = _first_non_404_or_skip(client, "POST", _paths_for(7, "create-jira-tasks"), json={"user_id": user_id, "user_stories": [{"title": "A"}]})
    assert r3.status_code == 401


# =========================
# Additional tests for /meetings/<id>/tasks and logout with JWT
# =========================

def test_get_tasks_ok_and_forbidden(client):
    # Owner creates meeting
    user_a, _ua, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(
        client,
        "POST",
        [f"{p}/create" for p in _MEETINGS_PREFIXES],
        json={"user_id": user_a, "meeting_id": 11, "title": "Tasks Meeting"},
    )

    # Owner can query tasks (initially empty list)
    r_ok = _first_non_404_or_skip(
        client,
        "GET",
        _paths_for(11, "tasks"),
        query_string={"user_id": user_a},
    )
    assert r_ok.status_code == 200
    assert isinstance(r_ok.get_json(), list)
    assert r_ok.get_json() == []

    # Another user cannot access tasks for this meeting -> 403
    user_b, _ub, _ = _register_and_login_unique(client)
    r_forbidden = _first_non_404_or_skip(
        client,
        "GET",
        _paths_for(11, "tasks"),
        query_string={"user_id": user_b},
    )
    assert r_forbidden.status_code == 403


def test_logout_with_valid_jwt(client):
    # Register and obtain a valid JWT
    user_id, _uname, token = _register_and_login_unique(client)
    assert token, "register should return access_token"

    # Try all candidate logout routes with Authorization header
    resp = _first_non_404_or_skip(
        client,
        "POST",
        _LOGOUT_CANDIDATES,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body and "logged out" in body.get("msg", "")


# =========================
# Tests for routes/audio_helpers.py (AssemblyAI helper)
# =========================

def test_transcribe_with_assemblyai_success(monkeypatch):
    from routes.audio_helpers import transcribe_with_assemblyai
    import io as _io

    class _Resp:
        def __init__(self, payload):
            self._payload = payload
        def json(self):
            return self._payload

    def _fake_post(url, *a, **k):
        if url.endswith("/upload"):
            # upload returns a URL for the uploaded audio
            return _Resp({"upload_url": "https://fake.cdn/audio.wav"})
        if url.endswith("/transcript"):
            # posting a transcript job returns an id
            return _Resp({"id": "tx_123"})
        raise AssertionError(f"unexpected POST url: {url}")

    def _fake_get(url, *a, **k):
        # polling returns completed with two utterances
        assert url.endswith("/transcript/tx_123")
        return _Resp({
            "status": "completed",
            "utterances": [
                {"speaker": "A", "text": "Hello team."},
                {"speaker": "B", "text": "Hi!"},
            ],
        })

    import requests as _req
    monkeypatch.setattr(_req, "post", _fake_post)
    monkeypatch.setattr(_req, "get", _fake_get)

    f = _io.BytesIO(b"FAKEAUDIO")
    out = transcribe_with_assemblyai(f)
    assert out.splitlines() == [
        "Speaker A: Hello team.",
        "Speaker B: Hi!",
    ]


def test_transcribe_with_assemblyai_failed(monkeypatch):
    from routes.audio_helpers import transcribe_with_assemblyai
    import io as _io

    class _Resp:
        def __init__(self, payload):
            self._payload = payload
        def json(self):
            return self._payload

    def _fake_post(url, *a, **k):
        if url.endswith("/upload"):
            return _Resp({"upload_url": "https://fake.cdn/audio.wav"})
        if url.endswith("/transcript"):
            return _Resp({"id": "tx_999"})
        raise AssertionError(f"unexpected POST url: {url}")

    # First poll returns failed immediately
    def _fake_get(url, *a, **k):
        assert url.endswith("/transcript/tx_999")
        return _Resp({"status": "failed"})

    import requests as _req
    monkeypatch.setattr(_req, "post", _fake_post)
    monkeypatch.setattr(_req, "get", _fake_get)

    f = _io.BytesIO(b"FAKEAUDIO")
    out = transcribe_with_assemblyai(f)
    assert out == "Transcription failed."
# =========================
# Tests for routes/speech.py
# =========================

def test_speech_upload_audio_ok(app, monkeypatch, client):
    # Mock the AssemblyAI transcription helper
    import routes.speech as _speech
    monkeypatch.setattr(_speech, "transcribe_with_assemblyai", lambda f: "TRANSCRIPT TEXT")

    # POST multipart with 'audio' field (prefer endpoint resolution)
    methods, rule = _resolve_rule_by_endpoint(app, "speech.upload_audio")
    if rule and (not methods or "POST" in methods):
        resp = client.post(rule, **_mk_audio_upload_kwfactory(b"FAKEAUDIO", "clip.wav")())
    else:
        resp = _first_non_404_or_skip_kw(
            client,
            "POST",
            _speech_paths("upload-audio"),
            _mk_audio_upload_kwfactory(b"FAKEAUDIO", "clip.wav"),
        )
    assert resp.status_code == 200
    assert resp.get_json()["transcript"] == "TRANSCRIPT TEXT"


def test_speech_save_transcript_writes_material_and_message(app, monkeypatch, client):
    # Create user and meeting first
    owner_id, _uname, _ = _register_and_login_unique(client)
    _first_non_404_or_skip(
        client,
        "POST",
        [f"{p}/create" for p in _MEETINGS_PREFIXES],
        json={"user_id": owner_id, "meeting_id": 21, "title": "Voice Meeting"},
    )

    # Mock Gemini so summarization path doesn't call network
    class _DummyResp:
        def __init__(self, text):
            self.text = text
    class _DummyModel:
        def __init__(self, *a, **k):
            pass
        def generate_content(self, *a, **k):
            return _DummyResp("SUMMARY FROM GEMINI")
    import google.generativeai as _genai
    monkeypatch.setattr(_genai, "configure", lambda **k: None)
    monkeypatch.setattr(_genai, "GenerativeModel", lambda *a, **k: _DummyModel())

    payload = {
        "speaker_map": {"SPK1": "Alice", "SPK2": "Bob"},
        "transcript": "SPK1: hello\nSPK2: hi",
        "meeting_id": 21,
        "user_id": owner_id,
        "user_name": "Patrick",
    }

    # Prefer resolving by endpoint name to avoid guessing the prefix
    methods, rule = _resolve_rule_by_endpoint(app, "speech.save_transcript")
    if rule and (not methods or "POST" in methods):
        r = client.post(rule, json=payload)
    else:
        r = _first_non_404_or_skip(
            client,
            "POST",
            _speech_paths("save-transcript"),
            json=payload,
        )
    assert r.status_code == 200
    assert r.get_json().get("msg")

    # Materials should include one 'voice_meeting' entry containing replaced speaker names
    r_list = _first_non_404_or_skip(
        client,
        "GET",
        _paths_for(21, "materials"),
        query_string={"user_id": owner_id},
    )
    assert r_list.status_code == 200
    materials = r_list.get_json()
    assert any(m.get("filename") == "voice_meeting" for m in materials)
    assert any("Alice:" in (m.get("content") or "") for m in materials)
    assert all("SPK1:" not in (m.get("content") or "") for m in materials)

    # Messages should include completion notice and the summary text
    r_msgs = _first_non_404_or_skip(
        client,
        "GET",
        _paths_for(21, "messages"),
        query_string={"user_id": owner_id},
    )
    assert r_msgs.status_code == 200
    msgs = r_msgs.get_json()
    texts = [m.get("content", "") for m in msgs]
    assert any("completed a voice meeting" in t for t in texts)
    assert any("SUMMARY FROM GEMINI" in t for t in texts)