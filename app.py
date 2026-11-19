import os
import secrets
from functools import wraps
from pathlib import Path
from urllib.parse import urljoin, urlparse
from uuid import uuid4

import click
from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)
from flask.cli import with_appcontext
from flask_login import (
    LoginManager,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_wtf.csrf import CSRFProtect
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from config import BASE_DIR, Config
from forms import CategoryForm, CommentForm, LoginForm, PostForm, ProfileForm, RegisterForm
from models import Category, Comment, Post, User, db
from seed import seed_categories

load_dotenv(BASE_DIR / ".env")

login_manager = LoginManager()
csrf = CSRFProtect()


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "login"
    login_manager.login_message = "Please sign in to continue."
    login_manager.login_message_category = "info"
    csrf.init_app(app)

    with app.app_context():
        db.create_all()
        for category_name in ("Technology", "Programming", "Education", "Lifestyle", "Travel", "Business"):
            if not Category.query.filter_by(name=category_name).first():
                db.session.add(Category(name=category_name))
        db.session.commit()

    app.cli.add_command(seed_categories)
    app.cli.add_command(create_admin_command)

    @app.context_processor
    def inject_categories():
        from datetime import date

        return {
            "site_categories": Category.query.order_by(Category.name.asc()).all(),
            "current_year": date.today().year,
        }

    @app.errorhandler(403)
    def forbidden(_error):
        return render_template("error.html", code=403, message="You do not have permission to view this page."), 403

    @app.errorhandler(404)
    def not_found(_error):
        return render_template("error.html", code=404, message="The page you are looking for does not exist."), 404

    @app.errorhandler(413)
    def upload_too_large(_error):
        flash("That image is too large. Choose a file smaller than 5 MB.", "danger")
        return redirect(request.referrer or url_for("index"))

    @app.get("/")
    def index():
        page = max(1, request.args.get("page", 1, type=int))
        search = request.args.get("q", "").strip()[:100]
        category_id = request.args.get("category", type=int)
        query = Post.query
        if search:
            pattern = f"%{search}%"
            query = query.outerjoin(Category).filter(
                or_(
                    Post.title.ilike(pattern),
                    Post.content.ilike(pattern),
                    Post.tags.ilike(pattern),
                    Category.name.ilike(pattern),
                )
            )
        if category_id:
            query = query.filter(Post.category_id == category_id)
        pagination = query.order_by(Post.created_at.desc()).paginate(
            page=page, per_page=9, error_out=False
        )
        return render_template(
            "index.html",
            posts=pagination.items,
            pagination=pagination,
            search=search,
            selected_category=category_id,
        )

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if current_user.is_authenticated:
            return redirect(url_for("index"))
        form = RegisterForm()
        if form.validate_on_submit():
            user = User(
                username=form.username.data.strip(),
                email=form.email.data.strip().lower(),
            )
            user.set_password(form.password.data)
            db.session.add(user)
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                flash("That username or email is already in use.", "danger")
            else:
                flash("Your account is ready. Sign in to start writing.", "success")
                return redirect(url_for("login"))
        return render_template("register.html", form=form)

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if current_user.is_authenticated:
            return redirect(url_for("index"))
        form = LoginForm()
        if form.validate_on_submit():
            email = form.email.data.strip().lower()
            user = User.query.filter_by(email=email).first()
            if user and user.check_password(form.password.data):
                login_user(user, remember=False)
                flash(f"Welcome back, {user.username}.", "success")
                next_url = request.args.get("next")
                if next_url and _is_safe_redirect(next_url):
                    return redirect(next_url)
                return redirect(url_for("index"))
            flash("Email or password is incorrect.", "danger")
        return render_template("login.html", form=form)

    @app.post("/logout")
    @login_required
    def logout():
        logout_user()
        flash("You have been signed out.", "info")
        return redirect(url_for("index"))

    @app.route("/profile", methods=["GET", "POST"])
    @login_required
    def profile():
        form = ProfileForm(obj=current_user)
        if form.validate_on_submit():
            current_user.username = form.username.data.strip()
            current_user.email = form.email.data.strip().lower()
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                flash("That username or email is already in use.", "danger")
            else:
                flash("Your profile has been updated.", "success")
                return redirect(url_for("profile"))
        return render_template("profile.html", form=form)

    @app.get("/dashboard")
    @login_required
    def dashboard():
        posts = Post.query.filter_by(user_id=current_user.id).order_by(Post.created_at.desc()).all()
        return render_template("dashboard.html", posts=posts)

    @app.route("/create", methods=["GET", "POST"])
    @login_required
    def create_post():
        form = PostForm()
        _set_category_choices(form)
        if form.validate_on_submit():
            image_path = _save_image(request.files.get("image"))
            if image_path is None:
                return render_template("create_post.html", form=form)
            post = Post(
                title=form.title.data.strip(),
                content=form.content.data.strip(),
                tags=_clean_tags(form.tags.data),
                image_path=image_path,
                category_id=form.category_id.data,
                author=current_user,
            )
            db.session.add(post)
            db.session.commit()
            flash("Your story is published.", "success")
            return redirect(url_for("post_detail", post_id=post.id))
        return render_template("create_post.html", form=form)

    @app.get("/post/<int:post_id>")
    def post_detail(post_id):
        post = db.get_or_404(Post, post_id)
        return render_template("post_detail.html", post=post, form=CommentForm())

    @app.route("/edit/<int:post_id>", methods=["GET", "POST"])
    @login_required
    def edit_post(post_id):
        post = db.get_or_404(Post, post_id)
        _require_post_owner(post)
        form = PostForm(obj=post)
        _set_category_choices(form)
        if request.method == "GET":
            form.tags.data = post.tags
            form.category_id.data = post.category_id
        if form.validate_on_submit():
            image_path = post.image_path
            uploaded_image = request.files.get("image")
            if uploaded_image and uploaded_image.filename:
                new_image_path = _save_image(uploaded_image)
                if new_image_path is None:
                    return render_template("edit_post.html", form=form, post=post)
                _remove_image(image_path)
                image_path = new_image_path
            post.title = form.title.data.strip()
            post.content = form.content.data.strip()
            post.tags = _clean_tags(form.tags.data)
            post.category_id = form.category_id.data
            post.image_path = image_path
            db.session.commit()
            flash("Your story has been updated.", "success")
            return redirect(url_for("post_detail", post_id=post.id))
        return render_template("edit_post.html", form=form, post=post)

    @app.post("/delete/<int:post_id>")
    @login_required
    def delete_post(post_id):
        post = db.get_or_404(Post, post_id)
        _require_post_owner(post)
        _remove_image(post.image_path)
        db.session.delete(post)
        db.session.commit()
        flash("Your story has been deleted.", "success")
        return redirect(url_for("dashboard"))

    @app.post("/like/<int:post_id>")
    @login_required
    def like_post(post_id):
        post = db.get_or_404(Post, post_id)
        if post in current_user.liked_posts:
            current_user.liked_posts.remove(post)
        else:
            current_user.liked_posts.append(post)
        db.session.commit()
        return redirect(request.referrer or url_for("post_detail", post_id=post.id))

    @app.post("/comment/<int:post_id>")
    @login_required
    def add_comment(post_id):
        post = db.get_or_404(Post, post_id)
        form = CommentForm()
        if form.validate_on_submit():
            comment = Comment(
                content=form.content.data.strip(),
                author=current_user,
                post=post,
            )
            db.session.add(comment)
            db.session.commit()
            flash("Your comment has been added.", "success")
        else:
            flash("Write a comment of 1 to 2000 characters.", "danger")
        return redirect(url_for("post_detail", post_id=post.id))

    @app.post("/comment/<int:comment_id>/delete")
    @login_required
    def delete_comment(comment_id):
        comment = db.get_or_404(Comment, comment_id)
        if comment.user_id != current_user.id and not current_user.is_admin:
            abort(403)
        post_id = comment.post_id
        db.session.delete(comment)
        db.session.commit()
        flash("The comment has been deleted.", "success")
        return redirect(url_for("post_detail", post_id=post_id))

    @app.get("/admin")
    @admin_required
    def admin_dashboard():
        users = User.query.order_by(User.created_at.desc()).all()
        posts = Post.query.order_by(Post.created_at.desc()).all()
        categories = Category.query.order_by(Category.name.asc()).all()
        category_form = CategoryForm()
        stats = {
            "users": User.query.count(),
            "posts": Post.query.count(),
            "comments": Comment.query.count(),
        }
        return render_template(
            "admin.html",
            users=users,
            posts=posts,
            categories=categories,
            category_form=category_form,
            stats=stats,
        )

    @app.post("/admin/category")
    @admin_required
    def create_category():
        form = CategoryForm()
        if form.validate_on_submit():
            name = form.name.data.strip()
            if Category.query.filter(func.lower(Category.name) == name.lower()).first():
                flash("That category already exists.", "danger")
            else:
                db.session.add(Category(name=name))
                db.session.commit()
                flash("Category added.", "success")
        else:
            flash("Category names must be between 2 and 60 characters.", "danger")
        return redirect(url_for("admin_dashboard"))

    @app.post("/admin/user/<int:user_id>/role")
    @admin_required
    def update_user_role(user_id):
        user = db.get_or_404(User, user_id)
        if user.id == current_user.id:
            flash("You cannot change your own administrator role.", "danger")
        else:
            user.is_admin = not user.is_admin
            db.session.commit()
            flash(f"{user.username}'s role has been updated.", "success")
        return redirect(url_for("admin_dashboard"))

    @app.post("/admin/user/<int:user_id>/delete")
    @admin_required
    def admin_delete_user(user_id):
        user = db.get_or_404(User, user_id)
        if user.id == current_user.id:
            flash("You cannot delete your own administrator account.", "danger")
        else:
            for post in user.posts:
                _remove_image(post.image_path)
            db.session.delete(user)
            db.session.commit()
            flash("User and their content have been deleted.", "success")
        return redirect(url_for("admin_dashboard"))

    @app.post("/admin/post/<int:post_id>/delete")
    @admin_required
    def admin_delete_post(post_id):
        post = db.get_or_404(Post, post_id)
        _remove_image(post.image_path)
        db.session.delete(post)
        db.session.commit()
        flash("The story has been deleted.", "success")
        return redirect(url_for("admin_dashboard"))

    return app


@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not current_user.is_admin:
            abort(403)
        return view(*args, **kwargs)

    return wrapped


@click.command("create-admin")
@with_appcontext
def create_admin_command():
    """Create or promote an administrator account."""
    email = click.prompt("Email").strip().lower()
    username = click.prompt("Username").strip()
    password = click.prompt("Password", hide_input=True, confirmation_prompt=True)
    if len(password) < 12:
        raise click.ClickException("Administrator passwords must be at least 12 characters.")
    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
    user.username = username
    user.is_admin = True
    db.session.commit()
    click.echo(f"Administrator account ready for {email}.")


def _is_safe_redirect(target):
    base = urlparse(request.host_url)
    candidate = urlparse(urljoin(request.host_url, target))
    return candidate.scheme in ("http", "https") and base.netloc == candidate.netloc


def _set_category_choices(form):
    categories = Category.query.order_by(Category.name.asc()).all()
    form.category_id.choices = [(category.id, category.name) for category in categories]
    if not categories:
        form.category_id.choices = [(0, "No categories available")]


def _clean_tags(value):
    if not value:
        return ""
    tags = []
    for tag in value.split(","):
        normalized = tag.strip()[:30]
        if normalized and normalized.lower() not in {item.lower() for item in tags}:
            tags.append(normalized)
        if len(tags) == 10:
            break
    return ", ".join(tags)


def _save_image(upload):
    if upload is None or not upload.filename:
        return ""
    filename = secure_filename(upload.filename)
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in current_app.config["ALLOWED_IMAGE_EXTENSIONS"]:
        flash("Choose a JPG, PNG, WebP, or GIF image.", "danger")
        return None
    header = upload.stream.read(12)
    upload.stream.seek(0)
    signatures = {
        "jpg": header.startswith(b"\xff\xd8\xff"),
        "jpeg": header.startswith(b"\xff\xd8\xff"),
        "png": header.startswith(b"\x89PNG\r\n\x1a\n"),
        "gif": header.startswith((b"GIF87a", b"GIF89a")),
        "webp": header.startswith(b"RIFF") and header[8:12] == b"WEBP",
    }
    if not signatures[extension]:
        flash("The uploaded file does not match its image type.", "danger")
        return None
    unique_name = f"{uuid4().hex}.{extension}"
    upload.save(Path(current_app.config["UPLOAD_FOLDER"]) / unique_name)
    return f"uploads/{unique_name}"


def _remove_image(image_path):
    if not image_path or not image_path.startswith("uploads/"):
        return
    image = Path(current_app.config["UPLOAD_FOLDER"]) / Path(image_path).name
    if image.is_file():
        image.unlink()


def _require_post_owner(post):
    if post.user_id != current_user.id and not current_user.is_admin:
        abort(403)


app = create_app()


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )
