# BigQuery MCP Agent Demo: Guided Walkthrough

Welcome! This tutorial will guide you through the setup and execution of your synthesized BigQuery MCP Agent demo.

## Prerequisites

Before we begin, ensure you have the necessary APIs enabled and the correct project selected.

<walkthrough-project-setup>
</walkthrough-project-setup>

### 🛠️ Set Your Project
Ensure your Cloud Shell is targeting the correct project:

<walkthrough-test-code-block>
gcloud config set project {{project-id}}
</walkthrough-test-code-block>

---

## Step 1: Provision Demo Environment in Your Project

The Demo Generator has synthesized a custom setup script for you. This script is responsible for provisioning the BigQuery dataset and setting up the agent code within YOUR GCP environment.

1. Go back to the **ADK Agent Demo Generator** Web UI.
2. Under **Step 3: Deploy**, click the **Copy** button next to the **Setup Script**.
3. **Paste the command** into the Cloud Shell terminal window (at the bottom of your screen) and press **Enter**.

> [!IMPORTANT]
> This app does not provision resources directly. Running this script is the required step to create the demo environment in your own project.

> **Note:** This script will create a directory named `my-ge-demo-[TIMESTAMP]`.

```bash
# Paste your setup command here in the terminal window below
```

---

## Step 2: Launch the Agent

Once the setup script from Step 1 finishes, it will display the exact command to launch your agent. **Please follow the instructions shown in your terminal.**

### � Reference: How to launch manually

If you need to restart the agent or navigate manually, use these commands:

#### 1. Enter the Agent Directory
You must be in the `adk_agent` folder inside your new demo directory. Replace `[YOUR_DEMO_DIR]` with the folder name created in Step 1 (e.g., `my-ge-demo-831afa90`).

```bash
# General pattern:
cd [YOUR_DEMO_DIR]/examples/launchmybakery/adk_agent

# Tip: You can use this to find and enter the latest demo folder automatically:
cd $(ls -d my-ge-demo-*/ | head -n 1)examples/launchmybakery/adk_agent
```

#### 2. Start the Server
Run the agent using the virtual environment installed by the script:

```bash
../.venv/bin/adk web
```

---

## Step 3: Access the UI & Preview

Once you see `Uvicorn running on http://127.0.0.1:8000`:

1. Click the **Web Preview** button at the top right of the Cloud Shell window.
2. Select **Preview on port 8000**.
3. In the new tab, select the **mcp_app** and start a new session.

---

## Step 4: Try the Scenarios

Use the **Step 2: Recommended Demo Flow** section in your Demo Generator for tailored prompts.

**Example Prompts:**
- "Analyze sales trends using the BigQuery tool."
- "Correlate demographic data with real-world locations via Google Maps."
- "Predict future demand based on historical data."

---

## Step 5: (Optional) Go Production

Ready to take your demo further? Deploy it to **Vertex AI Agent Engine** and register it as an official agent within **Gemini Enterprise**.

### 1. Enhance Your Project
Run this in the your agent root directory (`adk_agent`):

```bash
uvx agent-starter-pack enhance
```

**Expected Interaction (Accept all defaults):**
> Continue with enhancement? [Y/n]: **Y**  
> Select base template (1): **[Enter]**  
> Select agent directory (1): **[Enter]**  
> select a deployment target: **1 (agent_engine)**  
> select a CI/CD runner: **1 (simple)**  

### 2. Deploy to Engine
```bash
make deploy
```

### 3. Register to Gemini Enterprise
```bash
make register-gemini-enterprise
```

---

### Need Help?
Contact [ryotat@google.com](mailto:ryotat@google.com) or refer to the [LaunchMyBakery](https://github.com/google/mcp/tree/main/examples/launchmybakery) documentation.
