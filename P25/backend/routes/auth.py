from flask import Blueprint, request, jsonify
from models import db, User, Meeting, Material, Message
from flask_jwt_extended import create_access_token
import google.generativeai as genai
import json
import os



auth_bp = Blueprint("auth", __name__)

# -----------------------
# AUTHENTICATION ROUTES
# -----------------------

@auth_bp.route("/register", methods=["POST"])
def register():
    # Register a new user with email, username, and password.
    # Returns user info and JWT token if successful.
    """
    User registration endpoint
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - password
            - username
          properties:
            email:
              type: string
              example: user@example.com
            password:
              type: string
              example: yourpassword
            username:
              type: string
              example: yourusername
    responses:
      201:
        description: Registration successful
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Registration successful
            user_id:
              type: integer
              example: 1
            username:
              type: string
              example: yourusername
      400:
        description: Email already registered or missing fields
    """
    data = request.get_json()
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    # Validate required fields
    if not email or not password or not username:
        return jsonify({"msg": "Missing email, username or password"}), 400
    # Check for duplicate email
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email already registered"}), 400
    # Check for duplicate username
    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "Username already taken"}), 400

    # Create and save new user
    user = User(email=email, username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    # Generate JWT access token
    token = create_access_token(identity=str(user.id))
    return jsonify({
        "msg": "Registration successful",
        "user_id": user.id,
        "username": user.username,
        "access_token": token
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    # User login endpoint. Verifies email and password, returns access token.
    """
    User login endpoint
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
              example: user@example.com
            password:
              type: string
              example: yourpassword
    responses:
      200:
        description: Login successful, returns access_token
        schema:
          type: object
          properties:
            access_token:
              type: string
              example: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
            user_id:
              type: integer
              example: 1
            username:
              type: string
              example: yourusername
      401:
        description: Login failed, invalid email or password
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    # Find user by email
    user = User.query.filter_by(email=email).first()
    # Validate credentials
    if not user or not user.check_password(password):
        return jsonify({"msg": "Invalid credentials"}), 401
    # Generate JWT token if valid
    token = create_access_token(identity=str(user.id))
    return jsonify({
        "access_token": token,
        "user_id": user.id,
        "username": user.username
    })

from flask_jwt_extended import jwt_required, get_jwt_identity

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    # User logout endpoint. (Stateless, token should be discarded on client.)
    """
    User logout endpoint (client should discard token)
    ---
    tags:
      - Auth
    responses:
      200:
        description: User logged out, frontend should clear token
    """
    user_id = int(get_jwt_identity())
    return jsonify({"msg": f"User {user_id} logged out, please clear token on frontend"}), 200

from flask_jwt_extended import jwt_required, get_jwt_identity

@auth_bp.route("/meetings/next-id", methods=["GET"])
def get_next_meeting_id():
    # Returns the next available meeting_id for the given user (auto-increment).
    """
    Get next available meeting ID for current user
    ---
    tags:
      - Meetings
    security:
      - jwt: []
    responses:
      200:
        description: Returns next available meeting_id
        schema:
          type: object
          properties:
            next_meeting_id:
              type: integer
              example: 4
    """
    from models import Meeting
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"msg": "Missing user_id"}), 400
    # Get the last meeting for user and increment id
    last = (
        db.session.query(Meeting)
        .filter_by(user_id=user_id)
        .order_by(Meeting.meeting_id.desc())
        .first()
    )
    next_id = 1 if not last else last.meeting_id + 1
    return jsonify({"next_meeting_id": next_id})

@auth_bp.route("/meetings/create", methods=["POST"])
def create_meeting():
    # Create a new meeting for a user. Requires user_id, meeting_id, and title.
    """
    Create a new meeting record
    ---
    tags:
      - Meetings
    security:
      - jwt: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - meeting_id
            - title
          properties:
            meeting_id:
              type: integer
              example: 5
            title:
              type: string
              example: Sprint Planning Meeting
    responses:
      200:
        description: Creation successful
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Meeting created
            meeting_id:
              type: integer
              example: 5
      400:
        description: Missing fields in request
      409:
        description: meeting_id already exists
    """
    from models import Meeting, User
    data = request.get_json()
    
    user_id = data.get("user_id")
    meeting_id = data.get("meeting_id")
    title = data.get("title")

    if not (user_id and meeting_id and title):
        return jsonify({"msg": "Missing user_id, meeting_id or title"}), 400
    # Validate user
    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    # Prevent duplicate meeting_id for user
    existing = db.session.get(Meeting, (user_id, meeting_id))
    if existing:
        return jsonify({"msg": "Meeting ID already exists"}), 409
    from datetime import datetime
    created_timestamp = datetime.now()
    # Create and save meeting
    meeting = Meeting(user_id=user_id, meeting_id=meeting_id, title=title, created_at=created_timestamp)
    db.session.add(meeting)
    db.session.commit()
    return jsonify({"msg": "Meeting created", "meeting_id": meeting.meeting_id})

@auth_bp.route("/meetings/all", methods=["GET"])
def get_all_meetings():
    # Get all meetings for the specified user_id.
    """
    Get all meetings for current user
    ---
    tags:
      - Meetings
    security:
      - jwt: []
    responses:
      200:
        description: Meeting list for current user
        schema:
          type: object
          properties:
            meetings:
              type: array
              items:
                type: object
                properties:
                  meeting_id:
                    type: integer
                  title:
                    type: string
                  timestamp:
                    type: string
                    format: date-time
                    example: "2025-07-03T08:00:00Z"
    """
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "Missing user_id parameter"}), 400
    # Query all meetings for user
    meetings = Meeting.query.filter_by(user_id=user_id).order_by(Meeting.meeting_id.asc()).all()
    return jsonify({
        "meetings": [
            {
                "meeting_id": m.meeting_id,
                "title": m.title,
                "timestamp": m.created_at.isoformat() if getattr(m, "created_at", None) else None
            }
            for m in meetings
        ]
    })



@auth_bp.route("/meetings/<int:meeting_id>/messages", methods=["GET"])
def get_messages(meeting_id):
    # Get all messages for a given meeting_id (must belong to user).
    """
    Get all messages for a meeting (sorted by time ascending), limited to current user's meetings
    ---
    tags:
      - Messages
    security:
      - jwt: []
    parameters:
      - name: meeting_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Returns message list
        schema:
          type: array
          items:
            type: object
            properties:
              timestamp:
                type: string
                format: date-time
                example: "2025-07-03T09:00:00Z"
              speaker:
                type: string
                example: "Alice"
              content:
                type: string
                example: "This is a comment."
              is_summary:
                type: boolean
                example: false
      403:
        description: Current user has no access to this meeting
    """
    from models import Message
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"msg": "Missing user_id parameter"}), 400
    # Check meeting ownership
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({"msg": "Forbidden: This meeting does not belong to the specified user"}), 403
    # Get messages for meeting
    messages = Message.query.filter_by(user_id=user_id, meeting_id=meeting_id).order_by(Message.timestamp.asc()).all()
    result = [
        {
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            "speaker": m.speaker,
            "content": m.content,
            "is_summary": m.is_summary
        }
        for m in messages
    ]
    return jsonify(result), 200


@auth_bp.route("/meetings/<int:meeting_id>/tasks", methods=["GET"])
def get_tasks(meeting_id):
    # Get all tasks for a specified meeting (must belong to user).
    """
    Get all tasks for specified meeting, limited to current user access
    ---
    tags:
      - Tasks
    security:
      - jwt: []
    parameters:
      - in: path
        name: meeting_id
        required: true
        type: integer
    responses:
      200:
        description: Returns task list
      403:
        description: Current user has no access to this meeting
    """
    from models import Task, Meeting

    user_id = request.args.get("user_id", type=int)
    if user_id is None:
        return jsonify({"msg": "Missing user_id"}), 400
    # Check meeting ownership
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({"msg": "Forbidden: This meeting does not belong to the specified user"}), 403
    # Get all tasks for this meeting
    tasks = Task.query.filter_by(meeting_id=meeting_id).order_by(Task.deadline.asc()).all()
    result = [
        {
            "id": t.id,
            "task_id": t.task_id,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "jira_priority": t.jira_priority,
            "internal_priority": t.internal_priority,
            "assignee": t.assignee,
            "description": t.description
        }
        for t in tasks
    ]
    return jsonify(result), 200

@auth_bp.route("/meetings/<int:meeting_id>/upload-material", methods=["POST"])
def upload_material(meeting_id):
    # Uploads a text or docx file as meeting material, saves content to DB,
    # and uses Gemini AI to auto-generate a meeting summary, which is also stored as a message.
    """
    Upload text material files (txt/docx), content will be stored in database and meeting summary will be auto-generated by Gemini
    ---
    tags:
      - Materials
    consumes:
      - multipart/form-data
    security:
      - jwt: []
    parameters:
      - name: meeting_id
        in: path
        type: integer
        required: true
      - name: file
        in: formData
        type: file
        required: true
      - name: speaker
        in: formData
        type: string
        required: false
        description: Uploader name, defaults to "user"
    responses:
      200:
        description: File uploaded and stored successfully, returns save status
        schema:
          type: object
          properties:
            msg:
              type: string
              example: Material uploaded and saved.
            filename:
              type: string
              example: "meeting_notes.docx"
      400:
        description: Upload failed (no file or format not supported)
    """
    from models import Material
    import datetime
    user_id = request.form.get("user_id")
    uploaded_file = request.files.get("file")
    if not uploaded_file:
        return jsonify({"msg": "No file uploaded"}), 400
    filename = uploaded_file.filename
    # Only allow txt or docx files
    if not filename.endswith(".txt") and not filename.endswith(".docx"):
        return jsonify({"msg": "Only .txt or .docx files allowed"}), 400
    # Extract file content
    if filename.endswith(".txt"):
        content = uploaded_file.read().decode("utf-8")
    else:
        from docx import Document
        doc = Document(uploaded_file)
        content = "\n".join(p.text for p in doc.paragraphs)
    # Save material in DB
    material = Material(
        user_id=user_id,
        meeting_id=meeting_id,
        filename=filename,
        content=content,
        timestamp=datetime.datetime.now()
    )
    db.session.add(material)
    speaker = request.form.get("speaker") or "user"
    # Add user message to chat log
    user_msg = Message(
        user_id=user_id,
        meeting_id=meeting_id,
        speaker=speaker,
        content=f"You have uploaded {filename}",
        is_summary=False,
        timestamp=datetime.datetime.now()
    )
    db.session.add(user_msg)
    # Try to generate summary using Gemini AI
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel(model_name="models/gemini-3.8-flash")
        meeting_prompt = get_structured_meeting_prompt()
        # Build prompt for Gemini
        full_prompt = f"""{meeting_prompt}

## Meeting Material Content:
{content}

Please analyze the above meeting material and generate a comprehensive meeting summary following the format specified above. Identify whether this is an internal team meeting or a guidance meeting based on the content, then apply the appropriate format."""
        # Call Gemini API for summary
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1500,
                temperature=0.3,
            )
        )
        summary = response.text
        # Save AI summary as a message
        summary_msg = Message(
            user_id=user_id,
            meeting_id=meeting_id,
            speaker="agent",
            content=summary,
            is_summary=False,
            timestamp=datetime.datetime.now()
        )
        db.session.add(summary_msg)
        db.session.commit()
    except Exception as e:
        # If AI summary fails, commit what is saved and log error as new message
        print("❌ Gemini summarization failed:", e)
        db.session.commit()
        error_msg = Message(
            user_id=user_id,
            meeting_id=meeting_id,
            speaker="agent", 
            content=f"⚠️ Material uploaded but AI summary generation failed: {str(e)}",
            is_summary=False,
            timestamp=datetime.datetime.now()
        )
        db.session.add(error_msg)
        db.session.commit()
        return jsonify({
            "msg": "Material uploaded but summary generation failed.",
            "filename": filename,
            "warning": f"AI summary failed: {str(e)}"
        }), 200
    return jsonify({
        "msg": "Material uploaded and saved.",
        "filename": filename
    }), 200


@auth_bp.route("/meetings/<int:meeting_id>/materials", methods=["GET"])
def get_materials(meeting_id):
    # Return all uploaded materials for a given meeting (must belong to user).
    """
    Get all uploaded materials for specified meeting
    ---
    tags:
      - Materials
    parameters:
      - name: meeting_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Successfully returns material list
        schema:
          type: array
          items:
            type: object
            properties:
              meeting_id:
                type: integer
                example: 2
              filename:
                type: string
                example: meeting_notes.docx
              content:
                type: string
                example: "Discussion on upcoming sprint..."
              timestamp:
                type: string
                format: date-time
                example: "2025-06-26T08:00:00Z"
    """
    user_id = request.args.get("user_id", type=int)
    from models import Material, Meeting
    # Check meeting ownership
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({"msg": "Forbidden: This meeting does not belong to the current user"}), 403
    # Get all materials for the meeting
    materials = Material.query.filter_by(user_id=user_id, meeting_id=meeting_id).order_by(Material.timestamp.asc()).all()
    result = [
        {
            "meeting_id": m.meeting_id,
            "filename": m.filename,
            "content": m.content,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            "size": len(m.content.encode("utf-8")) if m.content else 0,
        }
        for m in materials
    ]
    return jsonify(result), 200


from flask import Response

@auth_bp.route("/meetings/<int:meeting_id>/materials/download", methods=["GET"])
def download_materials(meeting_id):
    # Download all material contents for a meeting as a single .txt file.
    """
    Download all material content for specified meeting as one .txt file
    ---
    tags:
      - Materials
    responses:
      200:
        description: Downloaded txt file
      403:
        description: Current user has no access to this meeting
    """
    from models import Material, Meeting
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"msg": "Missing user_id"}), 400
    # Check meeting ownership
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({"msg": "Forbidden"}), 403
    # Aggregate all materials' content for download
    materials = Material.query.filter_by(user_id=user_id, meeting_id=meeting_id).order_by(Material.timestamp.asc()).all()
    content_lines = []
    for m in materials:
        content_lines.append(f"=== {m.filename} ===")
        content_lines.append(m.content.strip())
        content_lines.append("\n")
    full_text = "\n".join(content_lines)
    return Response(
        full_text,
        mimetype='text/plain',
        headers={
            "Content-Disposition": f"attachment; filename=meeting_{meeting_id}_materials.txt"
        }
    )


import os
import google.generativeai as genai
from models import Message
from datetime import datetime


def get_structured_meeting_prompt():
    # Returns the system prompt for Gemini to generate structured meeting summaries.
    """Get structured system prompt for meeting summary generation"""
    # return """# University Team Project Meeting Summary AI Agent

# ## Role Definition
# You are a professional meeting summary assistant for university team projects. Generate clean, readable summaries using **Markdown formatting** with task analysis. Always using English to respond.

# **CRITICAL FORMATTING RULES:
# - Use Markdown syntax for structure: #, ##, ###, **bold**, *italic*, - lists
# - Use **bold** for important headings and key terms
# - Use *italic* for emphasis and highlights
# - Use - or • for lists and bullet points
# - Keep clear section hierarchy
# - All outputs in English**

# ## Meeting Type Recognition
# First, determine the meeting type from the content:
# - Internal Meeting: Only team members present, discussing progress and tasks
# - Guidance Meeting: Includes teachers, advisors, or clients providing feedback

# ## Output Format Guidelines

# **For Internal Team Meetings, include these sections:**
# - Meeting Basic Information (project name, time, participants)
# - Individual Contribution Record (each member's work, assessment, challenges, plans)
# - Project Progress Update (overall progress %, completed tasks, incomplete tasks)
# - Participation Summary (encourage team members)
# - Conflicts and Disagreements (if any, with solutions)
# - Technical Discussions (issues, solutions, responsible persons)
# - Task Assignments (with assignees, deadlines, priorities)

# **For Guidance Meetings, include these sections:**
# - Meeting Basic Information (project name, time, participants, advisor names)
# - Project Presentation (presenter, key points, materials shown, effectiveness)
# - Advisor Feedback (CRITICAL SECTION - positive aspects, improvement areas, specific suggestions, priority requirements)
# - Questions and Answers (each Q&A with asker, answerer, key points, follow-up actions)
# - Technical Guidance (challenges discussed, advisor suggestions, proposed solutions)
# - Improvement Plan (specific items with assignees, deadlines, expected outcomes)
# - Risk Alerts (critical risks, attention areas, potential impact)

# ## TASK ANALYSIS REQUIREMENTS
# After generating the meeting summary, analyze the content and extract actionable tasks. Look for:
# - **Explicit assignments**: Direct task assignments mentioned ("Zhang San handles frontend", "Li Si handles backend")
# - **Implicit tasks**: Work items inferred from discussions and decisions
# - **Technical requirements**: Frontend, backend, testing, documentation needs
# - **Follow-up actions**: Items requiring completion before next meeting
# - **Improvement items**: Tasks arising from feedback or issues discussed

# ## Task Assignment Intelligence
# - **Frontend tasks**: Frontend maintenance, UI/UX design, React components, styling
# - **Backend tasks**: Backend new features, API development, database, server logic
# - **Testing tasks**: Testing, unit tests, integration tests, QA, bug fixes
# - **Documentation**: Documentation, technical docs, user guides, API documentation
# - **Management**: Project management, planning, coordination, meetings

# ## Content Analysis Instructions
# 1. **Read the meeting content carefully**
# 2. **Identify the meeting type** based on participants and discussion topics
# 3. **Extract key information** for each relevant section
# 4. **Generate a comprehensive summary** using the appropriate format
# 5. **Analyze and extract actionable tasks** with proper assignments

# ## Required Output Format
# **Meeting Summary (Markdown)**
# - Start directly with the meeting summary (no meta-commentary)
# - Use appropriate section headers with emojis
# - Apply **bold** formatting for important terms
# - Use *italic* for emphasis
# - Create organized lists with proper indentation
# - Internal meetings: 600-800 words
# - Guidance meetings: 700-900 words
# - Focus on actionable content and clear next steps
# - Include task assignments in a clear **Task Assignments** section with specific people and responsibilities

# ## Task Extraction Rules
# - Extract 3-8 tasks typically (avoid over-fragmentation)
# - Include both explicit assignments and inferred tasks
# - Use actual names mentioned in the meeting
# - Set realistic deadlines based on task complexity
# - Provide clear, actionable task descriptions
# - Include source context for transparency"""
    return {
        "role": "system",
        "content": """# University Team Project Meeting Summary AI Agent System Prompt
## Role Definition
You are a professional meeting summary assistant specialized in university team projects. You can intelligently identify different types of meetings and apply corresponding recording formats. You need to distinguish between two main scenarios: internal team meetings and mentorship/client guidance meetings.

**IMPORTANT: All outputs must be in English, regardless of the input language.**

## Meeting Type Recognition
Automatically determine based on participants:
- **Internal Meeting**: Only team members present
- **Guidance Meeting**: Includes teachers, clients, mentors, or other external advisors

---

## Scenario A: Internal Team Meeting Format

### 📋 Meeting Basic Information
- **Project Name**:
- **Meeting Time**:
- **Participants**:

### 👥 Individual Contribution Record
| Name | Work Completed | Contribution Assessment | Challenges Faced | Next Period Plan |
|------|----------------|------------------------|------------------|------------------|
| | | | | |

*For teammates with slower progress: Everyone has their own pace, and continuous improvement is what matters. If you encounter difficulties, remember to ask the team for help. We will solve problems together and make progress as a team.*

### 📊 Project Progress Update
- **Overall Progress**: xx% (Compared to last time: +/-xx%)
- **Completed This Week**:
- **Incomplete Tasks and Reasons**:
- **Milestone Achievement Status**:

### 🗣️ Participation Summary
In this meeting, [specific member names] actively participated in discussions and provided valuable insights for project advancement. For teammates who were relatively quiet, we understand that everyone has different ways of thinking and expressing themselves. We hope to hear more of your thoughts in the next meeting. Remember, everyone's perspective is important, and the team needs all of your voices.

*Suggestion: Create more opportunities for less vocal members to express themselves, such as preparing questions in advance or using small group discussion formats.*

### ⚡ Conflicts and Disagreements Record
| Issue | Supporting View A | Supporting View B | Solution | Status |
|-------|-------------------|-------------------|----------|--------|
| | | | | |

### 🔧 Technical Discussion Record
- **Technical Issue**:
- **Solution**:
- **Responsible Person**:
- **Expected Resolution Time**:

### ✅ Task Assignment
| Task | Responsible Person | Deadline | Priority | Dependencies |
|------|-------------------|----------|----------|--------------|
| | | | | |

---

## Scenario B: Mentorship/Client Guidance Meeting Format

### 📋 Meeting Basic Information
- **Project Name**:
- **Meeting Time**:
- **Participants**:
- **Advisor(s)**: (Name and position of teacher/client/mentor)

### 📈 Project Presentation Content
- **Presenter**:
- **Key Points Presented**:
- **Materials Demonstrated**:
- **Demonstration Effectiveness**:

### 👨‍🏫 Advisor Feedback (Key Focus)
#### Teacher/Client Comments:
- **Positive Aspects**:
- **Areas for Improvement**:
- **Specific Suggestions**:
- **Priority Requirements**:

#### Critical Guidance Points:
- **Directional Advice**:
- **Technical Route Adjustments**:
- **Timeline Requirements**:
- **Quality Standards**:

### 📝 Questions and Answers
| Questioner | Question Content | Respondent | Key Points of Answer | Follow-up Action |
|------------|------------------|------------|---------------------|------------------|
| | | | | |

### 🔧 Technical Discussion Record
- **Technical Challenges**:
- **Guidance Suggestions**:
- **Proposed Solutions**:
- **Technical Validation Plan**:

### 📋 Improvement Plan
| Improvement Item | Responsible Person | Deadline | Expected Outcome | Reporting Milestone |
|------------------|-------------------|----------|------------------|-------------------|
| | | | | |

### ⚠️ Risk Alerts
- **Risk Points Emphasized by Teacher/Client**:
- **Issues Requiring Close Attention**:
- **Potential Impact**:

---

## Output Format Control

### Internal Meeting Format:
- **Total Word Count: 600-800 words**
- **7 sections, 20-25 lines**
- **Focus: Individual contributions, team collaboration, task assignment**

### Guidance Meeting Format:
- **Total Word Count: 700-900 words**
- **7 sections, 25-30 lines**
- **Focus: Advisor feedback, improvement plans, risk alerts**

## Core Recording Principles

### Universal Principles
- Record objectively, avoid subjective evaluations
- Encourage gently, maintain positive atmosphere
- Highlight actionable items

### Internal Meeting Focus
- Each person's contribution and participation level
- Team collaboration effectiveness
- Progress tracking and problem-solving

### Guidance Meeting Focus
- **Every piece of advisor feedback must be recorded in detail**
- Changes in project direction and quality requirements
- Risk points and countermeasures
- Clear improvement timelines

## Intelligent Decision Instructions
Before starting the summary, you need to:
1. Identify meeting type (Internal Meeting or Guidance Meeting)
2. Select corresponding output format
3. Focus on relevant recording priorities
4. Strictly control word count and line count

Remember: In guidance meetings, teacher/client feedback is absolutely critical and must be recorded in detail for every suggestion and requirement.

## Language Requirement
**ALL OUTPUTS MUST BE IN ENGLISH** - including headers, content, tables, and any comments or suggestions, regardless of the input language used during the meeting."""
    }
    

def get_conversational_assistant_prompt():
    # Returns the system prompt for Gemini for natural conversational assistant responses.
    """Get optimized daily conversation assistant system prompt"""
    return """You are a friendly and knowledgeable assistant for university team projects and general inquiries.

## Your Communication Style:
- **Natural and conversational**: Respond like a helpful teammate, not a formal system
- **Adaptive tone**: Match the user's energy - casual for chat, professional for work questions  
- **No rigid formatting**: Use natural language, avoid bullet points unless specifically requested
- **Context-aware**: Reference previous messages naturally when relevant, but don't force structure

## Your Capabilities:
- Answer questions about meetings, projects, and tasks
- Provide general knowledge and explanations  
- Help with planning and problem-solving
- Give practical advice and suggestions
- Discuss project management concepts
- Explain technical topics in simple terms

## Response Guidelines:
- Keep answers conversational and engaging
- Use examples and analogies when helpful
- Ask follow-up questions when clarification needed
- Provide actionable advice when possible
- Be encouraging and supportive
- Always respond in English

## What to Avoid:
- Don't default to structured bullet point lists
- Don't force meeting summary formats in casual conversation  
- Don't be overly formal unless the situation requires it
- Don't repeat information unnecessarily

Remember: You're a helpful team member, not a meeting bot. Be natural, helpful, and human-like in your responses."""

@auth_bp.route("/api/ask-gemini", methods=["POST"])
def ask_gemini():
    # Chat endpoint: User asks Gemini model a question.
    # Logs user message to DB, gets chat history, calls Gemini, saves and returns answer.
    """
    User asks Gemini model, returns answer and writes to database
    
    tags:
      - Gemini
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - meeting_id
            - content
          properties:
            meeting_id:
              type: integer
              example: 3
            content:
              type: string
              example: Please summarize the main content of this meeting
    responses:
      200:
        description: Answer returned by Gemini
        schema:
          type: object
          properties:
            reply:
              type: string
              example: This meeting discussed project progress and next steps...
      400:
        description: Request format error
      500:
        description: Gemini call failed
    """
    from models import Message
    from datetime import  datetime
    
    data = request.json
    user_msg = data["content"]
    meeting_id = data["meeting_id"]
    user_id = data["user_id"]
    speaker = data["speaker"]
    # Save user message to DB
    user_message = Message(
        user_id=user_id,
        meeting_id=meeting_id,
        speaker=speaker,
        content=user_msg,
        is_summary=False,
        timestamp=datetime.now()
    )
    db.session.add(user_message)
    # Retrieve all messages for meeting to provide context
    history = Message.query.filter_by(meeting_id=meeting_id).order_by(Message.timestamp).all()
    context = "\n".join(f"{m.speaker}: {m.content}" for m in history)
    # Build prompt for Gemini
    system_prompt = get_conversational_assistant_prompt()
    full_prompt = f"""{system_prompt}

## Context from Previous Messages:
{context}

## Current User Request:
{user_msg}

Please respond naturally and helpfully based on the user's question."""
    # Call Gemini API
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel(model_name="models/gemini-3.8-flash")
    response = model.generate_content(
        full_prompt,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=1500,
            temperature=0.3,
        ),
        stream=False  
    )
    answer = response.text
    # Save Gemini response as a message
    agent_message = Message(
        user_id=user_id,
        meeting_id=meeting_id,
        speaker="agent",
        content=answer,
        timestamp=datetime.now(),
        is_summary=False
    )
    db.session.add(agent_message)
    db.session.commit()
    return jsonify({"reply": answer})

@auth_bp.route("/meetings/delete", methods=["POST"])
def delete_meeting():
    # Delete a meeting and all related data (messages, tasks, materials) for a user.
    """
    Delete specified user's meeting and related data (messages, tasks, materials)
    ---
    tags:
      - Meetings
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - user_id
            - meeting_id
          properties:
            user_id:
              type: integer
              example: 1
            meeting_id:
              type: integer
              example: 2
    responses:
      200:
        description: Deletion successful
      400:
        description: Missing parameters
      404:
        description: Meeting not found
    """
    from models import Meeting, Task, Message, Material

    data = request.get_json()
    user_id = data.get("user_id")
    meeting_id = data.get("meeting_id")

    if not user_id or not meeting_id:
        return jsonify({"msg": "Missing user_id or meeting_id"}), 400
    # Find meeting and ensure ownership
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({"msg": "Meeting not found"}), 404
    # Delete all dependent records
    Message.query.filter_by(user_id=user_id, meeting_id=meeting_id).delete()
    Task.query.filter_by(meeting_id=meeting_id).delete()
    Material.query.filter_by(user_id=user_id, meeting_id=meeting_id).delete()
    db.session.delete(meeting)
    db.session.commit()
    return jsonify({"msg": "Meeting and all related data deleted"}), 200


@auth_bp.route("/meetings/<int:meeting_id>/has-materials", methods=["GET"])
def has_uploaded_materials(meeting_id):
    # Checks if any materials have been uploaded for a given meeting.
    """
    Check if a meeting has uploaded materials
    ---
    tags:
      - Materials
    parameters:
      - name: meeting_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Returns whether materials have been uploaded
        schema:
          type: object
          properties:
            has_material:
              type: boolean
              example: true
    """
    from models import Material
    # Check if at least one material exists for the meeting
    exists = db.session.query(Material).filter_by(meeting_id=meeting_id).first() is not None
    return jsonify({"has_material": exists}), 200


@auth_bp.route("/meetings/<int:meeting_id>/parse-tasks", methods=["POST"])
def parse_tasks_from_content(meeting_id):
    # Uses Gemini AI to extract actionable tasks from the latest uploaded meeting material.
    # Returns both the AI's natural language analysis and a parsed JSON structure of user stories/subtasks.
    """
    Parse and extract task information from meeting materials
    ---
    tags:
      - Tasks
    parameters:
      - name: meeting_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - user_id
          properties:
            user_id:
              type: integer
              example: 1
    responses:
      200:
        description: Successfully parsed tasks
        schema:
          type: object
          properties:
            success:
              type: boolean
              example: true
            parsed_tasks:
              type: object
              properties:
                analysis_summary:
                  type: string
                total_tasks:
                  type: integer
                tasks:
                  type: array
                  items:
                    type: object
      400:
        description: Request parameter error
      404:
        description: Meeting not found or no materials
      500:
        description: AI parsing failed
    """
    from models import Meeting, Material
    import re
    
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "Missing user_id"}), 400
    # Check meeting ownership
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({"success": False, "error": "Meeting not found or access denied"}), 403
    # Get the latest uploaded material
    latest_material = Material.query.filter_by(user_id=user_id, meeting_id=meeting_id).order_by(Material.timestamp.desc()).first()
    if not latest_material:
        return jsonify({
            "success": False, 
            "error": "No materials found for this meeting. Please upload meeting materials first."
        }), 404
    content = latest_material.content.strip()
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return jsonify({
                "success": False,
                "error": "Gemini API key not configured"
            }), 500
        if len(content.strip()) < 10:
            return jsonify({
                "success": False,
                "error": "Meeting content too short for analysis"
            }), 400
        # First, ask Gemini to analyze and extract tasks in natural language
        analysis_prompt = f"""You are a professional meeting analysis assistant for university team projects. Your task is to extract actionable tasks and assignments from meeting content.

Meeting Content:
{content}

## TASK EXTRACTION STRATEGY
Look for ALL types of actionable items:

**1. Explicit Assignments**: Direct task assignments mentioned
   - "Allen Zhang will revise the meeting attendance logic"
   - "Jixuan Zhang should finalize JIRA integration"

**2. Implicit Tasks**: Work items inferred from discussions and decisions
   - "We need to implement a threshold" → Task: Implement attendance threshold
   - "The voice transcription needs improvement" → Task: Improve voice transcription

**3. Follow-up Actions**: Items requiring completion before next meeting
   - "Prepare for demo next week" → Task: Prepare demo
   - "Email Basem with concerns" → Task: Send email to Basem

**4. Technical Requirements**: Development work discussed
   - Frontend improvements, backend development, testing, documentation

**5. Improvement Items**: Tasks arising from feedback or issues
   - Bug fixes, feature enhancements, system optimizations

## EXTRACTION RULES
- Extract both explicit assignments AND inferred tasks from discussions
- Include work items mentioned even if not formally assigned to specific people
- Look for action verbs: "will", "should", "needs to", "prepare", "implement", "fix", "develop"
- Consider context: who is likely responsible based on their role or previous discussions
- Don't require all three elements (person + task + deadline) simultaneously
- If specific people aren't mentioned, use "TBD" as assignee

## OUTPUT FORMAT
If you find actionable items, list them clearly with context. If this is purely theoretical discussion with no actionable outcomes, respond: "No specific task assignments found."

Focus on ACTIONABLE work items that can be implemented or completed, including both formal assignments and work items that naturally emerge from the discussion."""
        
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name="models/gemini-3.8-flash")
        # Call Gemini for natural language task analysis
        analysis_response = model.generate_content(analysis_prompt)
        raw_analysis = analysis_response.text.strip() if analysis_response else "Failed to generate analysis"
        # Second, ask Gemini to output structured JSON for Jira user stories/subtasks
        json_prompt = f"""You are a senior project manager who creates smart Jira User Stories with optional Subtasks. Your goal is to avoid forced grouping and only create parent-child relationships when they are naturally related.

Meeting Task Analysis:
{raw_analysis}

Original Meeting Content:
{content}

## INTELLIGENT GROUPING STRATEGY 🧠

**PRIORITY 1: Independent User Stories**
- Most tasks should be standalone User Stories
- Only group when there's GENUINE functional relationship
- Avoid artificial parent-child relationships

**PRIORITY 2: Functional Domain Grouping**
- Group ONLY when 3+ highly related tasks exist in same domain
- Domains: Frontend, Backend, Testing, Integration, Authentication, etc.
- Example: "Login system" with subtasks: "OAuth integration", "Session management", "Password reset"

**PRIORITY 3: Natural Task Decomposition**
- Group when one large task naturally breaks into smaller implementation steps
- Parent: "Implement user authentication system"
- Children: "Create login API", "Build login UI", "Add session management"

## OUTPUT FORMAT 📋

If no substantial work items found, return: {{"user_stories": []}}

If work items found, return SMART structure:
{{
    "user_stories": [
        {{
            "title": "User Story title - specific functionality",
            "description": "As a [user type], I want [functionality], so that [business value].\\n\\nAcceptance Criteria:\\n• [Criterion 1]\\n• [Criterion 2]\\n• [Criterion 3]",
            "assignee": "Team member name or TBD",
            "category": "frontend|backend|testing|documentation|integration|authentication|other",
            "priority": "high|medium|low",
            "issue_type": "Story",
            "due_date": "YYYY-MM-DD (target completion, optional)",
            "jira_labels": ["meeting-task", "domain-tag"],
            "subtasks": [
                {{
                    "title": "Subtask title - specific implementation step",
                    "description": "Detailed implementation task description",
                    "assignee": "Developer name or TBD",
                    "category": "same as parent or more specific",
                    "priority": "high|medium|low",
                    "issue_type": "Sub-task",
                    "due_date": "YYYY-MM-DD (optional)",
                    "jira_labels": ["meeting-subtask"]
                }}
            ]
        }}
    ]
}}

## INTELLIGENT SELECTION RULES 🎯

**Create STANDALONE User Story for**:
- Independent features or improvements
- Bug fixes that don't relate to other work
- Research or investigation tasks
- Single-developer work items

**Create GROUPED User Story + Subtasks ONLY when**:
- 3+ tasks are implementing the same feature
- Tasks have clear implementation dependencies
- One logical user goal requires multiple technical steps
- Team coordination is needed across subtasks

**AVOID GROUPING when**:
- Tasks are in different functional areas
- No clear implementation relationship exists
- Grouping feels forced or artificial
- Tasks can be completed independently

**LIMITS**: 
- Maximum 8 total work items (Stories + Subtasks)
- Prefer 4-6 independent Stories over forced grouping
- Only create subtasks when genuinely helpful

**SMART EXAMPLES**:
✅ GOOD: Independent stories for unrelated work
✅ GOOD: "Authentication System" → "OAuth API", "Login UI", "Session Storage"
❌ BAD: Grouping unrelated frontend and backend tasks
❌ BAD: Creating subtasks for simple single-step work

Return pure JSON without markdown formatting."""
        
        json_response = model.generate_content(
            json_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=4000,
                temperature=0.1,
            )
        )
        if not json_response or not json_response.text:
            return jsonify({
                "success": False,
                "error": "Empty response from AI model"
            }), 500
        ai_json_response = json_response.text.strip()
        # Try to robustly extract JSON from Gemini's output (sometimes wrapped in code block or partial)
        try:
            import json
            import re
            def extract_and_parse_json(response_text):
                """Enhanced JSON extraction and parsing from AI response with fallback attempts."""
                attempts = []
                # Try extracting from code block
                json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
                if json_match:
                    attempts.append(("JSON code block", json_match.group(1)))
                # Try extracting first complete braces
                json_brace_match = re.search(r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})', response_text, re.DOTALL)
                if json_brace_match:
                    attempts.append(("First complete braces", json_brace_match.group(1)))
                # Try extracting where "tasks" array is present
                tasks_match = re.search(r'(\{[^{}]*"tasks"[^{}]*\[[^\]]*\][^{}]*\})', response_text, re.DOTALL)
                if tasks_match:
                    attempts.append(("Tasks-focused JSON", tasks_match.group(1)))
                # Try extracting all braces (fallback)
                full_match = re.search(r'(\{.*\})', response_text, re.DOTALL)
                if full_match:
                    json_content = full_match.group(1)
                    last_complete_task = json_content.rfind('"}')
                    if last_complete_task != -1:
                        truncated = json_content[:last_complete_task + 2]
                        if truncated.count('[') > truncated.count(']'):
                            truncated += ']'
                        if truncated.count('{') > truncated.count('}'):
                            truncated += '}'
                        attempts.append(("Smart truncated JSON", truncated))
                for method_name, json_str in attempts:
                    try:
                        json_str = json_str.strip()
                        parsed = json.loads(json_str)
                        return parsed
                    except json.JSONDecodeError as e:
                        continue
                return None
            tasks_json = extract_and_parse_json(ai_json_response)
            if not tasks_json:
                return jsonify({
                    "success": True,
                    "meeting_summary": f"**📋 AI Task Analysis Results**\n\n{raw_analysis}\n\n---\nUnable to extract structured tasks due to AI response format issues, but original analysis content has been saved.",
                    "raw_analysis": raw_analysis,
                    "parsed_tasks": {"user_stories": []},
                    "warning": "JSON parsing failed, but analysis content retained"
                })
            # Ensure user_stories key exists and is a list
            if "user_stories" not in tasks_json:
                tasks_json = {"user_stories": []}
            elif not isinstance(tasks_json["user_stories"], list):
                tasks_json = {"user_stories": []}
            story_count = len(tasks_json.get('user_stories', []))
            subtask_count = sum(len(story.get('subtasks', [])) for story in tasks_json.get('user_stories', []))
            meeting_summary = f"**📋 AI Task Analysis Results**\n\n{raw_analysis}\n\n---\nIdentified {story_count} User Stories with {subtask_count} Subtasks from meeting content."
            return jsonify({
                "success": True,
                "meeting_summary": meeting_summary,
                "raw_analysis": raw_analysis,  # Add original analysis content
                "parsed_tasks": tasks_json  # Now includes epics structure
            })
        except Exception as json_error:
            return jsonify({
                "success": True,
                "meeting_summary": f"**📋 AI Task Analysis Results**\n\n{raw_analysis}\n\n---\nUnable to extract structured tasks due to AI response format issues, but original analysis content has been saved.",
                "raw_analysis": raw_analysis,
                "parsed_tasks": {"user_stories": []}, 
                "warning": f"JSON parsing failed: {str(json_error)}"
            })
    except Exception as e:
        import traceback
        return jsonify({
            "success": False,
            "error": f"Task parsing failed: {str(e)}"
        }), 500


