# AI Collaboration Platform for Group Projects

A UNSW capstone project designed to support group collaboration through meeting management, Jira integration, AI-assisted summaries and action items, task tracking, voice transcription, and team contribution features.

> **Project status:** This project was originally developed in 2025 as a university team project. Some third-party integrations, including Jira OAuth, Gemini, AssemblyAI, and the hosted database, require new credentials or configuration to run today. This repository is maintained as a portfolio project to demonstrate the system architecture, backend development, API integration, database design, testing, and AI integration.

---

## Features

- **User Authentication** — JWT-based authentication for user login and protected backend routes.
- **Meeting Management** — Create, list and delete meetings through the application.
- **Transcript Upload and AI Summary** — Upload meeting transcripts and generate summaries, key points and action items using Gemini.
- **Voice Meeting Support** — Process recorded meeting audio using AssemblyAI diarization and support speaker identification / renaming.
- **Jira Integration** — Connect Jira through OAuth, retrieve project information, synchronise issues and create tasks from the application.
- **AI Chat Assistant** — Conversational interface powered by Gemini to help users work with project and meeting information.
- **Task and Reminder Tracking** — Track project tasks, action items and reminders.
- **Contribution Dashboard** — Provide visibility into team participation and contribution data.
- **REST API Backend** — Flask-based backend exposing application functionality to the frontend.
- **Automated Testing** — Unit, integration and end-to-end testing support.

---

## Architecture

```text
                         +----------------------+
                         |      React Frontend  |
                         |    User Interface    |
                         +----------+-----------+
                                    |
                                    | REST API
                                    v
                         +----------------------+
                         |     Flask Backend    |
                         |  Auth / Meetings /   |
                         |  Jira / AI / Tasks   |
                         +----+-----------+-----+
                              |           |
                  +-----------+           +----------------+
                  |                                        |
                  v                                        v
        +----------------------+                  +----------------------+
        | PostgreSQL /         |                  | External Services    |
        | SQLAlchemy           |                  |                      |
        | Users / Meetings /   |                  | Jira OAuth + API     |
        | Tasks / App Data     |                  | Gemini API           |
        +----------------------+                  | AssemblyAI API       |
                                                  +----------------------+

Additional real-time processing components can use Redis / Redis Streams where required by the application workflow.
```

### High-level data flow

1. The React frontend sends requests to the Flask backend through REST APIs.
2. The Flask backend handles authentication, business logic and application workflows.
3. Application data is stored in PostgreSQL through SQLAlchemy.
4. Jira integration uses OAuth and Jira REST APIs for project and task synchronisation.
5. Gemini processes meeting content and other project information for summaries, action items and conversational assistance.
6. AssemblyAI is used for audio transcription and speaker diarization in voice meeting workflows.

---

## Technology Stack

### Backend
- Python
- Flask
- REST APIs
- SQLAlchemy
- JWT authentication

### Frontend
- React
- JavaScript
- Yarn

### Data and Messaging
- PostgreSQL
- Redis
- Redis Streams

### Integrations and AI
- Jira OAuth 2.0
- Jira REST APIs
- Gemini API
- AssemblyAI

### Development and Testing
- Docker / Docker Compose
- Git
- Unit testing
- Integration testing
- End-to-end testing
- Swagger / API documentation

---

## My Contribution

This was a team capstone project. My primary contribution focused on:

- Leading the team as Scrum Master and coordinating delivery across the project.
- Backend development using Python and Flask.
- Jira authentication and integration workflows.
- AI / LLM integration, particularly Gemini-based meeting summaries, key points and action items.
- Backend API and database integration.
- Supporting system integration, debugging and project delivery across frontend, backend and external services.

---

## Prerequisites

- Git
- Docker Desktop installed and running
- For local development: Python 3.11+, Node.js 20+, Yarn

---

## 1. Clone the Repository

```bash
git clone git@github.com:yulinghao0112/CapstoneProject_Linghao.git
cd CapstoneProject_Linghao/P25
```

---

## 2. Environment Configuration

