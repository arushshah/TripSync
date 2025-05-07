from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
from utils.logger import setup_logger

# Set up logger for this module
logger = setup_logger('db')

# Load environment variables from .env file
load_dotenv()
logger.debug("Environment variables loaded for database configuration")

# Initialize database
db = SQLAlchemy()
logger.info("SQLAlchemy database object initialized")