"""
Jira OAuth Integration  API Module

A dedicated module for complete OAuth-based Jira integration functionality.
Supports multi-user, multi-site, project selection and relationship storage.

Features:
- Fully OAuth-driven API calls
- User project preference management
- Complete CRUD operations for JiraTask table
- Issue relationship synchronization and querying
- Multi-user multi-site support

Author: UNSW Capstone Team (OAuth Migration Version)
"""

from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import requests
import os
from datetime import datetime, date
import logging
from models import db, User, JiraCredentials, UserProjectPreference, JiraTask, JiraUser
from sqlalchemy import text
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Blueprint for OAuth Jira (renamed from test)
jira_oauth_bp = Blueprint('jira_oauth', __name__, url_prefix='/api/jira-oauth')

# Status mapping: Chinese to English
STATUS_MAP = {
    "已完成": "Done",
    "完成": "Done", 
    "结束": "Done",
    "进行中": "In Progress",
    "正在进行": "In Progress",
    "开发中": "In Progress",
    "待办": "To Do",
    "未开始": "To Do",
    "新建": "To Do",
    "打开": "Open",
    "开放": "Open",
    "关闭": "Closed",
    "已关闭": "Closed",
    "重新打开": "Reopened",
    "重新开放": "Reopened",
    "测试中": "In Testing",
    "测试": "Testing",
    "待测试": "Ready for Testing",
    "审核中": "In Review",
    "代码审核": "Code Review",
    "待发布": "Ready for Release",
    "已发布": "Released",
    "部署": "Deployed",
    "已部署": "Deployed",
    "阻塞": "Blocked",
    "暂停": "On Hold",
    "取消": "Cancelled",
    "已取消": "Cancelled"
}

# Priority mapping: Chinese to English  
PRIORITY_MAP = {
    "最高": "Highest",
    "高": "High", 
    "中": "Medium",
    "低": "Low",
    "最低": "Lowest",
    "紧急": "Highest",
    "重要": "High",
    "普通": "Medium",
    "次要": "Low"
}

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

def refresh_access_token(credentials):
    """刷新OAuth access token"""
    if not credentials.refresh_token:
        return None, "No refresh token available"
    
    client_id = os.getenv('JIRA_OAUTH_CLIENT_ID')
    client_secret = os.getenv('JIRA_OAUTH_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        return None, "OAuth configuration missing"
    
    try:
        response = requests.post(
            'https://auth.atlassian.com/oauth/token',
            data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'client_secret': client_secret,
                'refresh_token': credentials.refresh_token
            },
            timeout=30
        )
        
        if response.status_code == 200:
            token_info = response.json()
            new_access_token = token_info.get('access_token')
            new_refresh_token = token_info.get('refresh_token', credentials.refresh_token)
            
            # 更新数据库中的token
            credentials.access_token = new_access_token
            credentials.refresh_token = new_refresh_token
            credentials.updated_at = datetime.now()
            db.session.commit()
            
            logger.info(f"Successfully refreshed access token for user {credentials.user_id}")
            return new_access_token, None
        else:
            logger.error(f"Failed to refresh token: {response.status_code} - {response.text}")
            return None, f"Token refresh failed: {response.status_code}"
            
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        return None, f"Token refresh error: {str(e)}"

