# Inkwell

Inkwell is a server-rendered blogging platform built with Flask, Jinja, SQLite, Flask-Login, Flask-WTF, and Bootstrap. Readers can find stories by title, topic, or tag; members can publish and manage stories, like posts, and comment; administrators can manage members, posts, and topics.

## Requirements

- Python 3.10 or newer

## Run locally

1. Create and activate a virtual environment:

   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

2. Install dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env`. Set `SECRET_KEY` to a long, random value. SQLite and the starter topics are initialized automatically.
4. Start the website:

   ```powershell
   python app.py
   ```

   Visit `http://127.0.0.1:5000`.

The database is created at `instance/blog.db`. Uploaded cover images are stored in `static/uploads/` and are limited to 5 MB.

## Create an administrator

Create a regular account through the website, then run:

```powershell
flask --app app create-admin
```

Follow the prompts. The command promotes an existing account by email or creates a new administrator account. Administrator passwords must be at least 12 characters.

## Tests

```powershell
python -m unittest discover -s tests -v
```

## Project structure

```text
app.py                  Flask routes and application setup
config.py               Environment-based configuration
models.py               SQLite models and relationships
forms.py                Validated, CSRF-protected forms
seed.py                 Starter-topic CLI command
templates/              Jinja pages
static/css/style.css    Responsive styling
static/uploads/         Uploaded cover images
instance/blog.db        Local SQLite database (created on first run)
```
