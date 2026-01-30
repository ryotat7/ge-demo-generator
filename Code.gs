/**
 * GAS BigQuery MCP Demo Generator - Backend
 * 
 * Dynamically generates a portable AI agent demo environment 
 * using BigQuery and Maps MCP servers.
 */

// ===========================================
// Configuration
// ===========================================
const CONFIG = {
  PROJECT_ID: 'cloud-llm-preview1', // Default reference
  LOCATION: 'global',
  MODEL: 'gemini-3-flash-preview',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  HISTORY_KEY: 'demo_history',
  MAX_HISTORY: 10
};

// ===========================================
// Web App Entry Point
// ===========================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('BigQuery MCP Demo Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===========================================
// Main Processing
// ===========================================

/**
 * Main function to generate the demo artifacts
 * @param {string} userGoal - User's business problem
 * @param {Object} options - Customization options
 * @returns {Object} Generation result
 */
function generateDemo(userGoal, options = {}) {
  const defaultOptions = {
    rowCount: 100,
    tableCount: 3,
    publicDatasetId: null
  };
  options = { ...defaultOptions, ...options };
  
  const result = {
    success: false,
    steps: [],
    error: null,
    datasetId: null,
    tableInfo: [],
    dataPreview: [],
    systemInstruction: null,
    setupScript: null,
    rawTables: [] // Added to return raw data to the UI
  };
  
  try {
    // Step 1: Planning and Data Generation
    result.steps.push({ step: 1, status: 'running', message: 'Planning & generating data...' });
    const planResult = planAndGenerateData(userGoal, options);
    result.steps[0] = { step: 1, status: 'completed', message: 'Planning complete' };
    
    // Step 2: Validation
    result.steps.push({ step: 2, status: 'running', message: 'Validating generated data...' });
    validateGeneratedData(planResult);
    result.steps[1] = { step: 2, status: 'completed', message: 'Validation complete' };
    
    // Step 3: Skipping Server-side Ingestion (For Portability)
    result.steps.push({ step: 3, status: 'completed', message: 'Portability enabled: Dataset will be created in your environment' });
    
    // Generate suffix for unique naming
    const suffix = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
    const datasetId = 'demo_' + suffix;
    
    result.datasetId = datasetId;
    result.dataPreview = planResult.dataPreview;
    result.rawTables = planResult.tables;
    
    // Step 4: Setup Script Generation
    result.steps.push({ step: 4, status: 'running', message: 'Generating portable setup script...' });
    result.systemInstruction = planResult.systemInstruction;
    result.publicDatasetId = planResult.publicDatasetId;
    result.demoGuide = planResult.demoGuide;
    result.setupScript = generateSetupScript({
      datasetId: datasetId,
      systemInstruction: planResult.systemInstruction,
      publicDatasetId: planResult.publicDatasetId,
      suffix: suffix,
      tables: planResult.tables
    });
    result.steps[3] = { step: 4, status: 'completed', message: 'Generation complete' };
    
    result.success = true;
    
    // Save to history
    saveHistory({
      timestamp: new Date().toISOString(),
      userGoal: userGoal,
      options: options,
      datasetId: datasetId,
      publicDatasetId: planResult.publicDatasetId,
      result: {
        dataPreview: result.dataPreview,
        systemInstruction: result.systemInstruction,
        demoGuide: result.demoGuide,
        setupScript: result.setupScript,
        rawTables: result.rawTables
      }
    });
    
  } catch (error) {
    result.error = error.message;
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep) {
      lastStep.status = 'error';
      lastStep.message = error.message;
    }
  }
  
  return result;
}

// ===========================================
// Step 1: Planning and Data Generation
// ===========================================

function planAndGenerateData(userGoal, options) {
  const prompt = buildPlanningPrompt(userGoal, options);
  const response = callVertexAIWithRetry(prompt);
  
  let parsed;
  try {
    let jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    jsonStr = repairTruncatedJson(jsonStr);
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.log('Raw response (first 500 chars):', response.substring(0, 500));
    throw new Error('Failed to parse AI response. Try reducing the row/table count.');
  }
  
  // Extract preview
  const dataPreview = [];
  if (parsed.tables) {
    for (const table of parsed.tables) {
      if (table.csvData) {
        const lines = table.csvData.trim().split('\n');
        const headers = lines[0].split(',');
        const previewRows = lines.slice(1, 6).map(line => {
          const values = parseCSVLine(line);
          const row = {};
          headers.forEach((h, i) => { row[h.trim()] = values[i] || ''; });
          return row;
        });
        dataPreview.push({
          tableName: table.tableName,
          headers: headers.map(h => h.trim()),
          rows: previewRows
        });
      }
    }
  }
  
  return {
    tables: parsed.tables,
    systemInstruction: parsed.systemInstruction,
    publicDatasetId: parsed.publicDatasetId || options.publicDatasetId,
    demoGuide: parsed.demoGuide,
    dataPreview: dataPreview
  };
}

