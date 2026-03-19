# GE Demo Generator

Dynamically generate portable, high-fidelity AI agent demos using **BigQuery** and **Google Maps** MCP (Model Context Protocol) servers.

## 🚀 Overview

The **GE Demo Generator** is an accelerator for building Vertex AI Agent demos. It uses Gemini to:
1.  **Synthesize Scenarios**: Understands a business challenge (e.g., "logistics delay analysis") and plans a data strategy.
2.  **Generate Synthetic Data**: Creates multiple BigQuery tables with realistic data and relational integrity.
3.  **Produce Setup Scripts**: Generates a single bash script that provisions the entire environment (Data + Agent Code + Deployment) in your own Google Cloud projects.
4.  **Visualize Architecture**: Auto-generates ER diagrams and architecture maps.

## 🛠️ Prerequisites

*   **Google Cloud Project**: With Billing enabled.
*   **Google Apps Script**: To host the Generator Web UI.
*   **Vertex AI**: Enabled in your project.
*   **Cloud Shell**: Used for running the generated setup scripts.

## 📖 Setup Guide

### 1. Host the Generator
1.  Create a new **Google Apps Script** project.
2.  Copy `Code.gs` and `index.html` into the editor.
3.  Update `appsscript.json` (Manifest) with the provided file.
4.  Enable the **BigQuery API** in the Apps Script editor (Services > Add > BigQuery).

### 2. Configure Your Project
1.  In the Apps Script editor, run the `initializeProject("YOUR-PROJECT-ID")` function.
2.  Deploy the script as a **Web App** (Deploy > New Deployment > Web App).
3.  Access the provided URL.

### 3. Generate a Demo
1.  Enter a business challenge in the Web UI.
2.  Click **Generate Demo Architecture**.
3.  Copy the generated **Setup Script** command.
4.  Paste it into your **Google Cloud Shell** and follow the prompts.

## 🧼 Cleanup

Every generated demo includes a cleanup command. To remove all provisioned data and local files for a specific demo, run:
```bash
bash setup-demo-xxx.sh --cleanup
```

## 🔒 Security & Privacy

*   This tool generates **synthetic data**. Do not use sensitive or PII data in the generator prompt.
*   History is stored locally in your Google account's **UserProperties**.
*   No external databases (Sheets, Drive, or Global logs) are used in this version.

---
**License**: MIT  
**Contributions**: Open source contributions are welcome via Pull Requests.
