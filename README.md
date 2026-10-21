# P25 Application - Setup Guide

## Prerequisites
- Git installed (to clone this repository)
- **Docker**: [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- **Local**: Python 3.11+, Node.js 20+, Yarn

---

## 1. Clone the Repository or Unzip Final-9900.zip

### Method 1: Clone from GitHub
```bash
git clone git@github.com:unsw-cse-comp99-3900/capstone-project-9900-w14a-almond.git
```
```bash
cd capstone-project-9900-w14a-almond/P25
```

### Method 2: Unzip from Final-9900.zip
Unzip the `Final-9900.zip` file to your desired location, then:
```bash
cd capstone-project-9900-w14a-almond/P25
```

---

## 2. Start the Application with Docker or in Local Environment

### Method 1: Run with Docker (Recommended)

#### Step 1. Install cross-env under Frontend Folder 'admin'
Please navigate to `./capstone-project-9900-w14a-almond/P25/admin`
```bash
#./capstone-project-9900-w14a-almond/P25/
cd admin
# Make sure you have Node.js 20+
# For Example, you can run: nvm use 20 
```
Under `./capstone-project-9900-w14a-almond/P25/admin`
```bash
#./capstone-project-9900-w14a-almond/P25/admin
yarn add -D cross-env 
```
#### Step 2. Create .env File
Now, please create a `.env` file under the directory `./capstone-project-9900-w14a-almond/P25/backend`. You can use the provided `.env_example` file as a template:

```bash
cd ..
# Navigate to backend directory
cd backend
# Copy the example file and rename it
cp .env_example .env
```

Then edit the `.env` file with your actual API keys and configuration values. See the [API Key Instruction](#5-api-key-instruction) section below for details on how to obtain these credentials. 
#### Step 3. Run in Container
***Start***: 


Now navigate to `./capstone-project-9900-w14a-almond/P25`, proceed with the following commands: 
```bash
#./capstone-project-9900-w14a-almond/P25/admin
cd ..
#./capstone-project-9900-w14a-almond/P25
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
```
***Access***:
#### Our application will run on: <http://localhost:3000>
- Backend API: 
  - API docs: <http://localhost:3001/apidocs>
  
***Stop***:
```bash
docker compose -f docker-compose.dev.yml down
```

---

### Method 2: Run Locally (No Docker)

### Backend
Navigate to backend directory `./capstone-project-9900-w14a-almond/P25/backend`:
```bash
cd backend
```
Install required backend environments:
```bash
#./capstone-project-9900-w14a-almond/P25/backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```
Start backend:
```bash
# Start backend
python3 app.py
```
Backend will run at <http://localhost:5002>.

### Frontend (Admin)
Open a new terminal, navigate to frontend directory `./capstone-project-9900-w14a-almond/P25/admin`:
```bash
cd ../admin
```
Install frontend environments:
```bash
#./capstone-project-9900-w14a-almond/P25/admin
yarn install
```
Start frontend:
```bash
# Start frontend
yarn start
```
#### Our application will run at <http://localhost:3000>.  

---

## 3. Demo Account
- Email: `demo@gmail.com`
- Password: `Demo123123`

---

## 4. Testing
Please navigate to `/capstone-project-9900-w14a-almond/P25`, then enter the following commands for testing:
- Make sure you have both backend and frontend up and running, navigate to `/capstone-project-9900-w14a-almond/P25`:
```bash
docker compose -f docker-compose.dev.yml up -d
```
- Install requirements under `/capstone-project-9900-w14a-almond/P25`:
```bash
python3 -m venv venv
source venv/bin/activate   # macOS/Linux
# Windows: venv\Scripts\activate
```
```bash
pip install --upgrade pip
pip install -r requirements.txt
```
## Under `/capstone-project-9900-w14a-almond/P25`
### For automated unit and integration testing:
- Run test command:
```bash
python3 run_comprehensive_tests.py 
```

### For automated end-to-end testing:
- Run test command:
```bash
python3 run_e2e_tests.py
```
For full testing manual, please navigate to `/capstone-project-9900-w14a-almond/P25/`, refer to:
```bash
README_TESTS.md
```

---


## 5. API Key Instruction
Note: All API Keys are set to be valid for the next 3 months, after this period, all API keys will be expired. 
You can replace the following API keys with your own API keys.

**Important**: Remember to copy `.env_example` to `.env` first, then follow the instructions below to configure your environment variables.

### Secret Keys Configuration
- Navigate to `/capstone-project-9900-w14a-almond/P25/backend/.env`

The following secret keys are used for security purposes in the application:

- **FLASK_SECRET_KEY**: Used by Flask for session management, CSRF protection, and other security features. This should be a random, secure string. You can generate your own or keep the default for development.

- **JWT_SECRET_KEY**: Used for signing and verifying JSON Web Tokens (JWT) for user authentication. This should be a strong, random secret key. You can generate your own or keep the default for development.

### JIRA OAuth Configuration
- Navigate to `/capstone-project-9900-w14a-almond/P25/backend/.env`

For JIRA integration, you need to set up OAuth credentials:

- **JIRA_OAUTH_CLIENT_ID**: The client ID for your JIRA OAuth app
- **JIRA_OAUTH_CLIENT_SECRET**: The client secret for your JIRA OAuth app  
- **JIRA_OAUTH_SUCCESS_REDIRECT**: The redirect URL after successful OAuth authentication

To obtain these credentials:
1. Go to https://developer.atlassian.com/console/myapps/
2. Create a new app or select an existing one
3. Navigate to OAuth 2.0 (3LO) settings
4. Add appropriate scopes (recommended: `read:jira-user`, `read:jira-work`, `write:jira-work`)
5. Set your callback URL (should match JIRA_OAUTH_SUCCESS_REDIRECT)
6. Copy the Client ID and Client Secret to your .env file

Note: Ensure your OAuth app has the necessary permissions and scopes for the JIRA features you plan to use. 
### Assembly API Key
- Navigate to `/capstone-project-9900-w14a-almond/P25/backend/routes/audio_helpers.py`
```bash
ASSEMBLYAI_API_KEY
```
Here’s how you can generate an `ASSEMBLYAI_API_KEY`:

1. Sign Up or Log In
	Go to https://www.assemblyai.com/
	1. Click Sign Up to create a new account, or
 	2. Click Log In if you already have one.
	You can use an email/password, Google account, or GitHub account.

2. Access Your API Dashboard
	Once logged in, you’ll be redirected to your Dashboard:
	https://www.assemblyai.com/app/dashboard

3. Copy Your API Key
On the dashboard:
	1. Locate the “API Key” section (usually at the top right or in the main panel).
	2. Click Copy to copy your API key to your clipboard.
	3. Keep it private and secure — do not share it publicly or commit it to GitHub.

 
### GEMINI API Key
- Navigate to `/capstone-project-9900-w14a-almond/P25/backend/.env`
```bash
GEMINI_API_KEY
```
Here’s how you can generate a `GEMINI_API_KEY`:
1. Sign in to Google AI Studio
	1. Go to https://aistudio.google.com/
	2. Sign in with your Google account.

2. Create or Select a Project
	1. If you don’t have a project yet, click “Create new project”.
	2. If you already have one, select your existing project.

3. Generate an API Key
	1.	In AI Studio’s left navigation panel, click “Get API key” or “API Keys”.
	2.	Click “Create API key”.
	3.	Select the project you want to link.
	4.	Your API key will be displayed — copy and save it somewhere secure (never upload it to GitHub or share it publicly).

4. Enable the Gemini API (if not enabled yet)
	1. Go to Google Cloud Console
	2. Select your project
	3. Navigate to API & Services → Library


### NEON DATABASE_URL
- Navigate to `/capstone-project-9900-w14a-almond/P25/backend/.env`
```bash
DATABASE_URL
```
Here’s how you can generate a `DATABASE_URL` for Neon Database:
1. Sign up / log in to Neon
	1.  Go to https://neon.tech
	2.	Sign up with GitHub, Google, or email.
	3.	Log in to access the Neon Console.

2. Create a new project
	1.	Click New Project.
	2.	Choose:
		•	Project name (optional).
		•	Region (pick the closest to your server or users).
		•	Branch (leave default as main unless you need branching).
	3.	Click Create Project.


3. Get your connection string (Database URL)
	1.	In your project dashboard, go to the Connection Details tab.
	2.	Choose “psql” or “Connection string” view.
	3.	You’ll see something like:
		`postgresql://<username>:<password>@<hostname>/<dbname>`
	4.	Copy the whole URL.

 
