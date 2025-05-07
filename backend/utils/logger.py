import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from flask import request, g, has_request_context

# Set up custom formatter for structured logs
class RequestFormatter(logging.Formatter):
    def format(self, record):
        if has_request_context():
            record.url = request.url
            record.method = request.method
            record.path = request.path
            record.remote_addr = request.remote_addr
            record.user_id = getattr(g, 'user_id', None)
        else:
            record.url = None
            record.method = None
            record.path = None
            record.remote_addr = None
            record.user_id = None

        record.timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        return super().format(record)

def setup_logger(name=None, log_level=None):
    """
    Set up a logger with the specified name and log level.
    
    Args:
        name (str, optional): Logger name. If None, returns the root logger.
        log_level (str, optional): Log level ('DEBUG', 'INFO', etc.). Defaults to environment setting or INFO.
    
    Returns:
        logging.Logger: Configured logger instance
    """
    # Get logger
    logger = logging.getLogger(name)
    
    # Only configure if it hasn't been configured
    if not logger.handlers:
        # Determine log level from args, environment or default to INFO
        if log_level is None:
            log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
        
        numeric_level = getattr(logging, log_level, logging.INFO)
        logger.setLevel(numeric_level)
        
        # Create console handler with formatter
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)
        
        # Create formatters
        if os.environ.get('FLASK_ENV') == 'development':
            # Simple format for development
            formatter = RequestFormatter(
                '[%(timestamp)s] [%(levelname)s] [%(name)s] - %(message)s'
            )
        else:
            # More detailed format for production with request context
            formatter = RequestFormatter(
                '[%(timestamp)s] [%(levelname)s] [%(name)s] '
                '[%(remote_addr)s] [%(user_id)s] [%(url)s] [%(method)s] - %(message)s'
            )
            
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # Add file handler in production
        if os.environ.get('FLASK_ENV') != 'development':
            logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
            os.makedirs(logs_dir, exist_ok=True)
            
            file_handler = RotatingFileHandler(
                os.path.join(logs_dir, 'tripsync.log'),
                maxBytes=10485760,  # 10MB
                backupCount=10
            )
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
    
    return logger

# Create a default app logger
logger = setup_logger('tripsync')