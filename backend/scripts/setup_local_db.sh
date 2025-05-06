#!/bin/bash

echo "Setting up local PostgreSQL database for TripSync development"

# Check if PostgreSQL is installed
if ! command -v psql >/dev/null 2>&1; then
  echo "Error: PostgreSQL is not installed. Please install PostgreSQL first."
  echo "On macOS, you can use: brew install postgresql"
  exit 1
fi

# Check if PostgreSQL server is running
pg_isready -q
if [ $? -ne 0 ]; then
  echo "PostgreSQL server is not running. Starting it now..."
  brew services start postgresql
  sleep 2  # Give it a moment to start
fi

# Get current user (for macOS PostgreSQL default config)
CURRENT_USER=$(whoami)
echo "Detected current user: $CURRENT_USER"

# Database settings
DB_NAME="tripsync_dev"
DB_USER=$CURRENT_USER
DB_PASSWORD=""

# Check if the database exists
if psql -d postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo "Database $DB_NAME exists. Dropping it to create a fresh database..."
  
  # Terminate existing connections to the database
  psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME';"
  
  # Drop the database
  dropdb $DB_NAME
  
  # Check if drop was successful
  if [ $? -ne 0 ]; then
    echo "Error: Failed to drop the database. Please check if there are active connections."
    exit 1
  else
    echo "Database $DB_NAME has been dropped successfully."
  fi
fi

# Create a fresh database
echo "Creating new database '$DB_NAME'..."
createdb $DB_NAME
echo "Database $DB_NAME created successfully"

echo "Local PostgreSQL setup complete!"
echo "Your development database is now configured at: $CONNECTION_STRING"
echo ""