The repository does **not** include active API keys, passwords, tokens or production credentials.

Create a local `.env` file under:

```text
P25/backend/.env
```

Use the provided example file as a template:

```bash
cd P25/backend
cp .env_example .env
```

Replace the placeholder values with your own local credentials.

**Never commit `.env`, API keys, passwords or tokens to GitHub.**

Some external integrations may require configuration updates because third-party APIs and OAuth settings can change over time.

Example environment variables include:

```env
DATABASE_URL=your_database_url_here
JWT_SECRET_KEY=your_jwt_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

JIRA_OAUTH_CLIENT_ID=your_jira_oauth_client_id_here
JIRA_OAUTH_CLIENT_SECRET=your_jira_oauth_client_secret_here
JIRA_OAUTH_SUCCESS_REDIRECT=http://localhost:3000/jira
OAUTH_STATE_EXPIRY_MINUTES=60

FLASK_SECRET_KEY=your_flask_secret_key_here

JIRA_SITE_NAME=your_jira_site_name_here
JIRA_PROJECT_KEY=your_jira_project_key_here
JIRA_USERNAME=your_jira_username_here
JIRA_API_TOKEN=your_jira_api_token_here
```

AssemblyAI credentials should also be configured locally using the project's current configuration mechanism. Do not hard-code the key in source files.

---

## 3. Run with Docker

Docker is the recommended way to run the project.

### Step 1: Prepare the frontend

```bash
cd CapstoneProject_Linghao/P25/admin
nvm use 20
```

Install `cross-env` if required:

```bash
yarn add -D cross-env
```

### Step 2: Start the application

From:

```text
CapstoneProject_Linghao/P25
```

run:

```bash
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
```

### Access

Frontend:

```text
http://localhost:3000
```

Backend API documentation:

```text
http://localhost:3001/apidocs
```

### Stop

```bash
docker compose -f docker-compose.dev.yml down
```

---

## 4. Run Locally Without Docker

### Backend

Navigate to the backend directory:

```bash
cd CapstoneProject_Linghao/P25/backend
```

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

Start the backend:

```bash
python3 app.py
```

The backend runs at:

```text
http://localhost:5002
```

### Frontend

Open a new terminal:

```bash
cd CapstoneProject_Linghao/P25/admin
yarn install
yarn start
```

The frontend runs at:

```text
http://localhost:3000
```

---

## 5. Testing

From:

```text
CapstoneProject_Linghao/P25
```

make sure the application is running:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Create a Python environment if required:

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Unit and Integration Tests

```bash
python3 run_comprehensive_tests.py
```

### End-to-End Tests

```bash
python3 run_e2e_tests.py
```

For more detailed testing information, see:

```text
P25/README_TESTS.md
```

---

## 6. Third-Party Service Setup

### Jira OAuth

To enable Jira integration:

1. Go to the Atlassian Developer Console.
2. Create a new OAuth 2.0 application.
3. Configure the required Jira scopes.
4. Configure the callback / redirect URL.
5. Add the client ID and client secret to your local `.env` file.

The original development credentials are no longer included in this repository.

### Gemini

Create your own Gemini API key through Google AI Studio and add it to your local `.env` file.

### AssemblyAI

Create your own AssemblyAI API key and configure it locally. Do not commit the key to the repository.

### PostgreSQL / Neon

Create your own PostgreSQL database or Neon project and add the connection string to:

```env
DATABASE_URL=your_database_url_here
```

---

## Known Limitations

- Third-party credentials from the original 2025 development environment are no longer included or maintained.
- Jira field configuration can vary between Jira workspaces and may require adjustment.
- Speaker diarization accuracy depends on audio quality and speaker overlap.
- AI-generated summaries can introduce latency and should be reviewed by users.
- Some external API or OAuth configuration may need to be updated to match current provider requirements.

---

## Portfolio Context

This repository is a cleaned portfolio version of a university team project. It is intended to demonstrate practical experience with backend development, APIs, databases, AI integration, authentication, external service integration, testing and collaborative software delivery.