function buildPlanningPrompt(userGoal, options) {
  const maxRows = Math.min(options.rowCount, 100);
  
  return `You are a data analyst and BigQuery expert.
Design and generate a demo dataset based on the following business problem.

## Business Problem
${userGoal}

## Requirements
- Number of tables: ${options.tableCount}
- Rows per table: **Maximum ${maxRows} rows** (due to token limits)
${options.publicDatasetId ? `- Related Public Dataset: ${options.publicDatasetId}` : '- Suggest one relevant BigQuery Public Dataset related to this problem'}

## Output Format (JSON)
Output in the following JSON format. Output **pure JSON only without code blocks**.

{
  "tables": [
    {
      "tableName": "Table name (English, snake_case)",
      "description": "Description of the table",
      "schema": [
        {"name": "column_name", "type": "STRING|INTEGER|FLOAT|DATE", "description": "Column description"}
      ],
      "csvData": "column1,column2,...\\nvalue1,value2,...\\n..."
    }
  ],
  "systemInstruction": "Specific instruction for the agent (3-5 sentences). It MUST instruct the agent to introduce itself (e.g., 'I am an AI analyst for [Problem Name]') and explicitly list the specific demo datasets/tables and public datasets it can access whenever it is greeted (e.g., 'Hello', 'Hi', 'こんにちは').",
  "publicDatasetId": "bigquery-public-data.dataset_name.table_name",
  "demoGuide": [
    "1. Greeting & Intro: [Example prompt]",
    "2. Data Discovery: [Example prompt]",
    "3. Analytical Deep Dive: [Example prompt]",
    "4. Geospatial Context (Maps): [Example prompt]",
    "5. Strategy & Recommendation: [Example prompt]"
  ]
}

## Critical Notes
- **CSV data MUST NOT exceed ${maxRows} rows**.
- Use double quotes for CSV fields containing commas.
- **LANGUAGE PARITY**: Generate all qualitative content (table/field descriptions, synthetic data values like names/locations/categories, and system instructions) in the **SAME LANGUAGE** as the user's input business problem. Use English only for technical identifiers like table/column names.
- **SELF-INTRODUCTION**: The generated 'systemInstruction' MUST ensure the agent provides a detailed self-introduction including a summary of accessible data when receiving a general greeting.
- **DEMO GUIDE**: The 'demoGuide' MUST be a 5-step sequence of prompts in the user's language that showcases the agent's ability to use both BigQuery and Maps toolsets to solve the user's problem.`;
}

// ===========================================
// Step 2: Validation
// ===========================================

function validateGeneratedData(planResult) {
  if (!planResult.tables || planResult.tables.length === 0) {
    throw new Error('No table definitions generated');
  }
  
  for (const table of planResult.tables) {
    if (!table.schema || !table.csvData) throw new Error(`Incomplete table data for "${table.tableName}"`);
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function repairTruncatedJson(jsonStr) {
  try { JSON.parse(jsonStr); return jsonStr; } catch (e) {}
  
  let fixed = jsonStr;
  const csvDataMatch = fixed.match(/"csvData"\s*:\s*"([^"]*?)$/s);
  if (csvDataMatch) {
    const lastNewline = fixed.lastIndexOf('\\n');
    if (lastNewline > 0) fixed = fixed.substring(0, lastNewline) + '"';
  }
  
  let openBraces = 0; let openBrackets = 0; let inString = false; let escaped = false;
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') inString = !inString;
    else if (!inString) {
      if (char === '{') openBraces++; else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++; else if (char === ']') openBrackets--;
    }
  }
  if (inString) fixed += '"';
  while (openBrackets > 0) { fixed += ']'; openBrackets--; }
  while (openBraces > 0) { fixed += '}'; openBraces--; }
  return fixed;
}

