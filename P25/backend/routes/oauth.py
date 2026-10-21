"""
OAuth Integration Module for Jira

This module handles OAuth 2.0 authentication flow with Atlassian Jira.
It provides endpoints for starting authorization, handling callbacks,
and managing OAuth credentials.

Features:
- OAuth 2.0 authorization code flow
- Secure state parameter handling
- Token storage and management
- Connection status checking
- Credential revocation

Author: UNSW Capstone Team
"""

from flask import Blueprint, request, jsonify, redirect, session, url_for, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import requests
import os
import secrets
from urllib.parse import urlencode
from datetime import datetime, timedelta
import logging
from flask_cors import CORS
from models import db, JiraCredentials, OAuthState

# Setup logging
logger = logging.getLogger(__name__)

# Create OAuth Blueprint
oauth_bp = Blueprint('oauth', __name__, url_prefix='/api/oauth')
CORS(oauth_bp, 
     origins=["http://localhost:3000", "http://127.0.0.1:3000"],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

@oauth_bp.route('/jira/authorize', methods=['POST'])
@jwt_required()
def authorize_jira():
    """
    Start Jira OAuth 2.0 authorization flow
    ---
    tags:
      - OAuth
    security:
      - jwt: []
    responses:
      200:
        description: Authorization URL generated successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            authorization_url:
              type: string
              example: "https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=..."
      400:
        description: OAuth client configuration error
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "JIRA_OAUTH_CLIENT_ID environment variable is not set"
      500:
        description: Internal server error during OAuth flow initiation
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Database connection failed"
    """
    try:
        user_id = get_jwt_identity()
        
        # Get OAuth client configuration
        client_id = os.getenv('JIRA_OAUTH_CLIENT_ID')
        if not client_id:
            return jsonify({
                'success': False,
                'error': 'JIRA_OAUTH_CLIENT_ID environment variable is not set'
            }), 400
        
        # Generate random state parameter to prevent CSRF attacks
        state = secrets.token_urlsafe(32)
        
        # Clean up expired OAuth states
        expired_states = OAuthState.query.filter(
            OAuthState.expires_at < datetime.utcnow()
        ).all()
        for expired_state in expired_states:
            db.session.delete(expired_state)
        
        # Save state to database instead of session
        oauth_state = OAuthState(
            state=state,
            user_id=user_id,
            expires_at=datetime.utcnow() + timedelta(minutes=int(os.getenv('OAUTH_STATE_EXPIRY_MINUTES', '10')))
        )
        db.session.add(oauth_state)
        db.session.commit()
        
        
        # Build authorization URL
        redirect_uri = url_for('oauth.jira_callback', _external=True)
        
        
        # Atlassian OAuth 2.0 authorization endpoint
        auth_url = "https://auth.atlassian.com/authorize"
        
        # Build query parameters for OAuth authorization
        # Completely minimal parameters to avoid any site selection UI
        query_params = {
            'audience': 'api.atlassian.com',
            'client_id': client_id,
            'scope': 'read:jira-work write:jira-work read:jira-user offline_access',
            'redirect_uri': redirect_uri,
            'state': state,
            'response_type': 'code',
            'access_type': 'offline'  # Ensure we get refresh tokens
        }
        
        # Complete authorization URL
        full_auth_url = f"{auth_url}?{urlencode(query_params)}"
        
        
        # Return authorization URL using jsonify instead of direct redirect
        return jsonify({
            'success': True,
            'authorization_url': full_auth_url
        }), 200
        
    except Exception as e:
        logger.error(f"Error starting Jira OAuth flow: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@oauth_bp.route('/jira/callback', methods=['GET'])
def jira_callback():
    """
    Handle Jira OAuth 2.0 callback and complete authorization
    ---
    tags:
      - OAuth
    parameters:
      - name: code
        in: query
        type: string
        required: true
        description: Authorization code from Atlassian
        example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
      - name: state
        in: query
        type: string
        required: true
        description: CSRF protection state parameter
        example: "abc123def456"
      - name: error
        in: query
        type: string
        required: false
        description: Error code if authorization failed
        example: "access_denied"
    responses:
      302:
        description: Redirect to success page after successful authorization
        headers:
          Location:
            type: string
            example: "/jira-connected"
      400:
        description: Authorization failed or invalid parameters
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Missing state parameter"
      500:
        description: Token exchange or database error
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Failed to exchange token"
    """
    try:
        # Get parameters
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')
        
        
        # Check for errors
        if error:
            logger.error(f"OAuth error: {error}")
            return jsonify({
                'success': False,
                'error': error
            }), 400
        
        # Validate state parameter from database to prevent CSRF attacks
        if not state:
            logger.error("Missing state parameter")
            return jsonify({
                'success': False,
                'error': 'Missing state parameter'
            }), 400
            
        oauth_state = OAuthState.query.filter_by(state=state).first()
        if not oauth_state:
            logger.error(f"OAuth state not found in database: {state}")
            return jsonify({
                'success': False,
                'error': 'Invalid state parameter'
            }), 400
            
        # Check if state has expired
        if oauth_state.is_expired():
            logger.error(f"OAuth state expired: {state}")
            db.session.delete(oauth_state)
            db.session.commit()
            return jsonify({
                'success': False,
                'error': 'State parameter expired'
            }), 400
        
        # Get user ID
        user_id = oauth_state.user_id
        if not user_id:
            logger.error("No user_id in OAuth state")
            return jsonify({
                'success': False,
                'error': 'User ID not found in session'
            }), 400
        
        # Get OAuth client configuration
        client_id = os.getenv('JIRA_OAUTH_CLIENT_ID')
        client_secret = os.getenv('JIRA_OAUTH_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            return jsonify({
                'success': False,
                'error': 'OAuth client configuration is incomplete'
            }), 500
        
        # Build token exchange request
        redirect_uri = url_for('oauth.jira_callback', _external=True)
        token_url = 'https://auth.atlassian.com/oauth/token'
        
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri
        }
        
        # Send token request
        response = requests.post(token_url, json=token_data)
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.text}")
            return jsonify({
                'success': False,
                'error': f"Failed to exchange token: {response.text}"
            }), 500
        
        # Parse token response
        token_info = response.json()
        
        access_token = token_info.get('access_token')
        refresh_token = token_info.get('refresh_token')
        expires_in = token_info.get('expires_in', 3600)
        
        if not access_token:
            logger.error("No access_token in response")
            return jsonify({
                'success': False,
                'error': 'No access token received'
            }), 500
        
        # Calculate expiration time
        expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # Get associated Jira site information
        headers = {'Authorization': f'Bearer {access_token}'}
        accessible_resources_url = 'https://api.atlassian.com/oauth/token/accessible-resources'
        
        resources_response = requests.get(accessible_resources_url, headers=headers)
        
        if resources_response.status_code != 200:
            logger.error(f"Failed to fetch accessible resources: {resources_response.text}")
            return jsonify({
                'success': False,
                'error': 'Failed to retrieve Jira site information'
            }), 500
        
        resources = resources_response.json()
        logger.info(f"Accessible resources response: {resources}")
        
        if not resources:
            return jsonify({
                'success': False,
                'error': 'No accessible Jira sites found'
            }), 400
        
        # Handle site selection for OAuth completion
        if len(resources) == 1:
            # Single site: use directly
            selected_site = resources[0]
            site_id = selected_site.get('id')
            site_name = selected_site.get('name', 'Unknown Jira Site')
        else:
            # Multiple sites: redirect to site selection page
            temp_oauth_data = {
                'user_id': user_id,
                'access_token': access_token,
                'refresh_token': refresh_token,
                'expires_at': expires_at,
                'available_sites': resources,
                'state': state
            }
            
            # Store in session temporarily
            session['temp_oauth_data'] = temp_oauth_data
            session['temp_oauth_expires'] = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
            
            # Clean up OAuth state since we'll handle completion later
            db.session.delete(oauth_state)
            db.session.commit()
            
            # Redirect to site selection page
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
            redirect_url = f"{frontend_url}/site-selection"
            return redirect(redirect_url)
        
        # Continue with single site flow
        site_id = selected_site.get('id')
        site_name = selected_site.get('name', 'Unknown Jira Site')
        
        
        # Store credentials to database
        
        # First check if existing credentials exist
        existing_cred = JiraCredentials.query.filter_by(user_id=user_id).first()
        
        if existing_cred:
            # Update existing credentials
            existing_cred.access_token = access_token
            existing_cred.refresh_token = refresh_token
            existing_cred.token_expires_at = expires_at
            existing_cred.site_id = site_id
            existing_cred.site_name = site_name
            existing_cred.updated_at = datetime.utcnow()
        else:
            # Create new credentials
            new_cred = JiraCredentials(
                user_id=user_id,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=expires_at,
                site_id=site_id,
                site_name=site_name,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.session.add(new_cred)
        
        # Save changes
        db.session.commit()
        
        # 🆕 自动检查并同步 setup_completed 字段
        try:
            from models import UserProjectPreference
            
            preferences_count = UserProjectPreference.query.filter_by(user_id=user_id).count()

            # 兼容新建和更新
            cred = existing_cred if existing_cred else new_cred
            if cred:
                cred.setup_completed = (preferences_count > 0)
                db.session.commit()
                
        except Exception as sync_error:
            logger.error(f"Error syncing setup_completed field: {sync_error}")
            # 不阻塞主流程，只记录错误
        
        # 清除数据库中的 OAuth 状态
        db.session.delete(oauth_state)
        db.session.commit()
        
        
        # 重定向到成功页面或前端指定的页面
        redirect_url = os.getenv('JIRA_OAUTH_SUCCESS_REDIRECT', '/jira-connected')
        return redirect(redirect_url)
        
    except Exception as e:
        logger.error(f"Error in OAuth callback: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@oauth_bp.route('/jira/status', methods=['GET'])
@jwt_required()
def get_jira_connection_status():
    """
    Get current Jira connection status for authenticated user
    ---
    tags:
      - OAuth
    security:
      - jwt: []
    responses:
      200:
        description: Connection status retrieved successfully
        schema:
          type: object
          properties:
            connected:
              type: boolean
              example: true
            site_name:
              type: string
              example: "My Company Jira"
            expires_at:
              type: string
              format: date-time
              example: "2025-07-19T10:30:00"
            connected_at:
              type: string
              format: date-time
              example: "2025-07-18T08:15:00"
            token_valid:
              type: boolean
              example: true
      500:
        description: Error checking connection status
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Database connection failed"
    """
    try:
        user_id = get_jwt_identity()
        
        # 检查数据库中是否有凭证
        from models import JiraCredentials
        cred = JiraCredentials.query.filter_by(user_id=user_id).first()
        
        if cred:
            return jsonify({
                'connected': True,
                'site_name': cred.site_name,
                'expires_at': cred.token_expires_at.isoformat() if cred.token_expires_at else None,
                'connected_at': cred.created_at.isoformat() if cred.created_at else None,
                'token_valid': datetime.utcnow() < cred.token_expires_at if cred.token_expires_at else False
            }), 200
        else:
            return jsonify({
                'connected': False
            }), 200
            
    except Exception as e:
        logger.error(f"Error checking Jira connection status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@oauth_bp.route('/jira/disconnect', methods=['POST'])
@jwt_required()
def disconnect_jira():
    """
    Disconnect Jira integration and revoke OAuth tokens
    ---
    tags:
      - OAuth
    security:
      - jwt: []
    responses:
      200:
        description: Successfully disconnected from Jira
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "Successfully disconnected from Jira"
      404:
        description: No Jira connection found for user
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "No Jira connection found"
      500:
        description: Error during disconnection process
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Database rollback failed"
    """
    try:
        user_id = get_jwt_identity()
        
        # 查找用户的 Jira 凭证
        # JiraCredentials and db already imported at top
        cred = JiraCredentials.query.filter_by(user_id=user_id).first()
        
        if not cred:
            return jsonify({
                'success': False,
                'error': 'No Jira connection found'
            }), 404
        
        # 尝试撤销 OAuth 令牌（可选）
        client_id = os.getenv('JIRA_OAUTH_CLIENT_ID')
        client_secret = os.getenv('JIRA_OAUTH_CLIENT_SECRET')
        
        if client_id and client_secret and cred.refresh_token:
            try:
                revoke_url = 'https://auth.atlassian.com/oauth/token/revoke'
                revoke_data = {
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'token': cred.refresh_token,
                    'token_type_hint': 'refresh_token'
                }
                
                revoke_response = requests.post(revoke_url, json=revoke_data)
            except Exception as revoke_error:
                # Continue to delete credentials even if revocation fails
                pass
        
        # 从数据库中删除凭证
        db.session.delete(cred)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Successfully disconnected from Jira'
        }), 200
        
    except Exception as e:
        logger.error(f"Error disconnecting from Jira: {e}")
        # db already imported at top
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# 刷新令牌端点（可选，用于自动刷新过期的访问令牌）
@oauth_bp.route('/jira/refresh', methods=['POST'])
@jwt_required()
def refresh_token():
    """
    Refresh expired Jira OAuth access token
    ---
    tags:
      - OAuth
    security:
      - jwt: []
    responses:
      200:
        description: Token refreshed successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "Token refreshed successfully"
            expires_at:
              type: string
              format: date-time
              example: "2025-07-19T10:30:00"
      404:
        description: No refresh token found
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "No refresh token found"
      500:
        description: Token refresh failed or configuration error
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Failed to refresh token: invalid_grant"
    """
    try:
        user_id = get_jwt_identity()
        
        # 查找用户的 Jira 凭证
        # JiraCredentials and db already imported at top
        cred = JiraCredentials.query.filter_by(user_id=user_id).first()
        
        if not cred or not cred.refresh_token:
            return jsonify({
                'success': False,
                'error': 'No refresh token found'
            }), 404
        
        # 获取 OAuth 配置
        client_id = os.getenv('JIRA_OAUTH_CLIENT_ID')
        client_secret = os.getenv('JIRA_OAUTH_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            return jsonify({
                'success': False,
                'error': 'OAuth client configuration is incomplete'
            }), 500
        
        # 构建刷新令牌请求
        token_url = 'https://auth.atlassian.com/oauth/token'
        token_data = {
            'grant_type': 'refresh_token',
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': cred.refresh_token
        }
        
        # 发送刷新请求
        try:
            response = requests.post(token_url, json=token_data)
            response.raise_for_status()
            token_info = response.json()
        except requests.RequestException as e:
            return jsonify({
                'success': False,
                'error': f"Failed to refresh token: {str(e)}"
            }), 500
        
        # 更新令牌信息
        new_access_token = token_info.get('access_token')
        new_refresh_token = token_info.get('refresh_token', cred.refresh_token)  # 有些情况下不会返回新的刷新令牌
        expires_in = token_info.get('expires_in', 3600)
        
        if not new_access_token:
            return jsonify({
                'success': False,
                'error': 'No access token received'
            }), 500
        
        # 计算新的过期时间
        new_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # 更新数据库中的凭证
        cred.access_token = new_access_token
        cred.refresh_token = new_refresh_token
        cred.token_expires_at = new_expires_at
        cred.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        
        return jsonify({
            'success': True,
            'message': 'Token refreshed successfully',
            'expires_at': new_expires_at.isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        # db already imported at top
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# 调试和诊断端点
@oauth_bp.route('/debug/config', methods=['GET'])
def debug_config():
    """
    Get OAuth configuration status for debugging
    ---
    tags:
      - OAuth
    responses:
      200:
        description: Configuration status retrieved successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            config_status:
              type: object
              properties:
                client_id_configured:
                  type: boolean
                  example: true
                client_id_preview:
                  type: string
                  example: "AbC123XyZ9..."
                client_secret_configured:
                  type: boolean
                  example: true
                flask_secret_configured:
                  type: boolean
                  example: true
                callback_url:
                  type: string
                  example: "https://localhost:5000/api/oauth/jira/callback"
                session_config:
                  type: object
                  properties:
                    has_session_data:
                      type: boolean
                      example: false
                    session_keys:
                      type: array
                      items:
                        type: string
                      example: []
                environment_check:
                  type: object
                  properties:
                    JIRA_OAUTH_CLIENT_ID:
                      type: string
                      example: "SET"
                    JIRA_OAUTH_CLIENT_SECRET:
                      type: string
                      example: "SET"
                    FLASK_SECRET_KEY:
                      type: string
                      example: "SET"
            issues_found:
              type: array
              items:
                type: string
              example: []
            recommendations:
              type: array
              items:
                type: string
              example: ["Ensure all environment variables are set in your .env file"]
      500:
        description: Error retrieving configuration status
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Environment variable access failed"
    """
    try:
        client_id = os.getenv('JIRA_OAUTH_CLIENT_ID')
        client_secret = os.getenv('JIRA_OAUTH_CLIENT_SECRET')
        secret_key = os.getenv('FLASK_SECRET_KEY')
        
        # 生成测试回调 URL
        test_callback_url = url_for('oauth.jira_callback', _external=True)
        
        config_status = {
            'client_id_configured': bool(client_id),
            'client_id_preview': client_id[:10] + '...' if client_id else None,
            'client_secret_configured': bool(client_secret),
            'flask_secret_configured': bool(secret_key),
            'callback_url': test_callback_url,
            'session_config': {
                'has_session_data': bool(session),
                'session_keys': list(session.keys()) if session else []
            },
            'environment_check': {
                'JIRA_OAUTH_CLIENT_ID': 'SET' if client_id else 'MISSING',
                'JIRA_OAUTH_CLIENT_SECRET': 'SET' if client_secret else 'MISSING',
                'FLASK_SECRET_KEY': 'SET' if secret_key else 'MISSING'
            }
        }
        
        # 检查常见问题
        issues = []
        if not client_id:
            issues.append('JIRA_OAUTH_CLIENT_ID environment variable is not set')
        if not client_secret:
            issues.append('JIRA_OAUTH_CLIENT_SECRET environment variable is not set')
        if not secret_key:
            issues.append('FLASK_SECRET_KEY is not set - this will cause session issues')
        
        return jsonify({
            'success': True,
            'config_status': config_status,
            'issues_found': issues,
            'recommendations': [
                'Ensure all environment variables are set in your .env file',
                'Verify the callback URL matches exactly in Atlassian Developer Console',
                'Check that your Atlassian app has the correct permissions',
                'Make sure your app is in "Active" status in Atlassian console'
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Debug config error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@oauth_bp.route('/jira/available-sites', methods=['GET'])
def get_available_sites_for_selection():
    """
    Get available sites from temporary OAuth data for user selection
    ---
    tags:
      - OAuth
    responses:
      200:
        description: Available sites retrieved successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            sites:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                    example: "1234-5678-9012"
                  name:
                    type: string
                    example: "My Company Jira"
                  url:
                    type: string
                    example: "https://mycompany.atlassian.net"
      404:
        description: No temporary OAuth data found
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "No site selection data available"
    """
    try:
        # Check if temporary OAuth data exists in session
        temp_data = session.get('temp_oauth_data')
        temp_expires = session.get('temp_oauth_expires')
        
        if not temp_data or not temp_expires:
            logger.warning("No temporary OAuth data found in session")
            return jsonify({
                'success': False,
                'error': 'No site selection data available'
            }), 404
        
        # Check if data has expired
        expires_at = datetime.fromisoformat(temp_expires)
        if datetime.utcnow() > expires_at:
            logger.warning("Temporary OAuth data has expired")
            session.pop('temp_oauth_data', None)
            session.pop('temp_oauth_expires', None)
            return jsonify({
                'success': False,
                'error': 'Site selection data has expired'
            }), 404
        
        # Format sites for frontend
        sites = []
        for site in temp_data.get('available_sites', []):
            sites.append({
                'id': site.get('id'),
                'name': site.get('name'),
                'url': site.get('url', f"https://{site.get('name', 'unknown')}.atlassian.net")
            })
        
        return jsonify({
            'success': True,
            'sites': sites
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting available sites: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@oauth_bp.route('/jira/complete-site-selection', methods=['POST'])
def complete_site_selection():
    """
    Complete OAuth flow by selecting a specific site
    ---
    tags:
      - OAuth
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - site_id
          properties:
            site_id:
              type: string
              example: "1234-5678-9012"
              description: Selected Jira site ID
    responses:
      200:
        description: Site selection completed successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "Site selection completed successfully"
            site_name:
              type: string
              example: "My Company Jira"
      400:
        description: Invalid request data
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "Invalid site selection"
      404:
        description: No temporary data found
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: false
            error:
              type: string
              example: "No site selection data available"
    """
    try:
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        site_id = data.get('site_id')
        if not site_id:
            return jsonify({
                'success': False,
                'error': 'Missing site_id'
            }), 400
        
        # Get temporary OAuth data from session
        temp_data = session.get('temp_oauth_data')
        temp_expires = session.get('temp_oauth_expires')
        
        if not temp_data or not temp_expires:
            logger.warning("No temporary OAuth data found in session")
            return jsonify({
                'success': False,
                'error': 'No site selection data available'
            }), 404
        
        # Check if data has expired
        expires_at = datetime.fromisoformat(temp_expires)
        if datetime.utcnow() > expires_at:
            logger.warning("Temporary OAuth data has expired")
            session.pop('temp_oauth_data', None)
            session.pop('temp_oauth_expires', None)
            return jsonify({
                'success': False,
                'error': 'Site selection data has expired'
            }), 404
        
        # Find selected site in available sites
        selected_site = None
        for site in temp_data.get('available_sites', []):
            if site.get('id') == site_id:
                selected_site = site
                break
        
        if not selected_site:
            logger.warning(f"Invalid site_id: {site_id} not found in available sites")
            return jsonify({
                'success': False,
                'error': 'Invalid site selection'
            }), 400
        
        site_name = selected_site.get('name', 'Unknown Jira Site')
        user_id = temp_data.get('user_id')
        
        # Create or update Jira credentials with selected site
        existing_cred = JiraCredentials.query.filter_by(user_id=user_id).first()
        
        if existing_cred:
            # Update existing credentials
            existing_cred.access_token = temp_data.get('access_token')
            existing_cred.refresh_token = temp_data.get('refresh_token')
            existing_cred.token_expires_at = temp_data.get('expires_at')
            existing_cred.site_id = site_id
            existing_cred.site_name = site_name
            existing_cred.updated_at = datetime.utcnow()
        else:
            # Create new credentials
            new_cred = JiraCredentials(
                user_id=user_id,
                access_token=temp_data.get('access_token'),
                refresh_token=temp_data.get('refresh_token'),
                token_expires_at=temp_data.get('expires_at'),
                site_id=site_id,
                site_name=site_name,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.session.add(new_cred)
        
        # Clean up temporary data from session
        session.pop('temp_oauth_data', None)
        session.pop('temp_oauth_expires', None)
        
        # Save to database
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Site selection completed successfully',
            'site_name': site_name
        }), 200
        
    except Exception as e:
        logger.error(f"Error completing site selection: {e}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500