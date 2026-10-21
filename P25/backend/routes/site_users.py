"""
Site Users Management API Module

This module provides endpoints for managing Jira site users, including
synchronization from Jira API, user listing with pagination and search,
and individual user details retrieval.

Features:
- OAuth-based authentication using existing JiraCredentials
- Automatic pagination handling for large user sets  
- Smart incremental synchronization
- Search and filtering capabilities
- Complete error handling and logging

Author: UNSW Capstone Team
"""

from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import requests
import os
from datetime import datetime
import logging
from models import db, JiraCredentials, SiteUser

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Blueprint for Site Users Management
site_users_bp = Blueprint('site_users', __name__, url_prefix='/api/site-users')

def token_required(f):
    """JWT Token validation decorator - Enhanced version supporting sub field"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Remove Bearer prefix
            if token.startswith('Bearer '):
                token = token[7:]
            elif token.startswith('bearer '):
                token = token[7:]
            
            # Check JWT_SECRET_KEY
            jwt_secret = os.getenv('JWT_SECRET_KEY')
            if not jwt_secret:
                logger.error("JWT_SECRET_KEY not configured")
                return jsonify({'message': 'Server configuration error'}), 500
            
            # Decode JWT
            data = jwt.decode(token, jwt_secret, algorithms=['HS256'])
            
            # Support multiple user_id field formats
            current_user_id = None
            
            # Try to get user_id from different fields
            if data.get('user_id') and str(data['user_id']) != 'null':
                current_user_id = data['user_id']
            elif data.get('sub'):
                # Standard JWT uses 'sub' (subject) as user identifier
                current_user_id = data['sub']
            elif data.get('id'):
                current_user_id = data['id']
            elif data.get('userId'):
                current_user_id = data['userId']
            
            if not current_user_id:
                logger.error(f"No valid user identifier found in JWT. Available fields: {list(data.keys())}")
                return jsonify({'message': 'Token missing valid user identifier'}), 401
            
            # Ensure user_id is integer
            try:
                current_user_id = int(current_user_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid user_id format: {current_user_id}")
                return jsonify({'message': 'Invalid user_id format in token'}), 401
            
            logger.info(f"Successfully authenticated user_id: {current_user_id}")
            
        except jwt.ExpiredSignatureError:
            logger.error("JWT token has expired")
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid JWT token: {str(e)}")
            return jsonify({'message': f'Token is invalid: {str(e)}'}), 401
        except Exception as e:
            logger.error(f"JWT validation error: {str(e)}")
            return jsonify({'message': f'Token validation failed: {str(e)}'}), 401
        
        return f(current_user_id, *args, **kwargs)
    return decorated

def get_jira_credentials(user_id):
    """Get user's Jira OAuth credentials"""
    credentials = JiraCredentials.query.filter_by(user_id=user_id).first()
    if not credentials:
        return None, {"error": "Jira not connected", "message": "Please connect to Jira via OAuth first"}, 400
    
    return credentials, None, None

