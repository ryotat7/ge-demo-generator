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

## Step 1: Provision Demo Environment

First, we need to provision the BigQuery dataset and set up the agent code. 

1. Go back to the **ADK Agent Demo Generator** Web UI.
2. Under **Step 2: Deployment & Live Demo**, click the **Copy** button next to the **Setup Script**.
3. Paste the command into the Cloud Shell terminal and press **Enter**.

> [!TIP]
> This script will create a directory named `my-ge-demo-[TIMESTAMP]`.

<walkthrough-test-code-block>
# Paste your setup command here
</walkthrough-test-code-block>

---

## Step 2: Launch the Agent

Now let's start the ADK web server to interact with your agent.

### 📂 1. Navigate to the agent directory
Run this command to automatically enter the generated demo folder:

<walkthrough-test-code-block>
# This command automatically finds and enters the latest demo directory
cd $(ls -d my-ge-demo-*/ | head -n 1)examples/launchmybakery/adk_agent
</walkthrough-test-code-block>

### 🚀 2. Start the ADK Server
Launch the agent using the local virtual environment:

<walkthrough-test-code-block>
../.venv/bin/adk web
</walkthrough-test-code-block>

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

### Need Help?
Contact [ryotat@google.com](mailto:ryotat@google.com) or refer to the [LaunchMyBakery](https://github.com/google/mcp/tree/main/examples/launchmybakery) documentation.
