from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from config import Config
from models import db
from routes.auth import auth_bp
from routes.oauth import oauth_bp
from routes.jira_oauth import jira_oauth_bp  # 新增导入
from routes.site_users import site_users_bp  # Site Users管理
from routes.speech import speech_bp
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
import os  # 确保导入 os 模块
import datetime



app = Flask(__name__)
# 在这里添加 SECRET_KEY 配置
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')
# Configure CORS to support credentials (sessions)
CORS(app, 
     resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
app.config.from_object(Config)
swagger = Swagger(app)

db.init_app(app)
jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(speech_bp, url_prefix="/api")
# app.register_blueprint(jira_bp)  # 已废弃的jira.py文件 
app.register_blueprint(oauth_bp) 
app.register_blueprint(jira_oauth_bp)
app.register_blueprint(site_users_bp)  # Site Users管理
print("DB URL:", app.config["SQLALCHEMY_DATABASE_URI"])

# Session configuration for OAuth flow
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(hours=2)
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Development environment
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Security best practice
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Allow cross-origin requests
app.config['SESSION_COOKIE_NAME'] = 'jira_oauth_session'

app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = datetime.timedelta(days=30)


if __name__ == "__main__":
    with app.app_context():
        # 创建所有数据库表，包括新增的 JiraUser 表
        db.create_all()
        print("数据库表创建完成，包括 JiraUser 表")
    # app.run(debug=True, port=5002)
    app.run(host="0.0.0.0", port=5002, debug=True)