// ===========================================
// Step 4: Setup Script Generation (Portable version)
// ===========================================

function generateSetupScript(params) {
  const { datasetId, systemInstruction, publicDatasetId, suffix, tables } = params;
  const dirName = `my-ge-demo-${suffix}`;
  
  const escapedInstruction = systemInstruction
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/\{/g, '{{')
    .replace(/\}/g, '}}')
    .replace(/\n/g, '\\n');

  // Build local BQ creation commands
  let bqCommands = `echo "🗄 Creating BigQuery Dataset: ${datasetId}..."\n`;
  bqCommands += `bq mk --dataset --location=US ${datasetId} 2>/dev/null || echo "Dataset exists."\n\n`;

  for (const table of tables) {
    const schemaStr = table.schema.map(f => `${f.name}:${f.type}`).join(',');
    bqCommands += `echo "📊 Creating Table: ${table.tableName}..."\n`;
    bqCommands += `cat <<'__CSV_EOF__' > ${table.tableName}.csv\n${table.csvData}\n__CSV_EOF__\n`;
    bqCommands += `bq load --source_format=CSV --skip_leading_rows=1 ${datasetId}.${table.tableName} ${table.tableName}.csv ${schemaStr}\n`;
    bqCommands += `rm ${table.tableName}.csv\n\n`;
  }

  return `#!/bin/bash
# ===========================================
# BigQuery MCP Agent Demo - Portable Setup Script
# Generated: ${new Date().toISOString()}
# ===========================================

set -e

# --- 1. Project Detection & Confirmation ---
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No default project found in your environment."
  echo "Please run 'gcloud config set project [PROJECT_ID]' first."
  exit 1
fi

echo "💾 Checking disk space..."
FREE_SPACE=$(df -k . | awk 'NR==2 {print $4}')
if [ "$FREE_SPACE" -lt 524288 ]; then
  echo "⚠️  Warning: Low disk space detected in Cloud Shell ($((FREE_SPACE/1024)) MB left)."
  echo "To clear space, you can run: rm -rf ~/my-ge-demo-*"
  echo ""
fi

echo "========================================================="
echo "🚀 Target Project: $PROJECT_ID"
echo "📂 Target Dataset: ${datasetId}"
echo "========================================================="
read -p "Do you want to proceed with this project? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# --- 2. IAM & API Checks ---
echo "📡 Checking & Enabling APIs..."
gcloud services enable \\
  aiplatform.googleapis.com \\
  bigquery.googleapis.com \\
  apikeys.googleapis.com \\
  mapstools.googleapis.com \\
  --project="$PROJECT_ID"

# Enable MCP services
echo "🔧 Enabling MCP services..."
gcloud beta services mcp enable bigquery.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud beta services mcp enable mapstools.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true

# Check for BQ permissions
echo "🛡 Checking permissions..."
CAN_MK_BQ=$(bq ls 2>&1 || true)
if [[ $CAN_MK_BQ == *"Access Denied"* ]]; then
  echo "❌ Error: Your account doesn't have BigQuery access in this project."
  exit 1
fi

# --- 3. Data Provisioning ---
${bqCommands}

# --- 4. Repo Setup ---
if [ -d "${dirName}" ]; then
  echo "📂 Removing existing directory ${dirName} for a clean setup..."
  rm -rf "${dirName}"
fi
echo "📦 Cloning base project..."
git clone --depth 1 https://github.com/google/mcp.git ${dirName}
cd ${dirName}

cd examples/launchmybakery
# Cleanup and rename
rm -rf adk_agent/mcp_app
mv adk_agent/mcp_bakery_app adk_agent/mcp_app

echo "📦 Installing dependencies..."
uv venv
uv pip install -r requirements.txt
uv pip install --upgrade google-adk google-genai python-dotenv vertexai db-dtypes

# --- 5. Generate Maps API Key ---
echo "🔑 Generating Maps API key..."
API_KEY_JSON=$(gcloud alpha services api-keys create --display-name="MCP-Demo-Key-${suffix}" \
    --api-target=service=mapstools.googleapis.com \
    --format=json 2>/dev/null || echo "")

if [ ! -z "$API_KEY_JSON" ]; then
    API_KEY=$(echo "$API_KEY_JSON" | grep -oP '"keyString": "\K[^"]+' 2>/dev/null || echo "$API_KEY_JSON" | grep '"keyString":' | cut -d '"' -f 4)
else
    API_KEY=$(gcloud alpha services api-keys list --filter="displayName:MCP-Demo-Key-${suffix}" --format="value(keyString)" 2>/dev/null || echo "")
fi

if [ -z "$API_KEY" ]; then
    echo "⚠️ Failed to auto-generate API key. Set it manually in .env."
    API_KEY="REPLACE_ME"
fi

# Create .env
cat <<__ENV_EOF__ > adk_agent/mcp_app/.env
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT="$PROJECT_ID"
GOOGLE_CLOUD_LOCATION="global"
DEMO_DATASET="${datasetId}"
MAPS_API_KEY="$API_KEY"
PYTHONUNBUFFERED=1
__ENV_EOF__

# --- 6. Customizing Agent ---
echo "🔧 Configuring agent..."

cat <<'__TOOLS_EOF__' > adk_agent/mcp_app/tools.py
import os
import dotenv
import google.auth
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams 

MAPS_MCP_URL = "https://mapstools.googleapis.com/mcp" 
BIGQUERY_MCP_URL = "https://bigquery.googleapis.com/mcp" 

def _apply_cloud_shell_patch():
    """
    Silent patch for google-auth RefreshError in Cloud Shell.
    Ensures stable ADC even when Metadata Server is incomplete.
    """
    import google.auth
    import google.auth.transport.requests
    from google.oauth2.credentials import Credentials
    import subprocess
    import os

    _orig_refresh = google.auth.credentials.Credentials.refresh
    def _patched_refresh(self, request):
        try:
            return _orig_refresh(self, request)
        except Exception:
            try:
                self.token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
            except:
                raise
    google.auth.credentials.Credentials.refresh = _patched_refresh

_apply_cloud_shell_patch()

def get_maps_mcp_toolset():
    dotenv.load_dotenv()
    maps_api_key = os.getenv('MAPS_API_KEY', 'no_api_found')
    return MCPToolset(connection_params=StreamableHTTPConnectionParams(url=MAPS_MCP_URL, headers={"X-Goog-Api-Key": maps_api_key}))

def get_bigquery_mcp_toolset():   
    dotenv.load_dotenv()
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'project_not_set')
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/bigquery"])
    credentials.refresh(google.auth.transport.requests.Request())
    
    # Note: Use x-goog-user-project (lowercase) as per official template for stability
    return MCPToolset(connection_params=StreamableHTTPConnectionParams(
        url=BIGQUERY_MCP_URL, 
        headers={"Authorization": f"Bearer {credentials.token}", "x-goog-user-project": project_id}
    ))
__TOOLS_EOF__

cat <<'__AGENT_EOF__' > adk_agent/mcp_app/agent.py
import os
import dotenv
root_agent = LlmAgent(
    model=f"projects/{PROJECT_ID}/locations/global/publishers/google/models/gemini-3-pro-preview",
    name='root_agent',
    instruction=instruction,
    tools=[maps_toolset, bigquery_toolset]
)
__AGENT_EOF__

clear
echo "========================================================="
echo "🎉 Setup Complete (Portable & Secure)!"
echo "========================================================="
echo ""
echo "1. Launch the Agent:"
echo "   cd ${dirName}/examples/launchmybakery/adk_agent"
echo "   ../.venv/bin/adk web"
echo ""
echo "💡 All data was provisioned directly in your project: $PROJECT_ID"
echo "========================================================="
`;
}

