#!/bin/bash
set -e

echo "=== Initializing MariaDB ==="
# Initialize MariaDB directory if not already initialized
if [ ! -d "/var/lib/mysql/mysql" ]; then
    mysql_install_db --user=mysql --datadir=/var/lib/mysql
fi

# Start MariaDB service
echo "=== Starting MariaDB ==="
mysqld_safe --datadir=/var/lib/mysql &

# Wait for MariaDB to start up
echo "Waiting for MariaDB to start..."
until mysqladmin ping --silent; do
    sleep 1
done

echo "=== Creating database and user ==="
mysql -e "CREATE DATABASE IF NOT EXISTS consumables_db;"
mysql -e "CREATE USER IF NOT EXISTS 'admin'@'localhost' IDENTIFIED BY 'admin123';"
mysql -e "GRANT ALL PRIVILEGES ON consumables_db.* TO 'admin'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "=== Executing database schema.sql ==="
if [ -f "/app/schema.sql" ]; then
    mysql consumables_db < /app/schema.sql
    echo "Database schema imported successfully."
else
    echo "Warning: schema.sql not found at /app/schema.sql"
fi

echo "=== Database is ready! ==="

echo "=== Starting web server to serve Consumables Hub ==="
node server.js
