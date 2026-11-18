#!/bin/sh
# CLI only. The PHP entry point owns locking, reporting and all business operations.
# Select a supported CLI explicitly: shared hosting may use obsolete PHP on PATH.
worker_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 1
for candidate in "${BYPCMS_PHP_CLI:-}" /opt/alt/php82/usr/bin/php /opt/php82/bin/php /usr/bin/php8.2 /opt/alt/php83/usr/bin/php /opt/php83/bin/php /usr/bin/php8.3 php; do
    [ -n "$candidate" ] || continue
    if "$candidate" -r 'exit(PHP_VERSION_ID >= 80200 && extension_loaded("pdo_mysql") && extension_loaded("curl") && extension_loaded("openssl") && extension_loaded("mbstring") && extension_loaded("zip") && extension_loaded("zlib") ? 0 : 1);' >/dev/null 2>&1; then
        exec "$candidate" "$worker_dir/commerce-worker.php"
    fi
done
printf '%s\n' 'BYPCMS: PHP CLI >= 8.2 with pdo_mysql, curl, openssl, mbstring, zip and zlib is required. Set BYPCMS_PHP_CLI to the hosting PHP executable.' >&2
exit 127
