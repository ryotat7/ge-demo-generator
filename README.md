# ADK Agent Demo Generator

A Google Apps Script-based tool for rapidly generating hyper-personalized AI agent demos. It synthesizes realistic business datasets and agent configurations on top of the [LaunchMyBakery](https://github.com/google/mcp/tree/main/examples/launchmybakery) demo application.

## Overview

This tool helps you:
- **Generate synthetic datasets** tailored to any business scenario
- **Auto-discover BigQuery public datasets** using Google Search grounding
- **Create ready-to-run setup scripts** for Google Cloud Shell
- **Configure AI agents** with custom system instructions and demo guides

## Features

### 🎯 Smart Data Synthesis
- Generates 1-3 relational tables with 15-50 rows each
- Ensures relational integrity (consistent primary/foreign keys)
- Supports multi-table JOINs for complex data analysis demos

### 🔍 Dynamic Public Dataset Discovery
Uses Gemini's Google Search grounding to find real BigQuery public datasets, then verifies table existence via BigQuery API.

### 🚀 One-Click Cloud Shell Deployment
Generates a complete `setup.sh` script that:
- Creates BigQuery datasets and tables
- Configures ADK agent with MCP servers (BigQuery + Google Maps)
- Launches the agent UI automatically

## Project Structure

```
ge-demo-generator/
├── Code.gs           # Backend logic (Apps Script)
├── index.html        # Frontend UI
├── appsscript.json   # Apps Script manifest
└── tutorial.md       # Cloud Shell tutorial
```

## Setup

1. Create a new Google Apps Script project
2. Copy `Code.gs` and `index.html` into the project
3. Enable the **BigQuery** Advanced Service:
   - Go to **Services > + Add a service > BigQuery**
4. Deploy as a **Web App**

## Configuration

Update `CONFIG` in `Code.gs` with your settings:

```javascript
const CONFIG = {
  PROJECT_ID: 'your-project-id',
  LOCATION: 'us-central1',
  MODEL: 'gemini-2.0-flash-001',
  // ...
};
```

## Usage

1. Open the deployed Web App
2. Enter a business scenario (e.g., "Retail optimization for Tokyo stores")
3. Click **Generate Setup Script & Assets**
4. Copy the generated script to Google Cloud Shell
5. Run the script to deploy your personalized demo

## Advanced Settings

- **Synthesis Volume**: Rows per table (15/25/50)
- **Dataset Complexity**: Number of tables (1/2/3)
- **Public Dataset Override**: Manually specify a BigQuery public dataset

## License

Apache 2.0

## Related Projects

- [LaunchMyBakery](https://github.com/google/mcp/tree/main/examples/launchmybakery) - The base demo application
- [ADK (Agent Development Kit)](https://github.com/google/adk-python) - Python framework for building AI agents
