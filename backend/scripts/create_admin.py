import sys
from pathlib import Path

import bcrypt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app


def hash_password(password):
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=12)).decode("utf-8")


def main():
    if len(sys.argv) != 4:
        raise SystemExit('Usage: python backend/scripts/create_admin.py <email> "<name>" "<password>"')
    email, name, password = sys.argv[1:]
    if len(password) < 12:
        raise SystemExit("Admin password must be at least 12 characters.")

    app = create_app()
    try:
        client = app.extensions["mongo_client"]
        client.admin.command("ping")
        users = app.extensions["db"].users
        result = users.update_one(
            {"email": email.strip().lower()},
            {
                "$set": {
                    "name": name.strip(),
                    "role": "admin",
                },
                "$setOnInsert": {
                    "email": email.strip().lower(),
                    "password": hash_password(password),
                    "profileImage": "",
                    "createdAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
                },
            },
            upsert=True,
        )
        print("Administrator created." if result.upserted_id else "User promoted to administrator.")
    finally:
        app.extensions["mongo_client"].close()


if __name__ == "__main__":
    main()
