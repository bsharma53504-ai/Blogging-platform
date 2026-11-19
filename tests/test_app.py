from io import BytesIO
import tempfile
import unittest
from pathlib import Path

from app import create_app
from models import Category, Post, User, db


class BloggingPlatformTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        root = Path(self.temporary_directory.name)
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-key-that-is-long-enough-for-flask",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "WTF_CSRF_ENABLED": False,
            "UPLOAD_FOLDER": str(root / "uploads"),
        })
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        self.temporary_directory.cleanup()

    def register(self, username="reader", email="reader@example.com"):
        return self.client.post("/register", data={
            "username": username,
            "email": email,
            "password": "a-strong-password",
            "confirm_password": "a-strong-password",
            "submit": "Create account",
        }, follow_redirects=True)

    def login(self, email="reader@example.com"):
        return self.client.post("/login", data={
            "email": email,
            "password": "a-strong-password",
            "submit": "Sign in",
        }, follow_redirects=True)

    def test_registration_login_and_profile_page(self):
        response = self.register()
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Your account is ready", response.data)
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"reader", response.data)
        self.assertEqual(self.client.get("/profile").status_code, 200)

    def test_story_create_like_and_comment(self):
        self.register()
        self.login()
        with self.app.app_context():
            category_id = Category.query.filter_by(name="Technology").first().id
        response = self.client.post("/create", data={
            "title": "A thoughtful story",
            "category_id": str(category_id),
            "tags": "ideas, learning",
            "content": "This is a longer story that meets the minimum required length.",
            "submit": "Publish story",
        })
        self.assertEqual(response.status_code, 302)
        post_id = int(response.headers["Location"].rsplit("/", 1)[-1])
        self.assertEqual(self.client.get(f"/post/{post_id}").status_code, 200)
        self.client.post(f"/like/{post_id}")
        self.client.post(f"/comment/{post_id}", data={
            "content": "A thoughtful comment",
            "submit": "Post comment",
        })
        with self.app.app_context():
            post = db.session.get(Post, post_id)
            self.assertEqual(post.like_count, 1)
            self.assertEqual(len(post.comments), 1)
            self.assertEqual(post.tag_list, ["ideas", "learning"])

    def test_users_cannot_edit_other_members_stories(self):
        self.register()
        self.login()
        with self.app.app_context():
            owner = User.query.filter_by(email="reader@example.com").first()
            category = Category.query.filter_by(name="Technology").first()
            post = Post(title="Private edit", content="This story is long enough to satisfy validation.", author=owner, category=category)
            db.session.add(post)
            db.session.commit()
            post_id = post.id
        self.client.post("/logout")
        self.register(username="another", email="another@example.com")
        self.login("another@example.com")
        response = self.client.get(f"/edit/{post_id}")
        self.assertEqual(response.status_code, 403)

    def test_admin_pages_require_admin_role(self):
        self.register()
        self.login()
        self.assertEqual(self.client.get("/admin").status_code, 403)

    def test_admin_dashboard_and_category_creation(self):
        self.register()
        self.login()
        with self.app.app_context():
            user = User.query.filter_by(email="reader@example.com").first()
            user.is_admin = True
            db.session.commit()
        response = self.client.get("/admin")
        self.assertEqual(response.status_code, 200)
        response = self.client.post("/admin/category", data={
            "name": "Design",
            "submit": "Add category",
        }, follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Design", response.data)

    def test_upload_rejects_mismatched_image_content(self):
        self.register()
        self.login()
        with self.app.app_context():
            category_id = Category.query.filter_by(name="Technology").first().id
        response = self.client.post("/create", data={
            "title": "A story with a cover",
            "category_id": str(category_id),
            "content": "This story has enough text to pass the content length validator.",
            "image": (BytesIO(b"not an actual image"), "cover.png", "image/png"),
        }, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"does not match its image type", response.data)

    def test_homepage_searches_story_titles_and_categories(self):
        self.register()
        self.login()
        with self.app.app_context():
            author = User.query.filter_by(email="reader@example.com").first()
            category = Category.query.filter_by(name="Technology").first()
            db.session.add(Post(
                title="Finding quiet focus",
                content="A long enough story about finding quiet focus in a busy world.",
                author=author,
                category=category,
            ))
            db.session.commit()
        response = self.client.get("/?q=quiet")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Finding quiet focus", response.data)


if __name__ == "__main__":
    unittest.main()
