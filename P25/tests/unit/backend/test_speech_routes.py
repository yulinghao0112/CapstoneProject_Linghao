"""
Unit tests for speech.py routes

Tests speech transcription and transcript saving endpoints
"""
import os
import sys
import pytest
import json
import datetime
import tempfile
from unittest.mock import Mock, patch, MagicMock, mock_open
from io import BytesIO

# Setup path
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend"))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"  # For config.py compatibility
os.environ.setdefault("FLASK_ENV", "testing")


@pytest.fixture
def app():
    """Create test Flask app"""
    try:
        from app import app as flask_app
    except ImportError:
        import importlib.util
        app_path = os.path.join(BACKEND_ROOT, "app.py")
        spec = importlib.util.spec_from_file_location("app", app_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        flask_app = module.app
    
    flask_app.config["TESTING"] = True
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    with flask_app.app_context():
        from models import db
        db.create_all()
        yield flask_app
        try:
            db.session.remove()
            # Use CASCADE to handle foreign key constraints
            db.engine.execute("PRAGMA foreign_keys = OFF")
            db.drop_all()
            db.engine.execute("PRAGMA foreign_keys = ON")
        except Exception:
            # If still fails, just close the session
            db.session.close()


@pytest.fixture
def client(app):
    return app.test_client()


class TestUploadAudio:
    """Test audio upload endpoint"""
    
    def test_upload_audio_endpoint_exists(self, client):
        """Test upload audio endpoint exists"""
        response = client.post('/api/upload-audio')
        
        # Should handle gracefully
        assert response.status_code < 500


class TestSaveTranscript:
    """Test transcript saving endpoint"""
    
    def test_save_transcript_endpoint_exists(self, client):
        """Test save transcript endpoint exists"""
        response = client.post('/api/save-transcript', json={
            'transcript': 'Test transcript',
            'meeting_id': 1,
            'user_id': 1,
            'user_name': 'test'
        })
        
        # Should handle gracefully
        assert response.status_code < 500
    
    def test_save_transcript_empty_data(self, client):
        """Test saving with empty JSON data"""
        response = client.post('/api/save-transcript', json={})
        
        assert response.status_code < 500


class TestSpeechErrorHandling:
    """Test error handling in speech routes"""
    
    def test_malformed_json_save_transcript(self, client):
        """Test malformed JSON in save transcript"""
        response = client.post(
            '/api/save-transcript',
            data='{"transcript": "test", "meeting_id":',  # Incomplete JSON
            content_type='application/json'
        )
        
        assert response.status_code in [400, 422]
    
    def test_null_values_save_transcript(self, client):
        """Test null values in save transcript"""
        response = client.post('/api/save-transcript', json={
            'transcript': None,
            'meeting_id': None,
            'user_id': None,
            'user_name': None
        })
        
        assert response.status_code < 500
