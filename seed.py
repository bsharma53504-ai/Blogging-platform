import click
from flask.cli import with_appcontext

from models import Category, db


DEFAULT_CATEGORIES = ["Technology", "Programming", "Education", "Lifestyle", "Travel", "Business"]


@click.command("seed-categories")
@with_appcontext
def seed_categories():
    """Create the starter categories if they do not exist."""
    for name in DEFAULT_CATEGORIES:
        if not Category.query.filter_by(name=name).first():
            db.session.add(Category(name=name))
    db.session.commit()
    click.echo("Starter categories are ready.")
