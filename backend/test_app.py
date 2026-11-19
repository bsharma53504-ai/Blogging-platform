import os
import tempfile
import unittest

os.environ.setdefault("JWT_SECRET", "unit-test-secret-that-is-long-enough-123456")

from app import check_password, create_app, hash_password


class ApiSmokeTests(unittest.TestCase):
    def setUp(self):
        self.uploads = tempfile.TemporaryDirectory()
        self.app = create_app({
            "TESTING": True,
            "JWT_SECRET": "unit-test-secret-that-is-long-enough-123456",
            "UPLOAD_DIR": self.uploads.name,
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.app.extensions["mongo_client"].close()
        self.uploads.cleanup()

    def test_health_response(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_protected_route_rejects_anonymous_user(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["message"], "Please sign in to continue.")

    def test_registration_validates_email_before_database_access(self):
        response = self.client.post("/api/auth/register", json={
            "name": "Inkwell User",
            "email": "not-an-email",
            "password": "secure-password",
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["message"], "Enter a valid email address.")

    def test_password_hash_matches_existing_string_storage(self):
        hashed = hash_password("compatible-password")
        self.assertIsInstance(hashed, str)
        self.assertTrue(check_password("compatible-password", hashed))
        self.assertFalse(check_password("incorrect-password", hashed))


if __name__ == "__main__":
    unittest.main()
