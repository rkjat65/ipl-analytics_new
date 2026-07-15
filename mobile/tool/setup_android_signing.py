#!/usr/bin/env python3
"""Create a private Android upload key without printing credentials."""

from pathlib import Path
import os
import secrets
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
KEYSTORE = ANDROID / "upload-keystore.jks"
PROPERTIES = ANDROID / "key.properties"
CERTIFICATE = ROOT / "store_assets" / "google_play" / "upload-certificate.pem"
ALIAS = "crickrida-upload"


def main() -> None:
    if KEYSTORE.exists() or PROPERTIES.exists():
        raise SystemExit("Signing files already exist; refusing to overwrite the upload identity.")

    candidates = [
        Path(os.environ.get("JAVA_HOME", "")) / "bin" / "keytool",
        Path("/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/keytool"),
        Path("/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"),
    ]
    keytool_path = next((path for path in candidates if path.is_file()), None)
    keytool = str(keytool_path) if keytool_path else shutil.which("keytool")
    if not keytool or keytool == "/usr/bin/keytool":
        raise SystemExit("keytool was not found. Install a JDK and try again.")

    password = secrets.token_urlsafe(32)
    subprocess.run(
        [
            keytool,
            "-genkeypair",
            "-v",
            "-keystore",
            str(KEYSTORE),
            "-storetype",
            "JKS",
            "-keyalg",
            "RSA",
            "-keysize",
            "4096",
            "-validity",
            "10000",
            "-alias",
            ALIAS,
            "-storepass",
            password,
            "-keypass",
            password,
            "-dname",
            "CN=Crickrida Upload, OU=Mobile, O=Crickrida, C=IN",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    PROPERTIES.write_text(
        "\n".join(
            [
                f"storePassword={password}",
                f"keyPassword={password}",
                f"keyAlias={ALIAS}",
                "storeFile=../upload-keystore.jks",
                "",
            ]
        ),
        encoding="utf-8",
    )
    PROPERTIES.chmod(0o600)

    CERTIFICATE.parent.mkdir(parents=True, exist_ok=True)
    with CERTIFICATE.open("wb") as output:
        subprocess.run(
            [
                keytool,
                "-exportcert",
                "-rfc",
                "-keystore",
                str(KEYSTORE),
                "-alias",
                ALIAS,
                "-storepass",
                password,
            ],
            check=True,
            stdout=output,
        )

    print(f"Created private upload key: {KEYSTORE}")
    print(f"Created private signing config: {PROPERTIES}")
    print(f"Created public upload certificate: {CERTIFICATE}")
    print("Back up the keystore and key.properties together in a secure password manager.")


if __name__ == "__main__":
    main()
