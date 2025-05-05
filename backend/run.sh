#!/bin/bash

# Navigate to the backend directory (just in case)
cd "$(dirname "$0")"

# Activate the virtual environment
source venv/bin/activate

# Set the Flask port
export FLASK_APP=app.py
export FLASK_RUN_PORT=5555

# Run Flask with the app.py file directly using Python from the virtual environment
./venv/bin/python app.py