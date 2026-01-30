# BigQuery MCP Agent Demo: Guided Walkthrough

Welcome! This tutorial will guide you through the setup and execution of your synthesized BigQuery MCP Agent demo.

## Prerequisites

Before we begin, ensure you have the necessary APIs enabled in your Google Cloud project.

<walkthrough-project-setup>
</walkthrough-project-setup>

## Step 1: Provision Demo Environment

First, we need to provision the BigQuery dataset and set up the agent code. 

1. Go back to the **ADK Agent Demo Generator** Web UI.
2. Under **Step 1: Execute in Google Cloud Shell**, click the **Copy** button next to the **Setup Script**.
3. Paste the command into the Cloud Shell terminal below and press **Enter**.

<walkthrough-test-code-block>
# Paste your setup command here
</walkthrough-test-code-block>

## Step 2: Authentication

The agent requires Application Default Credentials (ADC) to access Vertex AI and BigQuery on your behalf.

Run the following command and follow the browser-based login flow:

<walkthrough-test-code-block>
gcloud auth application-default login
</walkthrough-test-code-block>

## Step 3: Launch the Agent

Now that the environment is provisioned and authenticated, let's start the ADK web server.

1. Navigate to the agent directory:
   <walkthrough-test-code-block>
   # Note: Replace [DIR_NAME] if you renamed your demo, usually it's my-ge-demo-XXXX
   cd my-ge-demo-*/examples/launchmybakery/adk_agent
   </walkthrough-test-code-block>

2. Start the server (ensure you use the local virtual environment):
   <walkthrough-test-code-block>
   ../.venv/bin/adk web
   </walkthrough-test-code-block>

## Step 4: Access the UI

Once the server is running (you'll see `Uvicorn running on http://127.0.0.1:8000`):

1. Click the **Web Preview** button at the top right of the Cloud Shell window.
2. Select **Preview on port 8000**.
3. In the ADK Web UI, select the **mcp_app** and start a new session.

## Step 5: Try the Scenarios

Now you can test the reasoning capabilities of the agent. Refer to the **Step 2: Recommended Demo Flow** section in your Web UI for tailored prompts.

Example questions:
- "Can you list the tables available in my dataset?"
- "Analyze the impact of weather/traffic on my business operations using the integrated toolsets."
- "Combine BigQuery insights with Maps data to solve the current problem."

---

### Need Help?
Contact the developer at [ryotat@google.com](mailto:ryotat@google.com) or refer to the [LaunchMyBakery](https://github.com/google/mcp/tree/main/examples/launchmybakery) official documentation.
