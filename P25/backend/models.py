from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()
db = SQLAlchemy(engine_options={"pool_pre_ping": True})
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(128), unique=True, nullable=False)
    username = db.Column(db.String(64), unique=True, nullable=False)
    # password_hash = db.Column(db.String(128), nullable=False)
    password_hash = db.Column(db.Text, nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
# models.py

class Meeting(db.Model):
    __tablename__ = "meetings"
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    meeting_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    meeting_id = db.Column(db.Integer, nullable=False)
    __table_args__ = (db.ForeignKeyConstraint(
        ['user_id', 'meeting_id'], ['meetings.user_id', 'meetings.meeting_id']
    ),)
    timestamp = db.Column(db.DateTime)
    speaker = db.Column(db.String(128))
    content = db.Column(db.Text)
    is_summary = db.Column(db.Boolean, default=False)

class Task(db.Model):
    __tablename__ = "tasks"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    meeting_id = db.Column(db.Integer, nullable=False)
    __table_args__ = (db.ForeignKeyConstraint(
        ['user_id', 'meeting_id'], ['meetings.user_id', 'meetings.meeting_id']
    ),)
    
    task_id = db.Column(db.String(128), nullable=False)
    summary = db.Column(db.String(256), nullable=False)  
    description = db.Column(db.Text, nullable=True)  
    assignee = db.Column(db.String(128))
    deadline = db.Column(db.Date)
    jira_priority = db.Column(db.String(50))
    internal_priority = db.Column(db.Float)  
    priority_reason = db.Column(db.Text)
    status = db.Column(db.String(50), default="To Do")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'summary': self.summary,
            'description': self.description,
            'assignee': self.assignee,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'jira_priority': self.jira_priority,
            'internal_priority': self.internal_priority,
            'priority_reason': self.priority_reason,
            'status': self.status,
            'meeting_id': self.meeting_id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Material(db.Model):
    __tablename__ = "materials"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    meeting_id = db.Column(db.Integer, nullable=False)
    __table_args__ = (db.ForeignKeyConstraint(
        ['user_id', 'meeting_id'], ['meetings.user_id', 'meetings.meeting_id']
    ),)
    filename = db.Column(db.String(256))  # ✅ 新增字段
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)

class JiraCredentials(db.Model):
    """存储用户的 Jira OAuth 凭证"""
    __tablename__ = 'jira_credentials'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    access_token = db.Column(db.Text, nullable=False)  # 改为 Text 类型，支持更长的 token
    refresh_token = db.Column(db.Text, nullable=True)  # 改为可空，因为有些 OAuth 流程可能不返回 refresh_token
    token_expires_at = db.Column(db.DateTime)
    site_id = db.Column(db.String(255))
    site_name = db.Column(db.String(255))
    setup_completed = db.Column(db.Boolean, default=False)  # 是否完成项目设置
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联用户
    user = db.relationship('User', backref=db.backref('jira_credentials', lazy=True))
    
    def __repr__(self):
        return f'<JiraCredentials {self.id} for user {self.user_id}>'

