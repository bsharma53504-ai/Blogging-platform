import hashlib
import os
import re
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from functools import wraps
from pathlib import Path

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from flask import Flask, current_app, g, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

load_dotenv(Path(__file__).with_name(".env"))

STARTER_CATEGORIES = ["Technology", "Programming", "Education", "Lifestyle", "Travel", "Business", "Health"]
IMAGE_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def json_safe(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    return value


def public_user(user):
    if not user:
        return None
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "profileImage": user.get("profileImage", ""),
        "role": user.get("role", "user"),
        "createdAt": json_safe(user.get("createdAt")),
    }


def category_view(category, post_count=None):
    if not category:
        return None
    result = {
        "_id": str(category["_id"]),
        "name": category["name"],
        "description": category.get("description", ""),
    }
    if post_count is not None:
        result["postCount"] = post_count
    return result


def blog_view(blog, include_content=True):
    if not blog:
        return None
    author = current_app.extensions["db"].users.find_one({"_id": blog.get("author")})
    category = current_app.extensions["db"].categories.find_one({"_id": blog.get("category")})
    result = {
        "_id": str(blog["_id"]),
        "title": blog.get("title", ""),
        "slug": blog.get("slug", ""),
        "excerpt": blog.get("excerpt", ""),
        "coverImage": blog.get("coverImage", ""),
        "category": category_view(category),
        "author": {
            "_id": str(author["_id"]),
            "name": author.get("name", ""),
            "profileImage": author.get("profileImage", ""),
        } if author else None,
        "tags": blog.get("tags", []),
        "likes": [str(user_id) for user_id in blog.get("likes", [])],
        "status": blog.get("status", "draft"),
        "createdAt": json_safe(blog.get("createdAt")),
        "updatedAt": json_safe(blog.get("updatedAt")),
    }
    if include_content:
        result["content"] = blog.get("content", "")
    return result


def comment_view(comment):
    user = current_app.extensions["db"].users.find_one({"_id": comment.get("user")})
    return {
        "_id": str(comment["_id"]),
        "text": comment.get("text", ""),
        "createdAt": json_safe(comment.get("createdAt")),
        "user": {
            "_id": str(user["_id"]),
            "name": user.get("name", ""),
            "profileImage": user.get("profileImage", ""),
        } if user else None,
    }


def parse_object_id(value, message="Resource not found."):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise ApiError(message, 404) from None


def body_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def hash_password(password):
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=12)).decode("utf-8")


def check_password(password, hashed):
    encoded_hash = hashed.encode("utf-8") if isinstance(hashed, str) else hashed
    return bcrypt.checkpw(str(password).encode()[:72], encoded_hash)


def current_user(required=False):
    if hasattr(g, "current_user"):
        user = g.current_user
    else:
        user = None
        header = request.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else None
        if token:
            try:
                payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
                user_id = ObjectId(payload["sub"])
                user = current_app.extensions["db"].users.find_one({"_id": user_id})
            except (jwt.InvalidTokenError, InvalidId, KeyError, TypeError):
                user = None
        g.current_user = user
    if required and not user:
        raise ApiError("Please sign in to continue.", 401)
    return user


def protected(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        current_user(required=True)
        return handler(*args, **kwargs)
    return wrapped


def admin_only(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        user = current_user(required=True)
        if user.get("role") != "admin":
            raise ApiError("You do not have permission to do that.", 403)
        return handler(*args, **kwargs)
    return wrapped


def page_values(default_limit=9, maximum=24):
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(maximum, max(1, int(request.args.get("limit", default_limit))))
    except (TypeError, ValueError):
        page, limit = 1, default_limit
    return page, limit


def pagination(page, limit, total):
    return {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}


def slug_base(title):
    return SLUG_PATTERN.sub("-", title.lower()).strip("-") or "story"


def unique_slug(title, exclude_id=None):
    collection = current_app.extensions["db"].blogs
    base = slug_base(title)
    slug = base
    suffix = 2
    while True:
        query = {"slug": slug}
        if exclude_id is not None:
            query["_id"] = {"$ne": exclude_id}
        if collection.find_one(query, {"_id": 1}) is None:
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        PORT=int(os.getenv("PORT", "5000")),
        MONGODB_URI=os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/inkwell"),
        JWT_SECRET=os.getenv("JWT_SECRET", ""),
        JWT_EXPIRES_IN=os.getenv("JWT_EXPIRES_IN", "7d"),
        CLIENT_URL=os.getenv("CLIENT_URL", "http://localhost:5173"),
        UPLOAD_DIR=os.getenv("UPLOAD_DIR", "uploads"),
        MAX_FILE_SIZE_MB=max(1, int(os.getenv("MAX_FILE_SIZE_MB", "5"))),
        SMTP_HOST=os.getenv("SMTP_HOST", ""),
        SMTP_PORT=int(os.getenv("SMTP_PORT", "587")),
        SMTP_USER=os.getenv("SMTP_USER", ""),
        SMTP_PASS=os.getenv("SMTP_PASS", ""),
        SMTP_FROM=os.getenv("SMTP_FROM", ""),
        TESTING=False,
    )
    if test_config:
        app.config.update(test_config)
    if not app.config["JWT_SECRET"] or len(app.config["JWT_SECRET"]) < 32:
        raise RuntimeError("JWT_SECRET must be set to a random value of at least 32 characters.")

    upload_dir = Path(app.config["UPLOAD_DIR"])
    if not upload_dir.is_absolute():
        upload_dir = Path(__file__).parent / upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.config["UPLOAD_PATH"] = upload_dir
    app.config["MAX_CONTENT_LENGTH"] = app.config["MAX_FILE_SIZE_MB"] * 1024 * 1024

    mongo_client = app.config.get("MONGO_CLIENT") or MongoClient(app.config["MONGODB_URI"], serverSelectionTimeoutMS=5000)
    app.extensions["mongo_client"] = mongo_client
    app.extensions["db"] = app.config.get("MONGO_DATABASE") or mongo_client.get_default_database()
    CORS(app, origins=app.config["CLIENT_URL"])
    limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")
    app.extensions["limiter"] = limiter

    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return jsonify({"message": error.message}), error.status

    @app.errorhandler(DuplicateKeyError)
    def handle_duplicate(_error):
        return jsonify({"message": "A record with that value already exists."}), 409

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        return jsonify({"message": error.description}), error.code

    @app.errorhandler(413)
    def handle_large_upload(_error):
        return jsonify({"message": f"Image must be {app.config['MAX_FILE_SIZE_MB']} MB or smaller."}), 413

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Unhandled API error", exc_info=error)
        return jsonify({"message": "An unexpected server error occurred."}), 500

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_PATH"], filename, max_age=86400)

    @app.post("/api/auth/register")
    @limiter.limit("30 per 15 minutes")
    def register():
        data = body_json()
        name, email, password = data.get("name"), data.get("email"), data.get("password")
        if not isinstance(name, str) or not name.strip() or not isinstance(email, str) or not email.strip() or not password:
            raise ApiError("Name, email, and password are required.")
        if not EMAIL_PATTERN.fullmatch(email.strip()):
            raise ApiError("Enter a valid email address.")
        if not isinstance(password, str) or len(password) < 8:
            raise ApiError("Password must be at least 8 characters.")
        user = {
            "name": name.strip(),
            "email": email.strip().lower(),
            "password": hash_password(password),
            "profileImage": "",
            "role": "user",
            "createdAt": datetime.now(timezone.utc),
        }
        user["_id"] = app.extensions["db"].users.insert_one(user).inserted_id
        return auth_response(user, 201)

    @app.post("/api/auth/login")
    @limiter.limit("30 per 15 minutes")
    def login():
        data = body_json()
        email, password = data.get("email"), data.get("password")
        if not email or not password:
            raise ApiError("Email and password are required.")
        user = app.extensions["db"].users.find_one({"email": str(email).strip().lower()})
        if not user or not check_password(password, user["password"]):
            raise ApiError("Email or password is incorrect.", 401)
        return auth_response(user)

    @app.get("/api/auth/me")
    @protected
    def me():
        return jsonify({"user": public_user(current_user())})

    @app.patch("/api/auth/profile")
    @protected
    def update_profile():
        user = current_user()
        data = body_json()
        update = {}
        if "name" in data:
            name = data["name"]
            if not isinstance(name, str) or not 2 <= len(name.strip()) <= 60:
                raise ApiError("Name must be between 2 and 60 characters.")
            update["name"] = name.strip()
        if "email" in data:
            email = data["email"]
            if not isinstance(email, str) or not EMAIL_PATTERN.fullmatch(email.strip()):
                raise ApiError("Enter a valid email address.")
            update["email"] = email.strip().lower()
        if "profileImage" in data:
            if not isinstance(data["profileImage"], str):
                raise ApiError("Profile image must be a URL or path.")
            update["profileImage"] = data["profileImage"]
        if update:
            app.extensions["db"].users.update_one({"_id": user["_id"]}, {"$set": update})
            user.update(update)
        return jsonify({"user": public_user(user)})

    @app.patch("/api/auth/password")
    @protected
    def change_password():
        data = body_json()
        current, new = data.get("currentPassword"), data.get("newPassword")
        user = current_user()
        if not current or not isinstance(new, str) or len(new) < 8:
            raise ApiError("Provide your current password and a new password of at least 8 characters.")
        if not check_password(current, user["password"]):
            raise ApiError("Current password is incorrect.")
        user["password"] = hash_password(new)
        app.extensions["db"].users.update_one({"_id": user["_id"]}, {"$set": {"password": user["password"]}})
        return auth_response(user)

    @app.post("/api/auth/forgot-password")
    @limiter.limit("30 per 15 minutes")
    def forgot_password():
        if not (app.config["SMTP_HOST"] and app.config["SMTP_USER"] and app.config["SMTP_PASS"]):
            raise ApiError("Password reset email is not configured. Contact the site administrator.", 503)
        email = body_json().get("email")
        if not email:
            raise ApiError("Email is required.")
        user = app.extensions["db"].users.find_one({"email": str(email).strip().lower()})
        if user:
            raw_token = secrets.token_hex(32)
            hashed_token = hashlib.sha256(raw_token.encode()).hexdigest()
            expires = datetime.now(timezone.utc) + timedelta(hours=1)
            app.extensions["db"].users.update_one(
                {"_id": user["_id"]},
                {"$set": {"resetPasswordToken": hashed_token, "resetPasswordExpires": expires}},
            )
            reset_url = f"{app.config['CLIENT_URL'].rstrip('/')}/reset-password/{raw_token}"
            message = EmailMessage()
            message["Subject"] = "Reset your Inkwell password"
            message["From"] = app.config["SMTP_FROM"] or app.config["SMTP_USER"]
            message["To"] = user["email"]
            message.set_content(f"Use this link within one hour to reset your password: {reset_url}")
            try:
                smtp_class = smtplib.SMTP_SSL if app.config["SMTP_PORT"] == 465 else smtplib.SMTP
                with smtp_class(app.config["SMTP_HOST"], app.config["SMTP_PORT"]) as smtp:
                    if app.config["SMTP_PORT"] != 465:
                        smtp.starttls()
                    smtp.login(app.config["SMTP_USER"], app.config["SMTP_PASS"])
                    smtp.send_message(message)
            except Exception:
                app.extensions["db"].users.update_one(
                    {"_id": user["_id"]},
                    {"$unset": {"resetPasswordToken": "", "resetPasswordExpires": ""}},
                )
                raise
        return jsonify({"message": "If an account exists for that email, a reset link has been sent."})

    @app.post("/api/auth/reset-password/<token>")
    @limiter.limit("30 per 15 minutes")
    def reset_password(token):
        data = body_json()
        password = data.get("password")
        if not isinstance(password, str) or len(password) < 8:
            raise ApiError("Password must be at least 8 characters.")
        hashed = hashlib.sha256(token.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        user = app.extensions["db"].users.find_one({
            "resetPasswordToken": hashed,
            "resetPasswordExpires": {"$gt": now},
        })
        if not user:
            raise ApiError("This password reset link is invalid or has expired.")
        user["password"] = hash_password(password)
        app.extensions["db"].users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": user["password"]},
             "$unset": {"resetPasswordToken": "", "resetPasswordExpires": ""}},
        )
        return auth_response(user)

    @app.get("/api/blogs")
    def list_blogs():
        user = current_user()
        page, limit = page_values(default_limit=9, maximum=100 if request.args.get("mine") == "true" else 24)
        query = {}
        if request.args.get("adminAll") == "true" and user and user.get("role") == "admin":
            if request.args.get("status") and request.args["status"] != "all":
                query["status"] = request.args["status"]
        elif request.args.get("mine") == "true":
            if not user:
                raise ApiError("Sign in to view your stories.", 401)
            query["author"] = user["_id"]
            status = request.args.get("status")
            query["status"] = status if status and status != "all" else {"$in": ["draft", "published"]}
        else:
            query["status"] = "published"
        if request.args.get("category"):
            query["category"] = parse_object_id(request.args["category"], "Category not found.")
        search = request.args.get("search", "").strip()
        if search:
            expression = re.escape(search)
            query["$or"] = [
                {key: {"$regex": expression, "$options": "i"}}
                for key in ("title", "excerpt", "content", "tags")
            ]
        total = app.extensions["db"].blogs.count_documents(query)
        direction = 1 if request.args.get("sort") == "oldest" else -1
        blogs = app.extensions["db"].blogs.find(query).sort("createdAt", direction).skip((page - 1) * limit).limit(limit)
        return jsonify({"blogs": [blog_view(blog) for blog in blogs], "pagination": pagination(page, limit, total)})

    @app.post("/api/blogs")
    @protected
    def create_blog():
        data = body_json()
        title, content, excerpt, category = data.get("title"), data.get("content"), data.get("excerpt"), data.get("category")
        if not all(isinstance(item, str) and item.strip() for item in (title, content, excerpt)) or not category:
            raise ApiError("Title, content, excerpt, and category are required.")
        status = data.get("status", "draft")
        if status not in ("draft", "published"):
            raise ApiError("Status must be draft or published.")
        title, content, excerpt = title.strip(), content.strip(), excerpt.strip()
        if len(title) < 4 or len(title) > 140 or len(content) < 30 or len(excerpt) > 300:
            raise ApiError("Check the story title, content, and excerpt lengths.")
        category_id = parse_object_id(category, "Category not found.")
        if not app.extensions["db"].categories.find_one({"_id": category_id}):
            raise ApiError("Category not found.")
        now = datetime.now(timezone.utc)
        blog = {
            "title": title,
            "slug": unique_slug(title),
            "content": content,
            "excerpt": excerpt,
            "coverImage": data.get("coverImage") or "",
            "category": category_id,
            "author": current_user()["_id"],
            "tags": clean_tags(data.get("tags")),
            "likes": [],
            "status": status,
            "createdAt": now,
            "updatedAt": now,
        }
        blog["_id"] = app.extensions["db"].blogs.insert_one(blog).inserted_id
        return jsonify({"blog": blog_view(blog)}), 201

    @app.get("/api/blogs/<slug>/related")
    def related_blogs(slug):
        blog = app.extensions["db"].blogs.find_one({"slug": slug, "status": "published"})
        if not blog:
            raise ApiError("Story not found.", 404)
        matches = app.extensions["db"].blogs.find({
            "category": blog["category"], "status": "published", "_id": {"$ne": blog["_id"]},
        }).sort("createdAt", -1).limit(3)
        return jsonify({"blogs": [blog_view(item) for item in matches]})

    @app.get("/api/blogs/<slug>/comments")
    def list_comments(slug):
        blog = app.extensions["db"].blogs.find_one({"slug": slug, "status": "published"}, {"_id": 1})
        if not blog:
            raise ApiError("Story not found.", 404)
        comments = app.extensions["db"].comments.find({"blog": blog["_id"]}).sort("createdAt", -1)
        return jsonify({"comments": [comment_view(comment) for comment in comments]})

    @app.post("/api/blogs/<slug>/comments")
    @protected
    def create_comment(slug):
        blog = app.extensions["db"].blogs.find_one({"slug": slug, "status": "published"}, {"_id": 1})
        if not blog:
            raise ApiError("Story not found.", 404)
        text = body_json().get("text")
        if not isinstance(text, str) or not text.strip():
            raise ApiError("Comment text is required.")
        if len(text.strip()) > 2000:
            raise ApiError("Comment must be 2000 characters or fewer.")
        comment = {
            "blog": blog["_id"],
            "user": current_user()["_id"],
            "text": text.strip(),
            "createdAt": datetime.now(timezone.utc),
        }
        comment["_id"] = app.extensions["db"].comments.insert_one(comment).inserted_id
        return jsonify({"comment": comment_view(comment)}), 201

    @app.delete("/api/blogs/comments/<comment_id>")
    @protected
    def delete_comment(comment_id):
        comment = app.extensions["db"].comments.find_one({"_id": parse_object_id(comment_id, "Comment not found.")})
        if not comment:
            raise ApiError("Comment not found.", 404)
        user = current_user()
        if comment["user"] != user["_id"] and user.get("role") != "admin":
            raise ApiError("You can only delete your own comments.", 403)
        app.extensions["db"].comments.delete_one({"_id": comment["_id"]})
        return jsonify({"message": "Comment deleted."})

    @app.post("/api/blogs/<slug>/like")
    @protected
    def toggle_like(slug):
        collection = app.extensions["db"].blogs
        blog = collection.find_one({"slug": slug, "status": "published"})
        if not blog:
            raise ApiError("Story not found.", 404)
        user_id = current_user()["_id"]
        liked = user_id in blog.get("likes", [])
        update = {"$pull": {"likes": user_id}} if liked else {"$addToSet": {"likes": user_id}}
        updated = collection.find_one_and_update({"_id": blog["_id"]}, update, return_document=ReturnDocument.AFTER)
        return jsonify({"likes": len(updated.get("likes", [])), "liked": not liked})

    @app.route("/api/blogs/<blog_id>", methods=["PATCH", "DELETE"])
    @protected
    def modify_blog(blog_id):
        collection = app.extensions["db"].blogs
        blog = collection.find_one({"_id": parse_object_id(blog_id, "Story not found.")})
        if not blog:
            raise ApiError("Story not found.", 404)
        user = current_user()
        if blog["author"] != user["_id"] and user.get("role") != "admin":
            message = "You can only edit your own stories." if request.method == "PATCH" else "You can only delete your own stories."
            raise ApiError(message, 403)
        if request.method == "DELETE":
            collection.delete_one({"_id": blog["_id"]})
            app.extensions["db"].comments.delete_many({"blog": blog["_id"]})
            return jsonify({"message": "Story deleted."})

        data = body_json()
        allowed = ("title", "content", "excerpt", "coverImage", "category", "tags", "status")
        update = {key: data[key] for key in allowed if key in data}
        if "title" in update:
            if not isinstance(update["title"], str) or not update["title"].strip():
                raise ApiError("Title is required.")
            update["title"] = update["title"].strip()
            if len(update["title"]) < 4 or len(update["title"]) > 140:
                raise ApiError("Title must be between 4 and 140 characters.")
            update["slug"] = unique_slug(update["title"], blog["_id"])
        if "content" in update:
            if not isinstance(update["content"], str) or len(update["content"].strip()) < 30:
                raise ApiError("Story content must be at least 30 characters.")
            update["content"] = update["content"].strip()
        if "excerpt" in update:
            if not isinstance(update["excerpt"], str) or len(update["excerpt"].strip()) > 300:
                raise ApiError("Excerpt must be 300 characters or fewer.")
            update["excerpt"] = update["excerpt"].strip()
        if "category" in update:
            update["category"] = parse_object_id(update["category"], "Category not found.")
            if not app.extensions["db"].categories.find_one({"_id": update["category"]}):
                raise ApiError("Category not found.")
        if "tags" in update:
            update["tags"] = clean_tags(update["tags"])
        if "status" in update and update["status"] not in ("draft", "published"):
            raise ApiError("Status must be draft or published.")
        update["updatedAt"] = datetime.now(timezone.utc)
        collection.update_one({"_id": blog["_id"]}, {"$set": update})
        blog.update(update)
        return jsonify({"blog": blog_view(blog)})

    @app.get("/api/blogs/<slug>")
    def get_blog(slug):
        user = current_user()
        blog = app.extensions["db"].blogs.find_one({"slug": slug})
        if not blog or (
            blog.get("status") != "published"
            and (not user or (blog["author"] != user["_id"] and user.get("role") != "admin"))
        ):
            raise ApiError("This story could not be found.", 404)
        return jsonify({"blog": blog_view(blog)})

    @app.get("/api/categories")
    def list_categories():
        categories = app.extensions["db"].categories.find().sort("name", 1)
        result = []
        for category in categories:
            count = app.extensions["db"].blogs.count_documents({"category": category["_id"], "status": "published"})
            result.append(category_view(category, count))
        return jsonify({"categories": result})

    @app.post("/api/categories")
    @admin_only
    def create_category():
        data = body_json()
        name = data.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ApiError("Category name is required.")
        if len(name.strip()) > 40:
            raise ApiError("Category name must be 40 characters or fewer.")
        category = {"name": name.strip(), "description": data.get("description", "")}
        if not isinstance(category["description"], str) or len(category["description"]) > 240:
            raise ApiError("Category description must be 240 characters or fewer.")
        category["_id"] = app.extensions["db"].categories.insert_one(category).inserted_id
        return jsonify({"category": category_view(category)}), 201

    @app.patch("/api/categories/<category_id>")
    @admin_only
    def update_category(category_id):
        collection = app.extensions["db"].categories
        category = collection.find_one({"_id": parse_object_id(category_id, "Category not found.")})
        if not category:
            raise ApiError("Category not found.", 404)
        data = body_json()
        update = {}
        if "name" in data:
            if not isinstance(data["name"], str) or not data["name"].strip() or len(data["name"].strip()) > 40:
                raise ApiError("Category name must be between 1 and 40 characters.")
            update["name"] = data["name"].strip()
        if "description" in data:
            if not isinstance(data["description"], str) or len(data["description"]) > 240:
                raise ApiError("Category description must be 240 characters or fewer.")
            update["description"] = data["description"]
        if update:
            collection.update_one({"_id": category["_id"]}, {"$set": update})
            category.update(update)
        return jsonify({"category": category_view(category)})

    @app.delete("/api/categories/<category_id>")
    @admin_only
    def delete_category(category_id):
        collection = app.extensions["db"].categories
        category = collection.find_one({"_id": parse_object_id(category_id, "Category not found.")})
        if not category:
            raise ApiError("Category not found.", 404)
        if app.extensions["db"].blogs.find_one({"category": category["_id"]}, {"_id": 1}):
            raise ApiError("Reassign or delete posts in this category before removing it.", 409)
        collection.delete_one({"_id": category["_id"]})
        return jsonify({"message": "Category deleted."})

    @app.post("/api/uploads")
    @protected
    def upload_image():
        image = request.files.get("image")
        if image is None or not image.filename:
            raise ApiError("Choose an image to upload.")
        extension = Path(secure_filename(image.filename)).suffix.lower()
        if image.mimetype not in IMAGE_TYPES or extension not in IMAGE_TYPES[image.mimetype]:
            raise ApiError("Only JPEG, PNG, WebP, or GIF images are allowed.")
        filename = f"{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4()}{extension}"
        image.save(app.config["UPLOAD_PATH"] / filename)
        return jsonify({"url": f"/uploads/{filename}"}), 201

    @app.get("/api/admin/stats")
    @admin_only
    def dashboard_stats():
        db = app.extensions["db"]
        return jsonify({"stats": {
            "users": db.users.count_documents({}),
            "blogs": db.blogs.count_documents({}),
            "published": db.blogs.count_documents({"status": "published"}),
            "drafts": db.blogs.count_documents({"status": "draft"}),
            "comments": db.comments.count_documents({}),
        }})

    @app.get("/api/admin/users")
    @admin_only
    def list_users():
        page, limit = page_values(default_limit=20, maximum=50)
        collection = app.extensions["db"].users
        users = collection.find().sort("createdAt", -1).skip((page - 1) * limit).limit(limit)
        total = collection.count_documents({})
        return jsonify({"users": [public_user(user) for user in users], "pagination": pagination(page, limit, total)})

    @app.patch("/api/admin/users/<user_id>/role")
    @admin_only
    def update_user_role(user_id):
        user = current_user()
        target_id = parse_object_id(user_id, "User not found.")
        if user["_id"] == target_id:
            raise ApiError("You cannot change your own role.")
        role = body_json().get("role")
        if role not in ("user", "admin"):
            raise ApiError("Role must be user or admin.")
        target = app.extensions["db"].users.find_one_and_update(
            {"_id": target_id}, {"$set": {"role": role}}, return_document=ReturnDocument.AFTER,
        )
        if not target:
            raise ApiError("User not found.", 404)
        return jsonify({"user": public_user(target)})

    @app.delete("/api/admin/users/<user_id>")
    @admin_only
    def delete_user(user_id):
        current = current_user()
        target_id = parse_object_id(user_id, "User not found.")
        if current["_id"] == target_id:
            raise ApiError("You cannot delete your own account from admin tools.")
        db = app.extensions["db"]
        target = db.users.find_one({"_id": target_id})
        if not target:
            raise ApiError("User not found.", 404)
        blog_ids = [blog["_id"] for blog in db.blogs.find({"author": target_id}, {"_id": 1})]
        db.blogs.delete_many({"author": target_id})
        db.blogs.update_many({"likes": target_id}, {"$pull": {"likes": target_id}})
        db.comments.delete_many({"$or": [{"user": target_id}, {"blog": {"$in": blog_ids}}]})
        db.users.delete_one({"_id": target_id})
        return jsonify({"message": "User and their content deleted."})

    @app.get("/api/admin/blogs")
    @admin_only
    def list_all_blogs():
        page, limit = page_values(default_limit=20, maximum=50)
        status = request.args.get("status")
        query = {"status": status} if status and status != "all" else {}
        collection = app.extensions["db"].blogs
        blogs = collection.find(query).sort("createdAt", -1).skip((page - 1) * limit).limit(limit)
        total = collection.count_documents(query)
        return jsonify({"blogs": [blog_view(blog) for blog in blogs], "pagination": pagination(page, limit, total)})

    @app.delete("/api/admin/blogs/<blog_id>")
    @admin_only
    def admin_delete_blog(blog_id):
        blog = app.extensions["db"].blogs.find_one({"_id": parse_object_id(blog_id, "Story not found.")})
        if not blog:
            raise ApiError("Story not found.", 404)
        app.extensions["db"].blogs.delete_one({"_id": blog["_id"]})
        app.extensions["db"].comments.delete_many({"blog": blog["_id"]})
        return jsonify({"message": "Story deleted."})

    return app