def make_jira_oauth_request(credentials, endpoint, method='GET', data=None):
    """Make Jira API calls using OAuth Bearer Token"""
    headers = {
        'Authorization': f'Bearer {credentials.access_token}',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    
    # Use correct OAuth API endpoint format
    if credentials.site_id:
        # New OAuth API format
        base_url = f"https://api.atlassian.com/ex/jira/{credentials.site_id}"
    else:
        # Fallback format, direct site name usage
        base_url = f"https://{credentials.site_name}.atlassian.net"
    
    url = f"{base_url}/rest/api/3/{endpoint.lstrip('/')}"
    
    logger.info(f"Making {method} request to: {url}")
    
    try:
        response = requests.request(method, url, headers=headers, json=data, timeout=30)
        
        if response.status_code == 401:
            return None, {"error": "OAuth token expired", "message": "Please reconnect to Jira"}, 401
        
        response.raise_for_status()
        return response.json(), None, response.status_code
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Jira API request failed: {e}")
        return None, {"error": "Jira API call failed", "message": str(e)}, 500

# =================== Site User Management API Endpoints ===================

@site_users_bp.route('/sync', methods=['POST'])
@token_required
def sync_site_users(current_user_id):
    """
    同步Jira站点所有用户到本地数据库
    ---
    tags:
      - Site Users
    security:
      - jwt: []
    parameters:
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            max_results:
              type: integer
              example: 100
              description: 每页获取的最大用户数量 (默认 100, 最大 1000)
            force_refresh:
              type: boolean
              example: false
              description: 是否强制刷新所有用户 (默认 false, 只同步新增/变更用户)
    responses:
      200:
        description: 用户同步成功
        schema:
          type: object
          properties:
            message:
              type: string
              example: "Successfully synced 150 users from Jira site"
            statistics:
              type: object
              properties:
                total_fetched:
                  type: integer
                  example: 150
                  description: 从Jira获取的用户总数
                created:
                  type: integer
                  example: 10
                  description: 新创建的用户数量
                updated:
                  type: integer
                  example: 5
                  description: 更新的用户数量
                skipped:
                  type: integer
                  example: 135
                  description: 跳过的用户数量 (未变更)
                errors:
                  type: integer
                  example: 0
                  description: 错误数量
            site_info:
              type: object
              properties:
                site_id:
                  type: string
                  example: "12345678-1234-1234-1234-123456789012"
                site_name:
                  type: string
                  example: "unsw-cs3900-cs9900-25t2"
            sync_time:
              type: string
              format: date-time
              example: "2025-07-28T10:30:00Z"
              description: 同步完成时间
            errors:
              type: array
              items:
                type: string
              example: []
              description: 错误详情列表
      400:
        description: 无效请求或Jira未连接
        schema:
          type: object
          properties:
            error:
              type: string
              example: "Jira not connected"
            message:
              type: string
              example: "Please connect to Jira via OAuth first"
      401:
        description: OAuth token 已过期
        schema:
          type: object
          properties:
            error:
              type: string
              example: "OAuth token expired"
            message:
              type: string
              example: "Please reconnect to Jira"
      500:
        description: 同步失败
        schema:
          type: object
          properties:
            error:
              type: string
              example: "Sync failed: Database connection error"
    """
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code

    data = request.json or {}
    max_results_per_page = min(data.get('max_results', 100), 1000)  # 限制最大值
    force_refresh = data.get('force_refresh', False)

    try:
        site_id = credentials.site_id
        site_name = credentials.site_name
        sync_start_time = datetime.utcnow()
        
        logger.info(f"Starting user sync for site {site_name} (ID: {site_id})")
        
        # 统计信息
        stats = {
            'total_fetched': 0,
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0
        }
        errors = []
        
        # 分页获取所有用户
        start_at = 0
        max_total_users = 5000  # Jira API 限制
        
        while start_at < max_total_users:
            # 构建查询参数 - 使用空查询获取所有用户
            query_params = f"query=&startAt={start_at}&maxResults={max_results_per_page}"
            
            # 调用Jira用户搜索API
            users_data, error, status = make_jira_oauth_request(
                credentials, 
                f"user/search?{query_params}"
            )
            
            if error:
                error_msg = f"Failed to fetch users at startAt={start_at}: {error}"
                logger.error(error_msg)
                errors.append(error_msg)
                break
            
            users = users_data if isinstance(users_data, list) else []
            
            if not users:
                logger.info(f"No more users found at startAt={start_at}")
                break
                
            logger.info(f"Processing {len(users)} users from startAt={start_at}")
            stats['total_fetched'] += len(users)
            
            # 处理每个用户
            for user_data in users:
                try:
                    account_id = user_data.get('accountId')
                    if not account_id:
                        logger.warning(f"User missing accountId: {user_data}")
                        continue
                    
                    # 检查用户是否已存在
                    existing_user = SiteUser.query.filter_by(
                        site_id=site_id,
                        account_id=account_id
                    ).first()
                    
                    # 提取用户信息
                    display_name = user_data.get('displayName', '')
                    email_address = user_data.get('emailAddress', '')
                    active = user_data.get('active', True)
                    timezone = user_data.get('timeZone', '')
                    locale = user_data.get('locale', '')
                    account_type = user_data.get('accountType', 'atlassian')
                    
                    if existing_user:
                        # 检查是否需要更新
                        needs_update = (
                            force_refresh or
                            existing_user.display_name != display_name or
                            existing_user.email_address != email_address or
                            existing_user.active != active or
                            existing_user.timezone != timezone or
                            existing_user.locale != locale or
                            existing_user.account_type != account_type
                        )
                        
                        if needs_update:
                            existing_user.display_name = display_name
                            existing_user.email_address = email_address
                            existing_user.active = active
                            existing_user.timezone = timezone
                            existing_user.locale = locale
                            existing_user.account_type = account_type
                            existing_user.last_synced = sync_start_time
                            existing_user.updated_at = sync_start_time
                            stats['updated'] += 1
                            logger.debug(f"Updated user: {account_id}")
                        else:
                            stats['skipped'] += 1
                    else:
                        # 创建新用户
                        new_user = SiteUser(
                            site_id=site_id,
                            account_id=account_id,
                            display_name=display_name,
                            email_address=email_address,
                            active=active,
                            timezone=timezone,
                            locale=locale,
                            account_type=account_type,
                            last_synced=sync_start_time
                        )
                        db.session.add(new_user)
                        stats['created'] += 1
                        logger.debug(f"Created new user: {account_id}")
                        
                except Exception as user_error:
                    error_msg = f"Error processing user {user_data.get('accountId', 'unknown')}: {str(user_error)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    stats['errors'] += 1
            
            # 检查是否还有更多用户
            if len(users) < max_results_per_page:
                logger.info(f"Reached end of user list. Total fetched: {stats['total_fetched']}")
                break
                
            # 移动到下一页
            start_at += max_results_per_page
            
            # 防止无限循环，达到限制时停止
            if start_at >= max_total_users:
                logger.warning(f"Reached Jira API limit of {max_total_users} users")
                break
        
        # 提交数据库事务
        db.session.commit()
        
        sync_end_time = datetime.utcnow()
        sync_duration = (sync_end_time - sync_start_time).total_seconds()
        
        logger.info(f"User sync completed in {sync_duration:.2f}s. Stats: {stats}")
        
        return jsonify({
            "message": f"Successfully synced {stats['total_fetched']} users from Jira site",
            "statistics": stats,
            "site_info": {
                "site_id": site_id,
                "site_name": site_name
            },
            "sync_time": sync_end_time.isoformat(),
            "sync_duration_seconds": round(sync_duration, 2),
            "errors": errors
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"User sync failed: {e}")
        return jsonify({
            "error": f"Sync failed: {str(e)}"
        }), 500

@site_users_bp.route('/', methods=['GET'])
@token_required
def get_site_users(current_user_id):
    """
    获取站点用户列表 (从本地数据库)
    ---
    tags:
      - Site Users
    security:
      - jwt: []
    parameters:
      - name: page
        in: query
        type: integer
        required: false
        description: 页码 (从1开始, 默认1)
        example: 1
      - name: per_page
        in: query
        type: integer
        required: false
        description: 每页用户数量 (默认50, 最大200)
        example: 50
      - name: search
        in: query
        type: string
        required: false
        description: 按显示名称或邮箱搜索
        example: "john"
      - name: active_only
        in: query
        type: boolean
        required: false
        description: 只显示激活用户 (默认 true)
        example: true
    responses:
      200:
        description: 用户列表获取成功
      400:
        description: 无效请求参数或Jira未连接
    """
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code

    # 获取查询参数
    page = max(1, request.args.get('page', 1, type=int))
    per_page = min(200, max(1, request.args.get('per_page', 50, type=int)))
    search = request.args.get('search', '').strip()
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    
    site_id = credentials.site_id
    site_name = credentials.site_name
    
    try:
        # 构建查询
        query = SiteUser.query.filter_by(site_id=site_id)
        
        # 应用过滤条件
        if active_only:
            query = query.filter(SiteUser.active == True)
            
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                db.or_(
                    SiteUser.display_name.ilike(search_pattern),
                    SiteUser.email_address.ilike(search_pattern)
                )
            )
        
        # 按显示名称排序
        query = query.order_by(SiteUser.display_name)
        
        # 分页
        offset = (page - 1) * per_page
        total = query.count()
        users = query.offset(offset).limit(per_page).all()
        
        # 计算分页信息
        total_pages = (total + per_page - 1) // per_page
        has_next = page < total_pages
        has_prev = page > 1
        
        return jsonify({
            "users": [user.to_dict() for user in users],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev
            },
            "site_info": {
                "site_id": site_id,
                "site_name": site_name
            },
            "filters": {
                "search": search if search else None,
                "active_only": active_only
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching site users: {e}")
        return jsonify({
            "error": f"Failed to fetch users: {str(e)}"
        }), 500

@site_users_bp.route('/<account_id>', methods=['GET'])
@token_required
def get_site_user_details(current_user_id, account_id):
    """
    获取特定用户详细信息
    ---
    tags:
      - Site Users
    security:
      - jwt: []
    parameters:
      - name: account_id
        in: path
        type: string
        required: true
        description: Jira用户账户ID
        example: "5b10a2844c20165700ede21g"
    responses:
      200:
        description: 用户详情获取成功
      400:
        description: Jira未连接
      404:
        description: 用户未找到
    """
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code

    site_id = credentials.site_id
    
    try:
        # 查找用户
        user = SiteUser.query.filter_by(
            site_id=site_id,
            account_id=account_id
        ).first()
        
        if not user:
            return jsonify({
                "error": "User not found",
                "message": f"No user found with account_id: {account_id}"
            }), 404
        
        return jsonify({
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching user details for {account_id}: {e}")
        return jsonify({
            "error": f"Failed to fetch user details: {str(e)}"
        }), 500