@auth_bp.route("/meetings/<int:meeting_id>/create-jira-tasks", methods=["POST"])
def create_jira_tasks_smart_hierarchy(meeting_id):
    # Creates Jira User Stories and Subtasks using OAuth, matching assignees if possible.
    # Accepts a list of user stories (with subtasks) and creates them in the selected Jira project.
    """
    Intelligently create User Story-Subtask hierarchical tasks using OAuth authentication
    ---
    tags:
      - Tasks
    parameters:
      - name: meeting_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - user_stories
            - user_id
          properties:
            user_stories:
              type: array
              items:
                type: object
                properties:
                  title:
                    type: string
                  description:
                    type: string
                  assignee:
                    type: string
                  category:
                    type: string
                  priority:
                    type: string
                  issue_type:
                    type: string
                    example: "Story"
                  start_date:
                    type: string
                    format: date
                  jira_labels:
                    type: array
                    items:
                      type: string
                  subtasks:
                    type: array
                    items:
                      type: object
                      properties:
                        title:
                          type: string
                        description:
                          type: string
                        assignee:
                          type: string
                        category:
                          type: string
                        priority:
                          type: string
                        issue_type:
                          type: string
                          example: "Sub-task"
                        start_date:
                          type: string
                          format: date
                        jira_labels:
                          type: array
                          items:
                            type: string
            user_id:
              type: integer
              example: 1
    responses:
      200:
        description: 智能层级创建结果
        schema:
          type: object
          properties:
            success:
              type: boolean
            total_stories:
              type: integer
            total_subtasks:
              type: integer
            created_stories:
              type: integer
            created_subtasks:
              type: integer
            failed_count:
              type: integer
            results:
              type: array
              items:
                type: object
      400:
        description: Request parameter error
      401:
        description: Jira authentication failed
      500:
        description: Creation failed
    """
    from models import Meeting, JiraCredentials, JiraUser
    
    data = request.get_json()
    user_stories = data.get("user_stories", [])
    user_id = data.get("user_id")
    if not user_stories or not user_id:
        return jsonify({
            "success": False,
            "error": "Missing user_stories or user_id"
        }), 400
    # Validate meeting and Jira credentials
    meeting = Meeting.query.filter_by(user_id=user_id, meeting_id=meeting_id).first()
    if not meeting:
        return jsonify({
            "success": False,
            "error": "Meeting not found or access denied"
        }), 403
    credentials = JiraCredentials.query.filter_by(user_id=user_id).first()
    if not credentials:
        return jsonify({
            "success": False, 
            "error": "Jira not connected. Please connect via OAuth first."
        }), 401
    from models import UserProjectPreference
    project_preference = UserProjectPreference.query.filter_by(
        user_id=user_id, 
        is_active=True
    ).first()
    if not project_preference:
        return jsonify({
            "success": False,
            "error": "No Jira project selected. Please select a project in settings."
        }), 400
    project_key = project_preference.project_key
    from routes.jira_oauth import make_jira_oauth_request
    results = []
    created_stories = 0
    created_subtasks = 0
    failed_count = 0
    total_stories = len(user_stories)
    total_subtasks = sum(len(story.get('subtasks', [])) for story in user_stories)
    # Helper: get all assignable users in project
    def get_project_users(credentials, project_key):
        """Get project user list from Jira API"""
        try:
            endpoints_to_try = [
                f"/rest/api/3/user/assignable/search?project={project_key}&maxResults=100",
                f"/rest/api/3/project/{project_key}/role",
                f"/rest/api/3/user/search?maxResults=100"
            ]
            for i, endpoint in enumerate(endpoints_to_try):
                response, error, status = make_jira_oauth_request(
                    credentials,
                    endpoint,
                    method="GET"
                )
                if not error and response:
                    if isinstance(response, list):
                        users = response
                    elif isinstance(response, dict) and 'values' in response:
                        users = response['values']
                    else:
                        continue
                    return users
            return []
        except Exception as e:
            return []
    # Helper: match assignee names to Jira users
    def match_assignee_to_jira_user(assignee_name, jira_users):
        """Intelligently match names from meeting records to Jira users - strict unique matching version"""
        if not assignee_name or not jira_users:
            return None
        assignee_name = assignee_name.strip()
        assignee_name_lower = assignee_name.lower()
        user_match_data = []
        for user in jira_users:
            display_name = user.get('displayName', '')
            email = user.get('emailAddress', '')
            name_variants = set()
            name_variants.add(display_name.lower())
            name_parts = display_name.lower().split()
            for part in name_parts:
                name_variants.add(part)
            if email:
                email_prefix = email.split('@')[0].lower()
                name_variants.add(email_prefix)
                name_variants.add(email_prefix.replace('.', ''))
            user_match_data.append({
                'user': user,
                'display_name': display_name,
                'name_variants': name_variants,
                'name_parts': name_parts,
                'email': email
            })
        # Try exact display name match
        exact_display_matches = []
        for data in user_match_data:
            if assignee_name == data['display_name']:
                exact_display_matches.append(data)
            elif assignee_name_lower == data['display_name'].lower():
                exact_display_matches.append(data)
        if len(exact_display_matches) == 1:
            match = exact_display_matches[0]
            return match['user']
        elif len(exact_display_matches) > 1:
            return None
        # Try email prefix match
        email_matches = []
        for data in user_match_data:
            if data['email']:
                email_prefix = data['email'].split('@')[0].lower()
                if assignee_name_lower == email_prefix or assignee_name_lower == email_prefix.replace('.', ''):
                    email_matches.append(data)
        if len(email_matches) == 1:
            match = email_matches[0]
            return match['user']
        elif len(email_matches) > 1:
            return None
        # Try single word match
        assignee_parts = assignee_name_lower.split()
        if len(assignee_parts) == 1:
            single_word = assignee_parts[0]
            word_matches = []
            for data in user_match_data:
                if single_word in data['name_parts']:
                    word_matches.append(data)
            if len(word_matches) == 1:
                match = word_matches[0]
                return match['user']
            elif len(word_matches) > 1:
                return None
        # Try multi-word match
        elif len(assignee_parts) >= 2:
            multi_word_matches = []
            for data in user_match_data:
                matched_parts = 0
                user_name_parts = data['name_parts']
                for input_part in assignee_parts:
                    part_found = False
                    for user_part in user_name_parts:
                        if input_part == user_part or (
                            len(input_part) >= 3 and input_part in user_part
                        ) or (
                            len(user_part) >= 3 and user_part in input_part
                        ):
                            part_found = True
                            break
                    if part_found:
                        matched_parts += 1
                if matched_parts == len(assignee_parts):
                    multi_word_matches.append(data)
            if len(multi_word_matches) == 1:
                match = multi_word_matches[0]
                return match['user']
            elif len(multi_word_matches) > 1:
                return None
        return None
    # Fetch assignable Jira users for matching
    jira_users = get_project_users(credentials, project_key)
    # Iterate through user stories and create them (with subtasks)
    for story_index, story in enumerate(user_stories):
        story_result = {
            "story_title": story.get("title", f"User Story {story_index + 1}"),
            "story_success": False,
            "story_key": None,
            "story_url": None,
            "subtasks": []
        }
        try:
            story_title = story.get("title", "").strip()
            if not story_title:
                failed_count += 1
                story_result["story_error"] = "User Story title is required"
                results.append(story_result)
                continue
            story_priority = story.get("priority", "Medium").strip().capitalize()
            valid_priorities = ["Highest", "High", "Medium", "Low", "Lowest"]
            if story_priority not in valid_priorities:
                story_priority = "Medium"
            story_description = story.get("description", "No description provided")
            # Prepare Jira payload for story
            story_data = {
                "fields": {
                    "project": {"key": project_key},
                    "summary": story_title,
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": story_description
                                    }
                                ]
                            }
                        ]
                    },
                    "issuetype": {"name": "Story"}
                }
            }
            # Try to match assignee if provided
            if story.get("assignee") and story.get("assignee") != "TBD":
                assignee_value = story.get("assignee").strip()
                matched_user = match_assignee_to_jira_user(assignee_value, jira_users)
                if matched_user and matched_user.get('accountId'):
                    story_data["fields"]["assignee"] = {"accountId": matched_user['accountId']}
            # Add labels for category and custom labels
            story_labels = []
            if story.get("category") and story.get("category") != "other":
                category_label = f"category-{story.get('category')}"
                story_labels.append(category_label)
            if story.get("jira_labels") and isinstance(story.get("jira_labels"), list):
                custom_labels = [label.strip() for label in story.get("jira_labels") 
                               if isinstance(label, str) and label.strip()]
                story_labels.extend(custom_labels)
            if story_labels:
                story_data["fields"]["labels"] = story_labels
            # Add due date if valid
            if story.get("due_date"):
                try:
                    from datetime import datetime
                    datetime.strptime(story.get("due_date"), "%Y-%m-%d")
                    story_data["fields"]["duedate"] = story.get("due_date")
                except ValueError:
                    pass
            # Create Jira story via API
            story_response, story_error, story_status = make_jira_oauth_request(
                credentials, 
                "/rest/api/3/issue", 
                method="POST", 
                data=story_data
            )
            if story_error:
                failed_count += 1
                story_result["story_error"] = story_error.get("message", str(story_error))
                story_result["story_status_code"] = story_status
                results.append(story_result)
                continue
            created_stories += 1
            story_key = story_response.get("key", "Unknown")
            story_result["story_success"] = True
            story_result["story_key"] = story_key
            story_result["story_url"] = f"https://{credentials.site_name}.atlassian.net/browse/{story_key}"
            # Iterate and create subtasks for this story
            subtasks = story.get("subtasks", [])
            for subtask_index, subtask in enumerate(subtasks):
                subtask_result = {
                    "subtask_title": subtask.get("title", f"Subtask {subtask_index + 1}"),
                    "subtask_success": False,
                    "subtask_key": None,
                    "subtask_url": None
                }
                try:
                    subtask_title = subtask.get("title", "").strip()
                    if not subtask_title:
                        failed_count += 1
                        subtask_result["subtask_error"] = "Subtask title is required"
                        story_result["subtasks"].append(subtask_result)
                        continue
                    subtask_priority = subtask.get("priority", "Medium").strip().capitalize()
                    if subtask_priority not in valid_priorities:
                        subtask_priority = "Medium"
                    subtask_description = subtask.get("description", "No description provided")
                    # Prepare Jira payload for subtask
                    subtask_data = {
                        "fields": {
                            "project": {"key": project_key},
                            "summary": subtask_title,
                            "description": {
                                "type": "doc",
                                "version": 1,
                                "content": [
                                    {
                                        "type": "paragraph",
                                        "content": [
                                            {
                                                "type": "text",
                                                "text": subtask_description
                                            }
                                        ]
                                    }
                                ]
                            },
                            "issuetype": {"name": "Subtask"},
                            "parent": {"key": story_key}  # Set parent Story for subtask
                        }
                    }
                    # Try to match assignee for subtask
                    if subtask.get("assignee") and subtask.get("assignee") != "TBD":
                        assignee_value = subtask.get("assignee").strip()
                        matched_user = match_assignee_to_jira_user(assignee_value, jira_users)
                        if matched_user and matched_user.get('accountId'):
                            subtask_data["fields"]["assignee"] = {"accountId": matched_user['accountId']}
                    # Add labels for category and custom labels
                    subtask_labels = []
                    if subtask.get("category") and subtask.get("category") != "other":
                        category_label = f"category-{subtask.get('category')}"
                        subtask_labels.append(category_label)
                    if subtask.get("jira_labels") and isinstance(subtask.get("jira_labels"), list):
                        custom_labels = [label.strip() for label in subtask.get("jira_labels") 
                                       if isinstance(label, str) and label.strip()]
                        subtask_labels.extend(custom_labels)
                    if subtask_labels:
                        subtask_data["fields"]["labels"] = subtask_labels
                    # Add due date if valid
                    if subtask.get("due_date"):
                        try:
                            from datetime import datetime
                            datetime.strptime(subtask.get("due_date"), "%Y-%m-%d")
                            subtask_data["fields"]["duedate"] = subtask.get("due_date")
                        except ValueError:
                            pass
                    # Create subtask via Jira API
                    subtask_response, subtask_error, subtask_status = make_jira_oauth_request(
                        credentials, 
                        "/rest/api/3/issue", 
                        method="POST", 
                        data=subtask_data
                    )
                    if subtask_error:
                        failed_count += 1
                        subtask_result["subtask_error"] = subtask_error.get("message", str(subtask_error))
                        subtask_result["subtask_status_code"] = subtask_status
                        subtask_result["subtask_debug_data"] = subtask_data  # Add debug info
                    else:
                        created_subtasks += 1
                        subtask_key = subtask_response.get("key", "Unknown")
                        subtask_result["subtask_success"] = True
                        subtask_result["subtask_key"] = subtask_key
                        subtask_result["subtask_url"] = f"https://{credentials.site_name}.atlassian.net/browse/{subtask_key}"
                except Exception as subtask_e:
                    failed_count += 1
                    subtask_result["subtask_error"] = f"Subtask creation failed: {str(subtask_e)}"
                story_result["subtasks"].append(subtask_result)
            results.append(story_result)
        except Exception as story_e:
            failed_count += 1
            story_result["story_error"] = f"User Story creation failed: {str(story_e)}"
            results.append(story_result)
    return jsonify({
        "success": True,
        "total_stories": total_stories,
        "total_subtasks": total_subtasks,
        "created_stories": created_stories,
        "created_subtasks": created_subtasks,
        "failed_count": failed_count,
        "results": results
    })