def auth_response(user, status=200):
    expires_in = current_app.config["JWT_EXPIRES_IN"]
    match = re.fullmatch(r"(\d+)([smhd]?)", str(expires_in))
    if match:
        amount = int(match.group(1))
        unit = match.group(2) or "s"
        delta = timedelta(seconds=amount * {"s": 1, "m": 60, "h": 3600, "d": 86400}[unit])
    else:
        raise RuntimeError("JWT_EXPIRES_IN must be a number followed by s, m, h, or d.")
    token = jwt.encode(
        {"sub": str(user["_id"]), "exp": datetime.now(timezone.utc) + delta},
        current_app.config["JWT_SECRET"],
        algorithm="HS256",
    )
    return jsonify({"token": token, "user": public_user(user)}), status


def clean_tags(tags):
    if not isinstance(tags, list):
        return []
    return [str(tag).strip()[:30] for tag in tags if str(tag).strip()][:10]


def initialize_database(app):
    client = app.extensions["mongo_client"]
    client.admin.command("ping")
    db = app.extensions["db"]
    db.users.create_index("email", unique=True)
    db.blogs.create_index("slug", unique=True)
    db.categories.create_index("name", unique=True)
    db.blogs.create_index([("status", 1), ("createdAt", -1)])
    db.comments.create_index("blog")
    for name in STARTER_CATEGORIES:
        db.categories.update_one(
            {"name": name},
            {"$setOnInsert": {"name": name, "description": f"{name} stories and ideas"}},
            upsert=True,
        )


if __name__ == "__main__":
    app = create_app()
    initialize_database(app)
    try:
        app.run(host="0.0.0.0", port=app.config["PORT"], debug=False)
    finally:
        app.extensions["mongo_client"].close()
