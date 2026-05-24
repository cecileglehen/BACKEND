#!/usr/bin/env python3
import secrets


def main():
    key = secrets.token_urlsafe(48)
    print(f"MESSAGE_ENCRYPTION_KEY={key}")


if __name__ == "__main__":
    main()