class OAuthState(db.Model):
    """存储 OAuth 状态信息，避免依赖 session"""
    __tablename__ = 'oauth_states'
    
    id = db.Column(db.Integer, primary_key=True)
    state = db.Column(db.String(255), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # 可选，支持未登录用户
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    # 关联用户（可选）
    user = db.relationship('User', backref=db.backref('oauth_states', lazy=True))
    
    def is_expired(self):
        """检查状态是否过期"""
        return datetime.utcnow() > self.expires_at
    
    def __repr__(self):
        return f'<OAuthState {self.state} for user {self.user_id}>'

class JiraTask(db.Model):
    """专门用于测试 Jira 集成功能的任务表，不影响原有 tasks 表"""
    __tablename__ = "jira_tasks"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # 基本任务信息
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)
    assignee = db.Column(db.String(128), nullable=True)
    status = db.Column(db.String(50), default="To Do")  # To Do, In Progress, Done
    due_date = db.Column(db.Date)
    jira_priority = db.Column(db.String(50), default="Medium")
    internal_priority = db.Column(db.Float)
    # Jira 集成字段
    jira_issue_key = db.Column(db.String(50), nullable=True)  # W14AALMOND-123 - removed unique=True
    jira_issue_id = db.Column(db.String(50), nullable=True)  # Jira 内部 ID
    jira_issue_type = db.Column(db.String(50), nullable=True)  # Story, Task, Bug, Epic, Subtask
    jira_project_key = db.Column(db.String(50), nullable=True)  # W14AALMOND
    
    # 关系字段 - 使用逗号分隔的字符串存储
    blocking_issues = db.Column(db.Text, nullable=True)  # 当前任务阻塞的其他 issues
    blocked_by_issues = db.Column(db.Text, nullable=True)  # 阻塞当前任务的 issues  
    related_issues = db.Column(db.Text, nullable=True)  # 相关的 issues
    depends_on_issues = db.Column(db.Text, nullable=True)  # 依赖的 issues
    dependency_for_issues = db.Column(db.Text, nullable=True)  # 被依赖的 issues
    
    # 层级关系
    parent_issue_key = db.Column(db.String(50), nullable=True)  # 父任务 (for subtasks)
    epic_issue_key = db.Column(db.String(50), nullable=True)  # 所属 Epic
    subtask_keys = db.Column(db.Text, nullable=True)  # 子任务列表
    
    # Sprint信息 - 从customfield_10020获取
    sprint_info = db.Column(db.JSON, nullable=True)  # Array of sprint objects
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Add composite unique constraint for user_id and jira_issue_key
    __table_args__ = (
        db.UniqueConstraint('user_id', 'jira_issue_key', name='unique_user_jira_issue'),
    )
    
    # 关联用户
    user = db.relationship('User', backref=db.backref('jira_tasks', lazy=True))
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'assignee': self.assignee,
            'status': self.status,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'jira_priority': self.jira_priority,
            'internal_priority': self.internal_priority,
            'jira_issue_key': self.jira_issue_key,
            'jira_issue_id': self.jira_issue_id,
            'jira_issue_type': self.jira_issue_type,
            'jira_project_key': self.jira_project_key,
            'blocking_issues': self.get_blocking_issues(),
            'blocked_by_issues': self.get_blocked_by_issues(),
            'related_issues': self.get_related_issues(),
            'depends_on_issues': self.get_depends_on_issues(),
            'dependency_for_issues': self.get_dependency_for_issues(),
            'parent_issue_key': self.parent_issue_key,
            'epic_issue_key': self.epic_issue_key,
            'subtask_keys': self.get_subtask_keys(),
            # Sprint 相关信息
            'sprint_info': self.get_sprints(),
            'sprint_names': self.get_sprint_names(), 
            'current_sprint': self.get_current_sprint(),
            'active_sprint': self.get_active_sprint(),
            'has_sprint': self.has_sprint(),
            'is_in_active_sprint': self.is_in_active_sprint(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    # === 完整的关系处理方法 ===
    
    def get_blocking_issues(self):
        """获取当前任务阻塞的 issues 列表"""
        if self.blocking_issues:
            return [key.strip() for key in self.blocking_issues.split(',') if key.strip()]
        return []
    
    def set_blocking_issues(self, issue_keys):
        """设置阻塞的 issues"""
        if issue_keys:
            self.blocking_issues = ','.join(issue_keys)
        else:
            self.blocking_issues = None
    
    def add_blocking_issue(self, issue_key):
        """添加一个被当前任务阻塞的 issue"""
        current = self.get_blocking_issues()
        if issue_key not in current:
            current.append(issue_key)
            self.set_blocking_issues(current)
    
    def remove_blocking_issue(self, issue_key):
        """移除一个被当前任务阻塞的 issue"""
        current = self.get_blocking_issues()
        if issue_key in current:
            current.remove(issue_key)
            self.set_blocking_issues(current)
    
    def get_blocked_by_issues(self):
        """获取阻塞当前任务的 issues 列表"""
        if self.blocked_by_issues:
            return [key.strip() for key in self.blocked_by_issues.split(',') if key.strip()]
        return []
    
    def set_blocked_by_issues(self, issue_keys):
        """设置阻塞当前任务的 issues"""
        if issue_keys:
            self.blocked_by_issues = ','.join(issue_keys)
        else:
            self.blocked_by_issues = None
    
    def get_related_issues(self):
        """获取相关的 issues 列表"""
        if self.related_issues:
            return [key.strip() for key in self.related_issues.split(',') if key.strip()]
        return []
    
    def set_related_issues(self, issue_keys):
        """设置相关的 issues"""
        if issue_keys:
            self.related_issues = ','.join(issue_keys)
        else:
            self.related_issues = None
    
    def get_depends_on_issues(self):
        """获取依赖的 issues 列表"""
        if self.depends_on_issues:
            return [key.strip() for key in self.depends_on_issues.split(',') if key.strip()]
        return []
    
    def set_depends_on_issues(self, issue_keys):
        """设置依赖的 issues"""
        if issue_keys:
            self.depends_on_issues = ','.join(issue_keys)
        else:
            self.depends_on_issues = None
    
    def get_dependency_for_issues(self):
        """获取被依赖的 issues 列表"""
        if self.dependency_for_issues:
            return [key.strip() for key in self.dependency_for_issues.split(',') if key.strip()]
        return []
    
    def set_dependency_for_issues(self, issue_keys):
        """设置被依赖的 issues"""
        if issue_keys:
            self.dependency_for_issues = ','.join(issue_keys)
        else:
            self.dependency_for_issues = None
    
    def get_subtask_keys(self):
        """获取子任务列表"""
        if self.subtask_keys:
            return [key.strip() for key in self.subtask_keys.split(',') if key.strip()]
        return []
    
    def set_subtask_keys(self, issue_keys):
        """设置子任务列表"""
        if issue_keys:
            self.subtask_keys = ','.join(issue_keys)
        else:
            self.subtask_keys = None
    
    # === Sprint 管理方法 ===
    
    def get_sprints(self):
        """获取该任务所属的所有sprint列表"""
        return self.sprint_info or []
    
    def get_active_sprint(self):
        """获取当前活跃的sprint"""
        if self.sprint_info:
            return next((s for s in self.sprint_info if s.get('state') == 'active'), None)
        return None
    
    def get_current_sprint(self):
        """获取当前sprint (active 或 future状态)"""
        if self.sprint_info:
            # 优先返回active，如果没有active则返回future
            active = next((s for s in self.sprint_info if s.get('state') == 'active'), None)
            if active:
                return active
            return next((s for s in self.sprint_info if s.get('state') == 'future'), None)
        return None
    
    def get_sprint_names(self):
        """获取sprint名称的逗号分隔字符串，用于显示"""
        if self.sprint_info:
            return ', '.join([s.get('name', '') for s in self.sprint_info if s.get('name')])
        return ''
    
    def has_sprint(self):
        """检查任务是否属于任何sprint"""
        return bool(self.sprint_info and len(self.sprint_info) > 0)
    
    def is_in_active_sprint(self):
        """检查任务是否在活跃的sprint中"""
        return self.get_active_sprint() is not None
    
    def get_sprint_ids(self):
        """获取所有sprint ID列表"""
        if self.sprint_info:
            return [s.get('id') for s in self.sprint_info if s.get('id')]
        return []
    
    def __repr__(self):
        return f'<JiraTask {self.id}: {self.jira_issue_key or self.title}>'

class UserProjectPreference(db.Model):
    """用户项目偏好表 - 支持多站点项目选择"""
    __tablename__ = 'user_project_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    site_id = db.Column(db.String(100), nullable=False)  # Jira站点ID
    project_key = db.Column(db.String(50), nullable=False)
    project_name = db.Column(db.String(200), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)  # 主要关注的项目
    is_active = db.Column(db.Boolean, default=True)    # 是否激活
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 确保用户不会重复添加同一个站点的同一个项目
    __table_args__ = (db.UniqueConstraint('user_id', 'site_id', 'project_key'),)
    
    user = db.relationship('User', backref=db.backref('project_preferences', lazy=True))

class SiteUser(db.Model):
    """Jira site user information table - stores all site user info for task assignment"""
    __tablename__ = 'site_users'
    
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.String(100), nullable=False)  # Site ID from JiraCredentials
    account_id = db.Column(db.String(100), nullable=False)  # Jira user accountId
    display_name = db.Column(db.String(200))  # User display name
    email_address = db.Column(db.String(200))  # User email address
    active = db.Column(db.Boolean, default=True)  # Whether user is active
    timezone = db.Column(db.String(50))  # User timezone
    locale = db.Column(db.String(10))  # User locale settings
    account_type = db.Column(db.String(50))  # Account type: atlassian, customer, app
    
    # Sync related fields
    last_synced = db.Column(db.DateTime, default=datetime.utcnow)  # Last sync time
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Ensure user uniqueness within the same site
    __table_args__ = (db.UniqueConstraint('site_id', 'account_id', name='unique_site_user'),)
    
    def to_dict(self):
        """Convert to dictionary format"""
        return {
            'id': self.id,
            'site_id': self.site_id,
            'account_id': self.account_id,
            'display_name': self.display_name,
            'email_address': self.email_address,
            'active': self.active,
            'timezone': self.timezone,
            'locale': self.locale,
            'account_type': self.account_type,
            'last_synced': self.last_synced.isoformat() if self.last_synced else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<SiteUser {self.account_id}: {self.display_name}>'

class JiraUser(db.Model):
    """Jira user information table - stores team member info from OAuth"""
    __tablename__ = 'jira_users'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Associated current user
    jira_account_id = db.Column(db.String(255), nullable=False)  # Jira account ID (OAuth obtained)
    jira_email = db.Column(db.String(255), nullable=True)       # Jira email
    display_name = db.Column(db.String(255), nullable=True)     # Display name
    jira_username = db.Column(db.String(255), nullable=True)    # Jira username
    avatar_url = db.Column(db.Text, nullable=True)             # User avatar URL
    site_id = db.Column(db.String(100), nullable=False)        # Associated Jira site ID
    is_active = db.Column(db.Boolean, default=True)            # Whether user is active
    last_synced = db.Column(db.DateTime, default=datetime.utcnow)  # Last sync time
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Ensure same user won't duplicate add same site's same Jira user
    __table_args__ = (db.UniqueConstraint('user_id', 'site_id', 'jira_account_id'),)
    
    user = db.relationship('User', backref=db.backref('jira_users', lazy=True))
    
    def to_dict(self):
        """Serialize to dictionary"""
        return {
            'id': self.id,
            'jira_account_id': self.jira_account_id,
            'jira_email': self.jira_email,
            'display_name': self.display_name,
            'jira_username': self.jira_username,
            'avatar_url': self.avatar_url,
            'site_id': self.site_id,
            'is_active': self.is_active,
            'last_synced': self.last_synced.isoformat() if self.last_synced else None
        }
    
    def __repr__(self):
        return f'<JiraUser {self.display_name} ({self.jira_email})>'