// ===========================================
// Vertex AI & Utilities
// ===========================================

function callVertexAIWithRetry(prompt) { return executeWithRetry(() => callVertexAI(prompt)); }

function callVertexAI(prompt) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/locations/${CONFIG.LOCATION}/publishers/google/models/${CONFIG.MODEL}:generateContent`;
  const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 65535 } };
  const response = UrlFetchApp.fetch(url, { method: 'POST', contentType: 'application/json', headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify(payload), muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error(`AI Error: ${response.getContentText()}`);
  return JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
}

function executeWithRetry(fn) {
  let lastError;
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try { return fn(); } catch (error) { lastError = error; Utilities.sleep(CONFIG.RETRY_DELAY_MS * attempt); }
  }
  throw lastError;
}

function saveHistory(entry) {
  const props = PropertiesService.getUserProperties();
  const historyKey = CONFIG.HISTORY_KEY;
  let history = JSON.parse(props.getProperty(historyKey) || '[]');
  
  // To keep history light, we store only metadata in the main list
  // The heavy result data is stored in separate chunked keys
  const storageId = `demo_data_${new Date(entry.timestamp).getTime()}`;
  const dataToStore = JSON.stringify(entry.result);
  
  // Store the payload in chunks
  saveLargeData(props, storageId, dataToStore);
  
  // Remove the large result from the index entry
  const indexEntry = { ...entry };
  delete indexEntry.result;
  indexEntry.storageId = storageId;
  
  history.unshift(indexEntry);
  
  // Clean up old entries' extra data if exceeding limit
  if (history.length > CONFIG.MAX_HISTORY) {
    const expired = history.pop();
    if (expired.storageId) {
      deleteLargeData(props, expired.storageId);
    }
  }
  
  props.setProperty(historyKey, JSON.stringify(history));
}

function getHistory() { 
  return JSON.parse(PropertiesService.getUserProperties().getProperty(CONFIG.HISTORY_KEY) || '[]'); 
}

/**
 * Retrieves a full history item including its chunked result data
 */
function getHistoryItem(timestamp) {
  const props = PropertiesService.getUserProperties();
  const history = JSON.parse(props.getProperty(CONFIG.HISTORY_KEY) || '[]');
  const entry = history.find(h => h.timestamp === timestamp);
  
  if (entry && entry.storageId) {
    const dataStr = getLargeData(props, entry.storageId);
    if (dataStr) {
      entry.result = JSON.parse(dataStr);
    }
  }
  return entry;
}

/**
 * Deletes a specific history item and its chunked data
 */
function deleteHistoryItem(timestamp) {
  const props = PropertiesService.getUserProperties();
  let history = JSON.parse(props.getProperty(CONFIG.HISTORY_KEY) || '[]');
  
  const index = history.findIndex(h => h.timestamp === timestamp);
  if (index !== -1) {
    const entry = history[index];
    if (entry.storageId) {
      deleteLargeData(props, entry.storageId);
    }
    history.splice(index, 1);
    props.setProperty(CONFIG.HISTORY_KEY, JSON.stringify(history));
  }
  return { success: true };
}

function clearHistory() { 
  const props = PropertiesService.getUserProperties();
  const history = JSON.parse(props.getProperty(CONFIG.HISTORY_KEY) || '[]');
  
  // Clear all chunked data associated with history items
  history.forEach(entry => {
    if (entry.storageId) {
      deleteLargeData(props, entry.storageId);
    }
  });
  
  props.deleteProperty(CONFIG.HISTORY_KEY);
  return { success: true }; 
}

// --- Large Data Chunking Helpers ---

/**
 * GAS PropertiesService has a 9KB limit per key.
 * This helper splits data into multiple chunks.
 */
function saveLargeData(props, baseKey, data) {
  const CHUNK_SIZE = 8000; // Safe margin below 9216 bytes
  const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    props.setProperty(`${baseKey}_chunk_${i}`, chunk);
  }
  props.setProperty(`${baseKey}_meta`, JSON.stringify({ totalChunks: totalChunks }));
}

function getLargeData(props, baseKey) {
  const metaStr = props.getProperty(`${baseKey}_meta`);
  if (!metaStr) return null;
  
  const meta = JSON.parse(metaStr);
  let data = '';
  for (let i = 0; i < meta.totalChunks; i++) {
    data += props.getProperty(`${baseKey}_chunk_${i}`) || '';
  }
  return data;
}

function deleteLargeData(props, baseKey) {
  const metaStr = props.getProperty(`${baseKey}_meta`);
  if (!metaStr) return;
  
  const meta = JSON.parse(metaStr);
  for (let i = 0; i < meta.totalChunks; i++) {
    props.deleteProperty(`${baseKey}_chunk_${i}`);
  }
  props.deleteProperty(`${baseKey}_meta`);
}

function updateSystemInstruction(setupScript, newInstruction) {
  const escaped = newInstruction.replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/\n/g, '\\n');
  return setupScript.replace(/(1\.\s+\*\*BigQuery toolset:\*\*.*?\n)([\s\S]*?)(\n\s+2\.\s+\*\*Maps Toolset:\*\*)/, `$1${escaped}$3`);
}