def make_jira_oauth_request(credentials, endpoint, method='GET', data=None):
    """Make Jira API calls using OAuth Bearer Token with auto-refresh"""
    
    def _make_request(access_token):
        headers = {
            'Authorization': f'Bearer {access_token}',
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
        
        # 智能处理API版本
        if endpoint.startswith('/rest/api/'):
            # 如果endpoint已包含完整路径，直接使用
            url = f"{base_url}{endpoint}"
        else:
            # 否则使用默认的API v3
            url = f"{base_url}/rest/api/3/{endpoint.lstrip('/')}"
        
        logger.info(f"Making {method} request to: {url}")
        
        try:
            response = requests.request(method, url, headers=headers, json=data, timeout=30)
            return response
        except requests.exceptions.RequestException as e:
            logger.error(f"Jira API request failed: {e}")
            raise e
    
    try:
        # 首次尝试使用当前token
        response = _make_request(credentials.access_token)
        
        # 如果返回401，尝试刷新token后重试
        if response.status_code == 401:
            logger.info("Access token expired, attempting to refresh...")
            new_token, error = refresh_access_token(credentials)
            
            if new_token:
                # 使用新token重试请求
                response = _make_request(new_token)
            else:
                logger.error(f"Token refresh failed: {error}")
                return None, {"error": "Please reconnect to Jira", "message": f"Token refresh failed: {error}"}, 401
        
        response.raise_for_status()
        return response.json(), None, response.status_code
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Jira API request failed: {e}")
        return None, {"error": "Jira API call failed", "message": str(e)}, 500


# =================== Project Management ===================

@jira_oauth_bp.route('/available-projects', methods=['GET'])
@token_required
def get_available_projects(current_user_id):
    """
    Get available Jira projects for user selection
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    responses:
      200:
        description: List of available projects with selection status
        schema:
          type: object
          properties:
            projects:
              type: array
              items:
                type: object
                properties:
                  key:
                    type: string
                    example: "PROJ"
                    description: Project key
                  name:
                    type: string
                    example: "Project Name"
                    description: Project display name
                  description:
                    type: string
                    example: "Project description"
                    description: Project description
                  total_issues:
                    type: integer
                    example: 25
                    description: Total number of issues in project
                  selected:
                    type: boolean
                    example: true
                    description: Whether project is selected by user
                  lead:
                    type: string
                    example: "John Doe"
                    description: Project lead name
                  project_type:
                    type: string
                    example: "software"
                    description: Type of project
            total:
              type: integer
              example: 10
              description: Total number of available projects
            selected_count:
              type: integer
              example: 3
              description: Number of projects selected by user
      400:
        description: Jira connection error
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
        description: OAuth token expired
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
        description: Jira API call failed
        schema:
          type: object
          properties:
            error:
              type: string
              example: "Jira API call failed"
            message:
              type: string
              example: "Connection timeout"
    """
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code
    
    # Get all projects from Jira
    data, error, status_code = make_jira_oauth_request(credentials, 'project/search')
    if error:
        return jsonify(error), status_code
    
    # Get user's selected projects
    selected_projects = UserProjectPreference.query.filter_by(user_id=current_user_id).all()
    selected_keys = {pref.project_key for pref in selected_projects}
    
    projects = []
    for project in data.get('values', []):
        # Get basic project statistics
        jql = f"project = {project['key']}"
        issues_data, _, _ = make_jira_oauth_request(credentials, f"search?jql={jql}&maxResults=0")
        
        projects.append({
            'key': project['key'],
            'name': project['name'],
            'description': project.get('description', ''),
            'total_issues': issues_data.get('total', 0) if issues_data else 0,
            'selected': project['key'] in selected_keys,
            'lead': project.get('lead', {}).get('displayName', 'Unknown') if project.get('lead') else 'Unknown',
            'project_type': project.get('projectTypeKey', 'unknown')
        })
    
    return jsonify({
        'projects': projects,
        'total': len(projects),
        'selected_count': len(selected_keys)
    })

@jira_oauth_bp.route('/project-preferences', methods=['POST'])
@token_required
def save_project_preferences(current_user_id):
    """
    Save user's project preferences
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - selected_projects
          properties:
            selected_projects:
              type: array
              items:
                type: object
                properties:
                  key:
                    type: string
                    example: "PROJ"
                    description: Project key
                  name:
                    type: string
                    example: "Project Name"
                    description: Project display name
              example:
                - key: "PROJ1"
                  name: "First Project"
                - key: "PROJ2"
                  name: "Second Project"
              description: List of selected projects
            primary_project:
              type: string
              example: "PROJ1"
              description: Key of the primary project (optional)
    responses:
      200:
        description: Project preferences saved successfully
        schema:
          type: object
          properties:
            message:
              type: string
              example: "Project preferences saved successfully"
            selected_count:
              type: integer
              example: 2
              description: Number of projects selected
      400:
        description: Invalid request data
        schema:
          type: object
          properties:
            error:
              type: string
              example: "Please select at least one project"
      500:
        description: Server error saving preferences
        schema:
          type: object
          properties:
            error:
              type: string
              example: "Database error: connection failed"
    """
    data = request.json
    selected_projects = data.get('selected_projects', [])
    primary_project = data.get('primary_project')
    
    if not selected_projects:
        return jsonify({"error": "Please select at least one project"}), 400
    
    
    try:
        # Get current site credentials
        credentials = JiraCredentials.query.filter_by(user_id=current_user_id).first()
        if not credentials:
            return jsonify({"error": "No Jira credentials found"}), 404
            
        current_site_id = credentials.site_id
        
        # Clear existing preferences for CURRENT SITE ONLY
        UserProjectPreference.query.filter_by(
            user_id=current_user_id,
            site_id=current_site_id
        ).delete()
        
        # Add new preferences for current site
        for project in selected_projects:
            preference = UserProjectPreference(
                user_id=current_user_id,
                project_key=project['key'],
                project_name=project['name'],
                site_id=current_site_id,  # Use the current site ID
                is_primary=(project['key'] == primary_project)
            )
            db.session.add(preference)
        
        # Mark setup as completed
        credentials = JiraCredentials.query.filter_by(user_id=current_user_id).first()
        if credentials:
            credentials.setup_completed = True
        
        db.session.commit()
        
        return jsonify({
            "message": "Project preferences saved successfully",
            "selected_count": len(selected_projects)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@jira_oauth_bp.route('/project-preferences/<project_key>', methods=['DELETE'])
@token_required
def delete_project_preference(current_user_id, project_key):
    """
    Delete a specific project preference
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    parameters:
      - name: project_key
        in: path
        type: string
        required: true
        description: Project key to delete from preferences
        example: "PROJ"
    responses:
      200:
        description: Project preference deleted successfully
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            message:
              type: string
              example: "Preference for PROJ deleted"
      404:
        description: Project preference not found
        schema:
          type: object
          properties:
            error:
              type: string
              example: "Project preference not found"
    """
    from models import UserProjectPreference, JiraCredentials, db

    pref = UserProjectPreference.query.filter_by(user_id=current_user_id, project_key=project_key).first()
    if not pref:
        return jsonify({"error": "Project preference not found"}), 404

    db.session.delete(pref)
    db.session.commit()

    # Check if there are remaining project preferences, if not, sync setup_completed field
    remaining = UserProjectPreference.query.filter_by(user_id=current_user_id).count()
    cred = JiraCredentials.query.filter_by(user_id=current_user_id).first()
    if cred:
        cred.setup_completed = remaining > 0
        db.session.commit()

    return jsonify({"success": True, "message": f"Preference for {project_key} deleted"})

@jira_oauth_bp.route('/my-projects', methods=['GET'])
@token_required
def get_my_projects(current_user_id):
    """
    Get user's selected Jira projects
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    responses:
      200:
        description: List of user's selected projects
        schema:
          type: object
          properties:
            projects:
              type: array
              items:
                type: object
                properties:
                  key:
                    type: string
                    example: "PROJ"
                    description: Project key
                  name:
                    type: string
                    example: "Project Name"
                    description: Project display name
                  site_id:
                    type: string
                    example: "12345678-1234-1234-1234-123456789012"
                    description: Jira site ID
                  is_primary:
                    type: boolean
                    example: true
                    description: Whether this is the primary project
                  created_at:
                    type: string
                    format: date-time
                    example: "2025-07-17T10:30:00Z"
                    description: When project preference was created
            total:
              type: integer
              example: 3
              description: Total number of selected projects
            message:
              type: string
              example: "No projects selected. Please set up your project preferences."
              description: Message when no projects are selected
    """
    # Get user's current site credentials
    credentials = JiraCredentials.query.filter_by(user_id=current_user_id).first()
    if not credentials:
        return jsonify({"error": "No Jira credentials found"}), 404
    
    # Query projects only for the current connected site
    preferences = UserProjectPreference.query.filter_by(
        user_id=current_user_id,
        site_id=credentials.site_id
    ).all()
    
    if not preferences:
        return jsonify({
            "projects": [],
            "current_site": credentials.site_name,
            "message": f"No projects selected for {credentials.site_name}. Please set up your project preferences."
        })
    
    projects = []
    for pref in preferences:
        projects.append({
            'key': pref.project_key,
            'name': pref.project_name,
            'site_id': pref.site_id,
            'site_name': credentials.site_name,
            'is_primary': pref.is_primary,
            'created_at': pref.created_at.isoformat()
        })
    
    return jsonify({
        "projects": projects,
        "total": len(projects),
        "current_site": credentials.site_name
    })

# =================== JiraTask Operations ===================

@jira_oauth_bp.route('/jira-tasks', methods=['GET'])
@token_required
def get_jira_tasks(current_user_id):
    """
    Get user's Jira tasks with optional filtering
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    parameters:
      - name: project_key
        in: query
        type: string
        required: false
        description: Filter tasks by project key
        example: "PROJ"
      - name: status
        in: query
        type: string
        required: false
        description: Filter tasks by status
        example: "In Progress"
    responses:
      200:
        description: List of user's Jira tasks
        schema:
          type: object
          properties:
            tasks:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    example: 1
                    description: Internal task ID
                  title:
                    type: string
                    example: "Fix login bug"
                    description: Task title/summary
                  description:
                    type: string
                    example: "Fix the authentication issue in login form"
                    description: Task description
                  assignee:
                    type: string
                    example: "john.doe@example.com"
                    description: Task assignee
                  status:
                    type: string
                    example: "In Progress"
                    description: Current task status
                  jira_issue_key:
                    type: string
                    example: "PROJ-123"
                    description: Jira issue key
                  jira_project_key:
                    type: string
                    example: "PROJ"
                    description: Jira project key
                  jira_priority:
                    type: string
                    example: "High"
                    description: Jira priority level
                  internal_priority:
                    type: integer
                    example: 8
                    description: Internal priority score
                  due_date:
                    type: string
                    format: date
                    example: "2025-08-01"
                    description: Task due date
                  created_at:
                    type: string
                    format: date-time
                    example: "2025-07-17T10:30:00Z"
                    description: Task creation timestamp
                  updated_at:
                    type: string
                    format: date-time
                    example: "2025-07-17T14:20:00Z"
                    description: Task last update timestamp
            total:
              type: integer
              example: 15
              description: Total number of tasks returned
    """
    project_key = request.args.get('project_key')
    status = request.args.get('status')
    
    # Get user's current site credentials
    credentials = JiraCredentials.query.filter_by(user_id=current_user_id).first()
    if not credentials:
        return jsonify({"error": "No Jira credentials found"}), 404
    
    # Get current site's project keys for filtering
    current_site_project_keys = [
        p.project_key for p in UserProjectPreference.query.filter_by(
            user_id=current_user_id, 
            site_id=credentials.site_id
        ).all()
    ]
    
    # Base query with site filtering
    query = JiraTask.query.filter_by(user_id=current_user_id)
    
    if current_site_project_keys:
        # Filter tasks to current site's projects only
        query = query.filter(JiraTask.jira_project_key.in_(current_site_project_keys))
    else:
        # No projects configured for current site
        return jsonify({
            "tasks": [],
            "total": 0,
            "current_site": credentials.site_name,
            "message": f"No projects configured for {credentials.site_name}"
        })
    
    # Apply additional filters
    if project_key:
        query = query.filter_by(jira_project_key=project_key)
    
    if status:
        query = query.filter_by(status=status)
    
    tasks = query.order_by(JiraTask.updated_at.desc()).all()
    
    return jsonify({
        "tasks": [task.to_dict() for task in tasks],
        "total": len(tasks)
    })

@jira_oauth_bp.route('/jira-task/<int:task_id>', methods=['GET'])
@token_required
def get_jira_task(current_user_id, task_id):
    task = JiraTask.query.filter_by(id=task_id, user_id=current_user_id).first()
    
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    return jsonify(task.to_dict())


# =================== Jira Data Synchronization Helper Functions ===================

def process_single_issue(issue, proj_key, current_user_id, synced_tasks):
    """Process a single Jira issue and save it to database"""
    try:
        issue_key = issue['key']
        fields = issue['fields']
        logger.info(f"Processing issue: {issue_key}")

        # Process basic fields
        summary = fields.get('summary', '')
        description = _extract_description_text(fields.get('description'))
        assignee = None
        if fields.get('assignee'):
            assignee = (fields['assignee'].get('displayName') or
                        fields['assignee'].get('emailAddress'))
        
        # Map Chinese status to English
        status_raw = fields.get('status', {}).get('name', 'To Do')
        status = STATUS_MAP.get(status_raw, status_raw)
        
        # Map Chinese priority to English
        priority_raw = fields.get('priority', {}).get('name', 'Medium')
        jira_priority = PRIORITY_MAP.get(priority_raw, priority_raw)
        issue_type = fields.get('issuetype', {}).get('name', 'Task')
        due_date_str = fields.get('duedate')
        due_date = None
        if due_date_str:
            due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
        internal_priority_result = calculate_internal_priority(issue)
        internal_priority = internal_priority_result[0] if isinstance(internal_priority_result, tuple) else internal_priority_result

        # Find or create task
        existing_task = JiraTask.query.filter_by(
            jira_issue_key=issue_key,
            user_id=current_user_id
        ).first()

        if existing_task:
            # Update existing task
            existing_task.title = summary
            existing_task.description = description
            existing_task.assignee = assignee
            existing_task.status = status
            existing_task.jira_priority = jira_priority
            existing_task.internal_priority = internal_priority
            existing_task.jira_issue_type = issue_type
            existing_task.due_date = due_date
            action = 'updated'
            task_obj = existing_task
        else:
            # Create new task
            task_obj = JiraTask(
                user_id=current_user_id,
                title=summary,
                description=description,
                assignee=assignee,
                status=status,
                jira_issue_key=issue_key,
                jira_issue_id=issue['id'],
                jira_issue_type=issue_type,
                jira_project_key=proj_key,
                due_date=due_date,
                jira_priority=jira_priority,
                internal_priority=internal_priority,
            )
            db.session.add(task_obj)
            action = 'created'

        # Process relationship fields
        # issuelinks
        if 'issuelinks' in fields and fields['issuelinks']:
            blocking = []
            blocked_by = []
            related = []
            for link in fields['issuelinks']:
                link_type = link.get('type', {}).get('name', '').lower()
                if 'outwardIssue' in link:
                    target_key = link['outwardIssue']['key']
                    if 'blocks' in link_type:
                        blocking.append(target_key)
                    else:
                        related.append(target_key)
                elif 'inwardIssue' in link:
                    source_key = link['inwardIssue']['key']
                    if 'blocks' in link_type:
                        blocked_by.append(source_key)
                    else:
                        related.append(source_key)
            if blocking:
                task_obj.set_blocking_issues(blocking)
            if blocked_by:
                task_obj.set_blocked_by_issues(blocked_by)
            if related:
                task_obj.set_related_issues(related)

        # Parent-child relationship
        if fields.get('parent'):
            task_obj.parent_issue_key = fields['parent']['key']

        # Epic field - simplified processing
        epic_field = fields.get('customfield_10019')  # 默认Epic字段
        if epic_field and isinstance(epic_field, str) and '-' in epic_field and len(epic_field) < 50:
            # Only accept values that look like valid issue keys (contain - and reasonable length)
            task_obj.epic_issue_key = epic_field
            logger.info(f"Found Epic link for {issue_key}: {epic_field}")
        else:
            # Clear invalid epic field values
            task_obj.epic_issue_key = None

        # Extract subtasks from current issue
        if 'subtasks' in fields and fields['subtasks']:
            subtask_keys = [subtask['key'] for subtask in fields['subtasks']]
            task_obj.set_subtask_keys(subtask_keys)
            logger.info(f"Found {len(subtask_keys)} subtasks for {issue_key}: {subtask_keys}")
        else:
            # Clear subtasks if none exist to handle updates where subtasks were removed
            task_obj.set_subtask_keys([])

        # Process Sprint information from customfield_10020
        try:
            sprint_field = fields.get('customfield_10020')
            if sprint_field and isinstance(sprint_field, list) and len(sprint_field) > 0:
                # Store sprint info as JSON array
                task_obj.sprint_info = sprint_field
                sprint_names = [sprint.get('name', 'Unknown Sprint') for sprint in sprint_field]
                logger.info(f"Found {len(sprint_field)} sprint(s) for {issue_key}: {sprint_names}")
            else:
                # Clear sprint info if no sprints found
                task_obj.sprint_info = None
                logger.debug(f"No sprint info found for {issue_key}")
        except Exception as sprint_error:
            logger.error(f"Error processing sprint info for {issue_key}: {sprint_error}")
            task_obj.sprint_info = None

        synced_tasks.append({
            'issue_key': issue_key,
            'summary': summary,
            'action': action,
            'project': proj_key
        })
        
        return True

    except Exception as e:
        logger.error(f"Error processing issue {issue.get('key', 'unknown')}: {e}")
        return False

def sync_issues_by_jql(credentials, jql, current_user_id, synced_tasks, errors, max_results, proj_key):
    """Sync issues using JQL with pagination support"""
    start_at = 0
    page_size = min(50, max_results)
    total_synced = 0
    
    while True:
        issues_data, error, _ = make_jira_oauth_request(
            credentials,
            f"search?jql={jql}&startAt={start_at}&maxResults={page_size}&fields=*all,customfield_10020"
        )

        if error:
            errors.append(f"Failed to fetch issues with JQL '{jql}' at startAt={start_at}: {error}")
            break

        issues = issues_data.get('issues', [])
        if not issues:
            logger.info(f"No more issues found for JQL '{jql}' at startAt={start_at}")
            break

        logger.info(f"Processing {len(issues)} issues with JQL '{jql}' (startAt={start_at})")

        for issue in issues:
            try:
                if process_single_issue(issue, proj_key, current_user_id, synced_tasks):
                    total_synced += 1
                    # Commit each successful issue individually to avoid transaction rollback
                    db.session.commit()
                else:
                    errors.append(f"Error processing {issue.get('key', 'unknown')}")
                    # Rollback failed issue and continue
                    db.session.rollback()
            except Exception as issue_error:
                logger.error(f"Exception processing issue {issue.get('key', 'unknown')}: {issue_error}")
                errors.append(f"Exception processing {issue.get('key', 'unknown')}: {str(issue_error)}")
                # Rollback failed issue and continue
                db.session.rollback()
        
        # Check if pagination is complete
        if len(issues) < page_size:
            logger.info(f"Completed sync for JQL '{jql}'. Total synced: {total_synced}")
            break
            
        # Prepare for next page
        start_at += page_size
        logger.info(f"Moving to next page for JQL '{jql}', startAt={start_at}")
    
    return total_synced


# =================== Jira Data Synchronization ===================

@jira_oauth_bp.route('/sync-from-jira', methods=['POST'])
@token_required
def sync_from_jira(current_user_id):
    """
    Sync tasks from Jira to local database
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    parameters:
      - in: body
        name: body
        required: false
        schema:
          type: object
          properties:
            project_key:
              type: string
              example: "PROJ"
              description: Specific project key to sync (optional, syncs all user projects if not provided)
            max_results:
              type: integer
              example: 100
              description: Maximum number of results to fetch per project (default 100)
    responses:
      200:
        description: Tasks synced successfully
        schema:
          type: object
          properties:
            message:
              type: string
              example: "Successfully synced 25 tasks from Jira"
            synced_tasks:
              type: array
              items:
                type: object
                properties:
                  issue_key:
                    type: string
                    example: "PROJ-123"
                    description: Jira issue key
                  summary:
                    type: string
                    example: "Fix login bug"
                    description: Issue summary
                  action:
                    type: string
                    example: "updated"
                    description: Action performed (created/updated)
                  project:
                    type: string
                    example: "PROJ"
                    description: Project key
            projects_synced:
              type: array
              items:
                type: string
              example: ["PROJ1", "PROJ2"]
              description: List of project keys that were synced
            errors:
              type: array
              items:
                type: string
              example: ["Failed to fetch issues for project PROJ3: timeout"]
              description: List of errors encountered during sync
      400:
        description: No projects to sync or connection error
        schema:
          type: object
          properties:
            error:
              type: string
              example: "No projects to sync. Please select projects first."
      401:
        description: OAuth token expired
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
        description: Sync failed
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
    project_key = data.get('project_key')
    max_results = data.get('max_results', 1000)

    try:
        # Determine projects to sync
        if project_key:
            project_keys = [project_key]
        else:
            preferences = UserProjectPreference.query.filter_by(user_id=current_user_id).all()
            project_keys = [pref.project_key for pref in preferences] if preferences else []

        if not project_keys:
            return jsonify({"error": "No projects to sync. Please select projects first."}), 400

        synced_tasks = []
        errors = []

        for proj_key in project_keys:
            # Simple paginated sync for all issues
            logger.info(f"Starting paginated sync for project {proj_key}")
            jql = f"project = {proj_key} ORDER BY updated DESC"
            synced_count = sync_issues_by_jql(credentials, jql, current_user_id, synced_tasks, errors, max_results, proj_key)
            logger.info(f"Completed sync for project {proj_key}. Total synced: {synced_count}")

        # Note: No need for final commit as each issue is committed individually
        
        logger.info(f"Sync completed. Total tasks synced: {len(synced_tasks)}")

        return jsonify({
            "message": f"Successfully synced {len(synced_tasks)} tasks from Jira using simple paginated sync",
            "synced_tasks": synced_tasks,
            "projects_synced": project_keys,
            "errors": errors
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Sync failed: {e}")
        return jsonify({"error": f"Sync failed: {str(e)}"}), 500


# =================== Testing and Debug Endpoints ===================

@jira_oauth_bp.route('/test-connection', methods=['GET'])
@token_required
def test_oauth_connection(current_user_id):
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code
    
    tests = []
    
    # Test 1: Get current user information
    user_data, error, status = make_jira_oauth_request(credentials, 'myself')
    tests.append({
        'test': 'Get current user',
        'success': error is None,
        'data': user_data if error is None else error,
        'status_code': status
    })
    
    # Test 2: Get project list
    if error is None:
        projects_data, error, status = make_jira_oauth_request(credentials, 'project/search?maxResults=5')
        tests.append({
            'test': 'Get projects',
            'success': error is None,
            'data': projects_data if error is None else error,
            'status_code': status
        })
    
    # Test 3: Execute search query
    if error is None:
        search_data, error, status = make_jira_oauth_request(credentials, 'search?jql=ORDER BY created DESC&maxResults=1')
        tests.append({
            'test': 'Search issues',
            'success': error is None,
            'data': search_data if error is None else error,
            'status_code': status
        })
    
    return jsonify({
        "oauth_connection_test": True,
        "credentials_valid": True,
        "site_name": credentials.site_name,
        "site_id": credentials.site_id,
        "tests": tests
    })

@jira_oauth_bp.route('/rebuild-jira-tasks', methods=['POST'])
def rebuild_jira_tasks():
    try:
        # 1. Drop the table
        db.session.execute(text("DROP TABLE IF EXISTS jira_tasks CASCADE;"))
        db.session.commit()
        # 2. Recreate the table using SQLAlchemy model definitions
        db.create_all()  # Only creates tables that don't exist
        return jsonify({
            "success": True,
            "message": "jira_tasks table dropped and recreated successfully."
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Failed to rebuild jira_tasks table: {str(e)}"
        }), 500

import google.generativeai as genai
from models import Message, JiraTask, db
from datetime import datetime
import os

@jira_oauth_bp.route('/ai-summary', methods=['POST'])
@token_required
def generate_ai_summary(current_user_id):
    """
    Generate AI summary for user's Jira tasks
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - meeting_id
          properties:
            meeting_id:
              type: integer
              example: 123
              description: Meeting ID to associate with the summary
    responses:
      200:
        description: AI summary generated successfully
        schema:
          type: object
          properties:
            summary:
              type: string
              example: "## Synced Tasks Information:\n**Meeting ID**: 123\n**Total Tasks**: 5\n\n### Task Analysis:\nHigh priority tasks requiring immediate attention..."
      400:
        description: Missing required parameters
        schema:
          type: object
          properties:
            error:
              type: string
              example: "meeting_id is required"
      404:
        description: No tasks found
        schema:
          type: object
          properties:
            error:
              type: string
              example: "No tasks found for this user"
      500:
        description: AI summary generation failed
        schema:
          type: object
          properties:
            error:
              type: string
              example: "AI summary generation failed: API key not configured"
    """
    data = request.get_json() or {}
    meeting_id = data.get('meeting_id')
    if not meeting_id:
        return jsonify({"error": "meeting_id is required"}), 400

    # Find all JiraTask for this user
    tasks = JiraTask.query.filter_by(user_id=current_user_id).order_by(
        JiraTask.internal_priority.desc(), JiraTask.due_date.asc()
    ).all()
    if not tasks:
        return jsonify({"error": "No tasks found for this user"}), 404

    # Build task details
    task_details = f"""## Synced Tasks Information:
**Meeting ID**: {meeting_id}
**Sync Time**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}
**Total Tasks**: {len(tasks)}

### Task Details:
"""
    for i, t in enumerate(tasks, 1):
        task_details += f"""
{i}. **{t.jira_issue_key or t.task_id}** - {t.title or t.summary}
   - Status: {t.status}
   - Jira Priority: {t.jira_priority}
   - Internal Priority: {t.internal_priority}
   - Assignee: {t.assignee or 'Unassigned'}
"""

    # Build prompt
    jira_prompt = get_jira_sync_summary_prompt()
    full_prompt = f"""{jira_prompt}

{task_details}

Please analyze the above Jira task information and provide a comprehensive sync summary following the format specified above. Focus on actionable insights and recommendations for the team."""

    # Call Gemini API
    try:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel(model_name="models/gemini-3.8-flash")
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=2000,
                temperature=0.3,
            )
        )
        summary = response.text

        # Write to Message table
        summary_msg = Message(
            user_id=current_user_id,
            meeting_id=meeting_id,
            speaker="agent",
            content=summary,
            timestamp=datetime.now(),
            is_summary=True
        )
        db.session.add(summary_msg)
        db.session.commit()

        return jsonify({"summary": summary}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"AI summary generation failed: {str(e)}"}), 500

# =================== Relationship Queries ===================

@jira_oauth_bp.route('/task/<issue_key>/relations', methods=['GET'])
@token_required
def get_task_relations(current_user_id, issue_key):
    task = JiraTask.query.filter_by(
        jira_issue_key=issue_key,
        user_id=current_user_id
    ).first()
    
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    relations = {
        'issue_key': issue_key,
        'title': task.title,
        'blocking_issues': task.get_blocking_issues(),
        'blocked_by_issues': task.get_blocked_by_issues(),
        'related_issues': task.get_related_issues(),
        'depends_on_issues': task.get_depends_on_issues(),
        'dependency_for_issues': task.get_dependency_for_issues(),
        'parent_issue_key': task.parent_issue_key,
        'epic_issue_key': task.epic_issue_key,
        'subtask_keys': task.get_subtask_keys()
    }
    
    return jsonify(relations)


# =================== Basic Connection and Status Check ===================

@jira_oauth_bp.route('/status', methods=['GET'])
@token_required
def oauth_jira_status(current_user_id):
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code
    
    # Test connection
    data, error, status_code = make_jira_oauth_request(credentials, 'myself')
    if error:
        return jsonify(error), status_code
    
    return jsonify({
        "connected": True,
        "site_name": credentials.site_name,
        "site_id": credentials.site_id,
        "setup_completed": credentials.setup_completed,
        "user_info": {
            "account_id": data.get('accountId'),
            "display_name": data.get('displayName'),
            "email": data.get('emailAddress')
        },
        "connection_details": {
            "created_at": credentials.created_at.isoformat(),
            "updated_at": credentials.updated_at.isoformat()
        }
    })

@jira_oauth_bp.route('/setup-status', methods=['GET'])
@token_required
def get_setup_status(current_user_id):
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code
    
    preferences_count = UserProjectPreference.query.filter_by(user_id=current_user_id).count()
    
    return jsonify({
        "setup_completed": credentials.setup_completed,
        "has_preferences": preferences_count > 0,
        "preferences_count": preferences_count,
        "needs_setup": not credentials.setup_completed
    })

def _extract_description_text(desc_field):
    """
    Extract plain text from Atlassian Document Format (ADF) description.
    
    Jira stores rich text descriptions in Atlassian Document Format,
    which is a JSON structure. This function extracts the plain text
    content from that structure.
    
    Args:
        desc_field: The description field from Jira API response.
                   Can be None, string, or ADF JSON structure.
    
    Returns:
        str: Plain text representation of the description
    """
    if desc_field is None:
        return ''
    
    if isinstance(desc_field, str):
        return desc_field
    
    if isinstance(desc_field, dict) and desc_field.get('type') == 'doc':
        # Handle Atlassian Document Format
        text_parts = []
        content = desc_field.get('content', [])
        
        for block in content:
            if block.get('type') == 'paragraph':
                paragraph_content = block.get('content', [])
                for item in paragraph_content:
                    if item.get('type') == 'text':
                        text_parts.append(item.get('text', ''))
        
        return '\n'.join(text_parts)
    
    # If other format, try converting to JSON string
    try:
        import json
        return json.dumps(desc_field, indent=2)
    except:
        return str(desc_field)

def calculate_internal_priority(jira_issue):
    """
    Calculate internal priority score based on Jira issue data.
    
    Computes a numerical priority score (0.0 to 1.0) based on the
    Jira priority level and due date proximity. Higher scores indicate
    higher priority tasks that should be addressed sooner.
    
    Args:
        jira_issue (dict): Single issue from Jira API response
        
    Returns:
        tuple: (priority_score, reasoning_text)
            - priority_score (float): Score from 0.1 to 1.0
            - reasoning_text (str): Human-readable explanation
    
    Priority Mapping:
        - Highest: 1.0, High: 0.8, Medium: 0.5, Low: 0.3, Lowest: 0.1
        - Due date bonuses: +0.3 (≤1 day), +0.2 (≤7 days), +0.1 (≤30 days)
    """
    fields = jira_issue.get('fields', {})
    
    # Priority mapping
    priority_map = {
        'Highest': 1.0,
        'High': 0.8,
        'Medium': 0.5,
        'Low': 0.3,
        'Lowest': 0.1
    }
    
    # Map Chinese priority to English first
    priority_raw = fields.get('priority', {}).get('name', 'Medium')
    jira_priority = PRIORITY_MAP.get(priority_raw, priority_raw)
    base_score = priority_map.get(jira_priority, 0.5)
    
    # Adjust based on due date proximity
    due_date = fields.get('duedate')
    if due_date:
        try:
            due_datetime = datetime.strptime(due_date, '%Y-%m-%d')
            days_until_due = (due_datetime - datetime.now()).days
            
            if days_until_due <= 1:
                base_score = min(1.0, base_score + 0.3)
            elif days_until_due <= 7:
                base_score = min(1.0, base_score + 0.2)
            elif days_until_due <= 30:
                base_score = min(1.0, base_score + 0.1)
        except ValueError:
            pass
    
    # Generate reasoning
    reason = f"Based on Jira priority '{jira_priority}'"
    if due_date:
        reason += f" and due date {due_date}"
    
    return round(base_score, 2), reason

# =================== Contribution Statistics ===================

@jira_oauth_bp.route('/contribution-stats', methods=['GET'])
@token_required
def get_contribution_stats(current_user_id):

    """
    Get team contribution statistics based on Jira subtask priorities
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    parameters:
      - name: status
        in: query
        type: string
        required: false
        description: Filter tasks by status (e.g., 'Done', 'In Progress')
        example: "Done"
      - name: sprint_id
        in: query
        type: integer
        required: false
        description: Filter tasks by sprint ID
        example: 3302
      - name: sprint_name
        in: query
        type: string
        required: false
        description: Filter tasks by sprint name (fuzzy search)
        example: "Sprint 2"
    responses:
      200:
        description: Team contribution statistics
        schema:
          type: object
          properties:
            members:
              type: array
              items:
                type: object
                properties:
                  assignee:
                    type: string
                    example: "john.doe@example.com"
                    description: Member name or email
                  total_score:
                    type: integer
                    example: 12
                    description: Total contribution score
                  percentage:
                    type: number
                    format: float
                    example: 35.5
                    description: Percentage of total contribution
                  task_count:
                    type: integer
                    example: 4
                    description: Number of subtasks completed
                  tasks:
                    type: array
                    items:
                      type: object
                      properties:
                        jira_issue_key:
                          type: string
                          example: "PROJ-123"
                        title:
                          type: string
                          example: "Fix login bug"
                        jira_priority:
                          type: string
                          example: "High"
                        priority_score:
                          type: integer
                          example: 4
                        status:
                          type: string
                          example: "Done"
            summary:
              type: object
              properties:
                total_score:
                  type: integer
                  example: 34
                  description: Total team contribution score
                total_members:
                  type: integer
                  example: 3
                  description: Number of contributing members
                filter_status:
                  type: string
                  example: "Done"
                  description: Applied status filter (if any)
                priority_distribution:
                  type: object
                  properties:
                    Highest:
                      type: integer
                      example: 2
                    High:
                      type: integer
                      example: 3
                    Medium:
                      type: integer
                      example: 5
                    Low:
                      type: integer
                      example: 1
                    Lowest:
                      type: integer
                      example: 0
      400:
        description: No projects selected or connection error
        schema:
          type: object
          properties:
            error:
              type: string
              example: "No projects selected. Please set up your project preferences."
      401:
        description: OAuth token expired
        schema:
          type: object
          properties:
            error:
              type: string
              example: "OAuth token expired"
            message:
              type: string
              example: "Please reconnect to Jira"
    """
    # Get filter parameters
    status_filter = request.args.get('status')
    sprint_id = request.args.get('sprint_id')  # Sprint ID 过滤
    sprint_name = request.args.get('sprint_name')  # Sprint 名称模糊搜索
    
    # Get user's current site credentials
    credentials = JiraCredentials.query.filter_by(user_id=current_user_id).first()
    if not credentials:
        return jsonify({"error": "No Jira credentials found"}), 404
    
    # Get user's projects for current site only
    preferences = UserProjectPreference.query.filter_by(
        user_id=current_user_id,
        site_id=credentials.site_id
    ).all()
    if not preferences:
        return jsonify({
            "error": f"No projects selected for {credentials.site_name}. Please set up your project preferences.",
            "current_site": credentials.site_name
        }), 400
    
    project_keys = [pref.project_key for pref in preferences]
    
    # Build query for subtasks only
    query = JiraTask.query.filter(
        JiraTask.user_id == current_user_id,
        JiraTask.jira_issue_type == "Subtask",
        JiraTask.jira_project_key.in_(project_keys)
    )
    
    # Apply status filter if provided
    if status_filter:
        query = query.filter(JiraTask.status == status_filter)
    
    # Apply sprint filters if provided
    if sprint_id:
        # Filter by sprint ID
        query = query.filter(text("sprint_info::text LIKE :sprint_id_pattern").params(
            sprint_id_pattern=f'%"id": {int(sprint_id)}%'
        ))
    elif sprint_name:
        # Filter by sprint name (fuzzy search)
        query = query.filter(text("sprint_info::text LIKE :sprint_name_pattern").params(
            sprint_name_pattern=f'%"name": "%{sprint_name.strip()}%"%'
        ))
    
    subtasks = query.all()
    
    if not subtasks:
        return jsonify({
            "members": [],
            "summary": {
                "total_score": 0,
                "total_members": 0,
                "filter_status": status_filter,
                "filter_sprint_id": sprint_id,
                "filter_sprint_name": sprint_name,
                "priority_distribution": {"Highest": 0, "High": 0, "Medium": 0, "Low": 0, "Lowest": 0}
            }
        })
    
    # Priority score mapping
    priority_scores = {
        "Highest": 5,
        "High": 4,
        "Medium": 3,
        "Low": 2,
        "Lowest": 1
    }
    
    # Group tasks by assignee and calculate scores
    member_stats = {}
    priority_distribution = {"Highest": 0, "High": 0, "Medium": 0, "Low": 0, "Lowest": 0}
    total_score = 0
    
    for task in subtasks:
        assignee = task.assignee or "Unassigned"
        priority = task.jira_priority or "Medium"
        score = priority_scores.get(priority, 3)  # Default to Medium score
        
        # Update priority distribution
        if priority in priority_distribution:
            priority_distribution[priority] += 1
        
        # Initialize member stats if not exists
        if assignee not in member_stats:
            member_stats[assignee] = {
                "assignee": assignee,
                "total_score": 0,
                "task_count": 0,
                "tasks": []
            }
        
        # Update member stats
        member_stats[assignee]["total_score"] += score
        member_stats[assignee]["task_count"] += 1
        member_stats[assignee]["tasks"].append({
            "jira_issue_key": task.jira_issue_key,
            "title": task.title,
            "jira_priority": priority,
            "priority_score": score,
            "status": task.status
        })
        
        total_score += score
    
    # Calculate percentages and convert to list
    members = []
    for member_data in member_stats.values():
        percentage = (member_data["total_score"] / total_score * 100) if total_score > 0 else 0
        member_data["percentage"] = round(percentage, 1)
        members.append(member_data)
    
    # Sort members by total score (descending)
    members.sort(key=lambda x: x["total_score"], reverse=True)
    
    return jsonify({
        "members": members,
        "summary": {
            "total_score": total_score,
            "total_members": len(members),
            "filter_status": status_filter,
            "filter_sprint_id": sprint_id,
            "filter_sprint_name": sprint_name,
            "priority_distribution": priority_distribution
        }
    })

@jira_oauth_bp.route('/available-sprints', methods=['GET'])
@token_required
def get_available_sprints(current_user_id):
    """
    Get all available sprints from user's Jira tasks
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    responses:
      200:
        description: List of available sprints
        schema:
          type: object
          properties:
            available_sprints:
              type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                    example: "Sprint 1"
                    description: Sprint name
                  id:
                    type: string
                    example: "123"
                    description: Sprint ID (if available)
                  task_count:
                    type: integer
                    example: 5
                    description: Number of tasks in this sprint
              description: List of available sprints with details
            total_sprints:
              type: integer
              example: 3
              description: Total number of unique sprints found
            raw_sprint_data:
              type: array
              items:
                type: object
              description: Raw sprint_info data for debugging (optional)
      400:
        description: No projects selected
        schema:
          type: object
          properties:
            error:
              type: string
              example: "No projects selected. Please set up your project preferences."
    """
    # Get user's current site credentials
    credentials = JiraCredentials.query.filter_by(user_id=current_user_id).first()
    if not credentials:
        return jsonify({"error": "No Jira credentials found"}), 404
    
    # Get user's projects for current site only
    preferences = UserProjectPreference.query.filter_by(
        user_id=current_user_id,
        site_id=credentials.site_id
    ).all()
    if not preferences:
        return jsonify({
            "error": f"No projects selected for {credentials.site_name}. Please set up your project preferences.",
            "current_site": credentials.site_name
        }), 400
    
    project_keys = [pref.project_key for pref in preferences]
    
    # Get all tasks with sprint information
    tasks = JiraTask.query.filter(
        JiraTask.user_id == current_user_id,
        JiraTask.jira_project_key.in_(project_keys),
        JiraTask.sprint_info.isnot(None)
    ).all()
    
    sprint_details = {}
    raw_sprint_data = []
    
    logger.info(f"Found {len(tasks)} tasks with sprint info for user {current_user_id}")
    
    for task in tasks:
        if task.sprint_info:
            try:
                sprint_data = task.sprint_info
                
                # Handle different sprint_info formats
                if isinstance(sprint_data, str):
                    # If it's a string, try to parse as JSON
                    try:
                        import json
                        sprint_data = json.loads(sprint_data)
                    except json.JSONDecodeError:
                        # If not JSON, treat as plain string
                        sprint_name = sprint_data
                        sprint_id = None
                        if sprint_name not in sprint_details:
                            sprint_details[sprint_name] = {
                                'name': sprint_name,
                                'id': sprint_id,
                                'task_count': 0,
                                'tasks': []
                            }
                        sprint_details[sprint_name]['task_count'] += 1
                        sprint_details[sprint_name]['tasks'].append(task.jira_issue_key)
                        continue
                
                # Handle list format (multiple sprints per task)
                if isinstance(sprint_data, list):
                    for sprint in sprint_data:
                        if isinstance(sprint, dict):
                            sprint_name = sprint.get('name', f"Sprint {sprint.get('id', 'Unknown')}")
                            sprint_id = sprint.get('id')
                        else:
                            sprint_name = str(sprint)
                            sprint_id = None
                        
                        if sprint_name not in sprint_details:
                            sprint_details[sprint_name] = {
                                'name': sprint_name,
                                'id': sprint_id,
                                'task_count': 0,
                                'tasks': []
                            }
                        sprint_details[sprint_name]['task_count'] += 1
                        sprint_details[sprint_name]['tasks'].append(task.jira_issue_key)
                
                # Handle single dict format
                elif isinstance(sprint_data, dict):
                    sprint_name = sprint_data.get('name', f"Sprint {sprint.get('id', 'Unknown')}")
                    sprint_id = sprint_data.get('id')
                    
                    if sprint_name not in sprint_details:
                        sprint_details[sprint_name] = {
                            'name': sprint_name,
                            'id': sprint_id,
                            'task_count': 0,
                            'tasks': []
                        }
                    sprint_details[sprint_name]['task_count'] += 1
                    sprint_details[sprint_name]['tasks'].append(task.jira_issue_key)
                
                # Store raw data for debugging
                raw_sprint_data.append({
                    'task_key': task.jira_issue_key,
                    'sprint_info': sprint_data,
                    'sprint_info_type': type(sprint_data).__name__
                })
                
            except Exception as e:
                logger.error(f"Error processing sprint info for task {task.jira_issue_key}: {e}")
                # Store problematic data for debugging
                raw_sprint_data.append({
                    'task_key': task.jira_issue_key,
                    'sprint_info': task.sprint_info,
                    'error': str(e)
                })
    
    # Convert to list and sort by name
    available_sprints = list(sprint_details.values())
    available_sprints.sort(key=lambda x: x['name'])
    
    # Prepare response
    response = {
        "available_sprints": available_sprints,
        "total_sprints": len(available_sprints),
        "total_tasks_with_sprints": len(tasks)
    }
    
    # Include raw data for debugging (optional, can be removed in production)
    if request.args.get('debug') == 'true':
        response["raw_sprint_data"] = raw_sprint_data[:10]  # Limit to first 10 for brevity
    
    logger.info(f"Found {len(available_sprints)} unique sprints for user {current_user_id}")
    
    return jsonify(response)

@jira_oauth_bp.route('/sync-team-members', methods=['POST'])
@token_required
def sync_team_members(current_user_id):
    """
    Sync team members from Jira OAuth to database
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    responses:
      200:
        description: Successfully synchronized team members
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            synced_members:
              type: integer
              example: 5
            new_members:
              type: integer
              example: 2
            updated_members:
              type: integer
              example: 3
      400:
        description: Jira connection error or no projects selected
      401:
        description: OAuth token expired
      500:
        description: Synchronization failed
    """
    credentials, error, status_code = get_jira_credentials(current_user_id)
    if error:
        return jsonify(error), status_code
    
    # Get user's projects for current site only
    preferences = UserProjectPreference.query.filter_by(
        user_id=current_user_id,
        site_id=credentials['site_id']  # credentials is a dict from get_jira_credentials
    ).all()
    if not preferences:
        return jsonify({
            "success": False,
            "error": f"No projects selected for current site. Please set up project preferences first.",
            "current_site": credentials.get('site_name', 'Unknown')
        }), 400
    
    try:
        synced_count = 0
        new_count = 0
        updated_count = 0
        
        for pref in preferences:
            # Get assignable users (team members) for project
            members_data, error, _ = make_jira_oauth_request(
                credentials, 
                f"user/assignable/search?project={pref.project_key}&maxResults=100"
            )
            
            if error:
                logger.warning(f"Failed to fetch members for project {pref.project_key}: {error}")
                continue
                
            if not members_data:
                continue
                
            for member in members_data:
                # Check if already exists
                existing = JiraUser.query.filter_by(
                    user_id=current_user_id,
                    site_id=pref.site_id,
                    jira_account_id=member.get('accountId')
                ).first()
                
                if existing:
                    # Update existing record
                    existing.jira_email = member.get('emailAddress')
                    existing.display_name = member.get('displayName')
                    existing.jira_username = member.get('name')
                    existing.avatar_url = member.get('avatarUrls', {}).get('48x48')
                    existing.is_active = member.get('active', True)
                    existing.last_synced = datetime.utcnow()
                    updated_count += 1
                else:
                    # Create new record
                    jira_user = JiraUser(
                        user_id=current_user_id,
                        jira_account_id=member.get('accountId'),
                        jira_email=member.get('emailAddress'),
                        display_name=member.get('displayName'),
                        jira_username=member.get('name'),
                        avatar_url=member.get('avatarUrls', {}).get('48x48'),
                        site_id=pref.site_id,
                        is_active=member.get('active', True)
                    )
                    db.session.add(jira_user)
                    new_count += 1
                
                synced_count += 1
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "synced_members": synced_count,
            "new_members": new_count,
            "updated_members": updated_count,
            "message": f"Successfully synced {synced_count} team members"
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Team member sync failed: {e}")
        return jsonify({
            "success": False,
            "error": f"Sync failed: {str(e)}"
        }), 500


@jira_oauth_bp.route('/team-members', methods=['GET'])
@token_required
def get_team_members(current_user_id):
    """
    Get synchronized team members list
    ---
    tags:
      - Jira OAuth
    security:
      - jwt: []
    responses:
      200:
        description: Team members list
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            members:
              type: array
              items:
                type: object
                properties:
                  jira_account_id:
                    type: string
                  display_name:
                    type: string
                  jira_email:
                    type: string
                  avatar_url:
                    type: string
                  is_active:
                    type: boolean
            total:
              type: integer
              example: 5
    """
    try:
        members = JiraUser.query.filter_by(
            user_id=current_user_id, 
            is_active=True
        ).order_by(JiraUser.display_name).all()
        
        return jsonify({
            "success": True,
            "members": [member.to_dict() for member in members],
            "total": len(members)
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch team members: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def get_jira_sync_summary_prompt():
    """Get system prompt for Jira sync task summary"""
    return """You are a professional project management assistant specializing in analyzing Jira data and generating efficient meeting agendas.

Based on team and individual progress data from Jira, quickly generate concise meeting agendas and discussion directions using **Markdown formatting with emojis**.
**CRITICAL FORMATTING RULES:
- Use Markdown syntax for structure: ###, **bold**, *italic*, - lists
- Use **bold** for important headings and key terms
- Use *italic* for emphasis and highlights
- Add relevant emojis to make content more engaging
- Keep clear section hierarchy
- All outputs in English**

## ANALYSIS FRAMEWORK:
Analyze the following key Jira metrics:
- Overall team progress completion rate
- Individual task completion status  
- Number of overdue tasks and reasons
- Blocking issues and risk points
- Critical tasks approaching deadlines

## OUTPUT FORMAT:

### 🚨 **Key Issues:**
- 🔥 [Most urgent problems to resolve]
- 🚧 [Blocking points requiring team discussion]
- ⚠️ [Important matters requiring meeting decisions]

### 📊 **Progress Review:**
- **Team completion rate:** [data]% - *[brief assessment]* 📈/📉
- **Risk alerts:** ⏰ [overdue/approaching deadline critical tasks]

### 🎯 **High Priority Tasks Details:**
[For each high priority task, use this format:]
- 🔴 **Task ID:** [ID] - [Summary]
  - 👤 Assignee: [Name or Unassigned]
  - 📅 Due Date: *[Date or None]*
  - ⭐ Jira Priority: **[Priority Level]**
  - 📋 Status: [Current Status]

### 🟡 **Medium Priority Tasks:**
- 📝 [List key medium priority tasks in brief format]
- 💡 [Example: PROJ-123 - Feature implementation (Assignee: John)]

### ⚡ **Immediate Actions Required:**
- 📌 [Specific task assignments needed]
- ⏳ [Critical deadlines to address]
- 🔧 [Blocking issues to resolve]

## EMOJI USAGE GUIDELINES:
- 🚨 🔥 ⚠️ for urgent/critical items
- 📊 📈 📉 for progress/data
- 🎯 🔴 🟡 🟢 for priorities
- 👤 📅 📋 ⭐ for task details
- 📌 ⏳ 🔧 for actions
- 💡 📝 ✅ for general items
- 🚧 🛑 for blockers

## REQUIREMENTS:
- Keep each bullet point within 15 words
- Use appropriate emojis for visual appeal
- Highlight data and specific actions
- Distinguish urgency levels (High/Medium/Low)
- Provide clear timelines
- Focus on actionable content

## ANALYSIS LOGIC:
1. **Data-driven:** Let numbers speak 📊
2. **Problem-oriented:** Focus on issues needing resolution 🔍
3. **Action-oriented:** Each agenda item must have clear follow-up actions ✅
4. **Time-sensitive:** Prioritize urgent and important matters ⏰

**IMPORTANT: All outputs must be in English, regardless of input language.**"""
