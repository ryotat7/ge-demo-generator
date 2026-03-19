/**
 * GAS BigQuery MCP Demo Generator - Backend
 * 
 * Dynamically generates a portable AI agent demo environment 
 * using BigQuery and Maps MCP servers.
 */

// ===========================================
// Configuration
// ===========================================

const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const CONFIG = {
  PROJECT_ID: SCRIPT_PROPS.getProperty('PROJECT_ID'),
  LOCATION: SCRIPT_PROPS.getProperty('LOCATION') || 'global',
  MODEL: SCRIPT_PROPS.getProperty('MODEL') || 'gemini-3-flash-preview',
  LOG_SHEET_URL: SCRIPT_PROPS.getProperty('LOG_SHEET_URL'),
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  APP_VERSION: 'v5.0-public'
};



// ===========================================
// Utility & Diagnostics
// ===========================================

function forceAuthorizeSpreadsheet() {
  const dummySheetUrl = 'https://docs.google.com/spreadsheets/d/1Usj83O0qT2nIoaeyXbn5IqPY2KVdaV2G3UP_suBmIaw/edit';
  try {
    const ss = SpreadsheetApp.openByUrl(dummySheetUrl);
    console.log('[AUTH-FORCE] Successfully opened dummy sheet. If you see this, you are authorized!');
    return JSON.stringify({ success: true, message: 'Authorization forced. Check Logger logs if it works!' });
  } catch (e) {
    if (e.message.includes('権限')) {
      console.log('[AUTH-FORCE] Authority error found. This is expected if you are not yet authorized. Running this function should have triggered the popup!');
      throw new Error('Please click Review Permissions to authorize Spreadsheet access.');
    } else {
      console.log('[AUTH-FORCE] Unknown error: ' + e.message);
      return JSON.stringify({ success: false, error: 'Unexpected error: ' + e.message });
    }
  }
}

function resetAllUserProperties() {
  const props = PropertiesService.getUserProperties();
  props.deleteAllProperties();
  console.log('[STORAGE-RESET] All UserProperties cleared successfully.');
  return JSON.stringify({ success: true, message: 'All UserProperties cleared.' });
}


// ===========================================
// Web App Entry Point
// ===========================================
function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  
  template.appVersion = CONFIG.APP_VERSION;
  template.updateLog = JSON.stringify(fetchGitLogs());
  template.projectId = CONFIG.PROJECT_ID;
  template.userEmail = Session.getActiveUser().getEmail();
  
  return template.evaluate()
    .setTitle('Gemini Enterprise Demo Generator')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function checkSpreadsheet() {
  if (!CONFIG.LOG_SHEET_URL) {
    return JSON.stringify({ success: false, error: 'No LOG_SHEET_URL configured' });
  }
  try {
    const ss = SpreadsheetApp.openByUrl(CONFIG.LOG_SHEET_URL);
    return JSON.stringify({ success: true, message: 'Logger Sheet Connected: ' + ss.getName() });
  } catch (e) {
    return JSON.stringify({ success: false, error: 'Failed to access sheet: ' + e.message });
  }
}

function logUsageToSheet(logEntry) {
  console.log('[LOGGING] Attempting to log usage. LOG_SHEET_URL length:', CONFIG.LOG_SHEET_URL ? CONFIG.LOG_SHEET_URL.length : 0);
  
  if (!CONFIG.LOG_SHEET_URL) {
    console.log('[LOGGING] No LOG_SHEET_URL configured, skipping spreadsheet log.');
    return;
  }
  
  try {
    console.log('[LOGGING] Opening spreadsheet...');
    const ss = SpreadsheetApp.openByUrl(CONFIG.LOG_SHEET_URL);
    console.log('[LOGGING] Spreadsheet opened:', ss.getName());
    let sheet = ss.getSheetByName('Usage_Logs') || ss.getSheets()[0]; // Look for Usage_Logs first, fallback to first sheet
    console.log('[LOGGING] Logging to sheet tab:', sheet.getName());
    
    const timestamp = new Date().toISOString();
    
    const durationSecs = Math.floor(logEntry.durationMs / 1000);
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    const durationStr = `${mins}m ${secs}s`;

    const rowData = [
      timestamp,
      logEntry.datasetId || 'N/A',
      logEntry.status || 'N/A',
      durationStr,
      logEntry.rowCount || 0,
      logEntry.tableCount || 0,
      logEntry.publicDatasetFlag ? 'Yes' : 'No',
      logEntry.tableNames || 'N/A',
      logEntry.errorClass || 'N/A'
    ];

    // If empty sheet, write header
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Dataset ID', 'Status', 'Duration', 'Req. Rows', 'Req. Tables', 'Public Dataset', 'Table Names', 'Error Class']);
    }
    
    sheet.appendRow(rowData);
    console.log('[LOGGING] Successfully logged usage to sheet. Data row:', rowData);
  } catch (e) {
    console.error('[LOGGING] Failed to log usage to sheet:', e.message);
  }
}

/**
 * Main function to generate the demo artifacts
 */
function generateDemo(userGoal, options = {}) {
  const startTime = Date.now();
  const defaultOptions = {
    rowCount: 100,
    tableCount: 3,
    publicDatasetId: null,
    usePublicDataset: false
  };
  options = { ...defaultOptions, ...options };
  
  if (!options.usePublicDataset) {
    options.publicDatasetId = null;
  }
  
  const result = {
    success: false,
    steps: [],
    error: null,
    datasetId: null,
    tableInfo: [],
    dataPreview: [],
    systemInstruction: null,
    setupScript: null,
    rawTables: [],
    suffix: null,
    domainName: null,
    referenceDate: null,
    appliedFactors: null
  };
  
  try {
    // Step 1: Planning and Data Generation
    result.steps.push({ step: 1, status: 'running', message: 'Planning & generating data...' });
    const planResult = planAndGenerateData(userGoal, options);
    result.steps[0] = { step: 1, status: 'completed', message: 'Planning complete' };
    
    // Step 2: Validation
    result.steps.push({ step: 2, status: 'running', message: 'Validating generated data...' });
    const maxRows = Math.min(options.rowCount || 100, 150);
    validateGeneratedData(planResult, maxRows);
    result.steps[1] = { step: 2, status: 'completed', message: 'Validation complete' };
    
    // Step 3: Suffix generation
    const suffix = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
    const baseName = generateBaseName(userGoal, suffix);
    const dirName = "demo-" + baseName;
    const datasetId = ("demo_" + baseName).replace(/-/g, '_');
    
    result.datasetId = datasetId;
    result.userGoal = userGoal;
    result.dataPreview = planResult.dataPreview;
    result.rawTables = planResult.tables;
    result.suffix = suffix;
    result.domainName = baseName.substring(0, baseName.lastIndexOf('-' + suffix));
    result.dirName = dirName;
    result.systemInstruction = planResult.systemInstruction;
    result.referenceDate = planResult.referenceDate;
    result.publicDatasetId = planResult.publicDatasetId;
    result.demoGuide = planResult.demoGuide;
    result.appliedFactors = planResult.appliedFactors || {};

    result.setupScript = generateSetupScript({
      datasetId: datasetId,
      systemInstruction: planResult.systemInstruction,
      referenceDate: planResult.referenceDate,
      publicDatasetId: planResult.publicDatasetId,
      suffix: suffix,
      dirName: dirName,
      tables: planResult.tables,
      userGoal: userGoal
    });
    result.steps.push({ step: 4, status: 'completed', message: 'Generation complete' });
    
    result.success = true;
    
    
    // Save to telemetry and log to sheet
    const durationMs = Date.now() - startTime;
    const telemetry = {
      datasetId: datasetId,
      status: 'Success',
      durationMs: durationMs,
      rowCount: options.rowCount,
      tableCount: options.tableCount,
      publicDatasetFlag: options.usePublicDataset,
      tableNames: result.rawTables ? result.rawTables.map(t => t.tableName).join(', ') : 'N/A',
      errorClass: null
    };

    try {
      logUsageToSheet(telemetry);
    } catch (logErr) {
      console.error('[LOGGING-CRITICAL] Failed to log usage to sheet in generate:', logErr.message);
    }
    
  } catch (error) {
    result.error = error.message;
    const lastStep = result.steps[result.steps.length - 1];
    if (lastStep) {
      lastStep.status = 'error';
      lastStep.message = error.message;
    }
    
    // Log failure telemetry
    const durationMs = Date.now() - startTime;
    const failureTelemetry = {
      datasetId: result.datasetId || 'Unknown',
      status: 'Failure',
      durationMs: durationMs,
      rowCount: options.rowCount,
      tableCount: options.tableCount,
      publicDatasetFlag: options.usePublicDataset,
      tableNames: result.rawTables ? result.rawTables.map(t => t.tableName).join(', ') : 'N/A',
      errorClass: error.message
    };
    try {
      logUsageToSheet(failureTelemetry);
    } catch (logErr) {
      console.error('[LOGGING-CRITICAL] Failed to log failure to sheet:', logErr.message);
    }
  }
  
  return result;
}

// ===========================================
// Step 1: Planning and Data Generation
// ===========================================

/**
 * Discovers a real BigQuery public dataset ID using Google Search grounding,
 * then verifies the table exists using the BigQuery API.
 * @param {string} userGoal - The user's business problem description.
 * @returns {string} A verified public dataset ID or a fallback.
 */
function discoverPublicDataset(userGoal) {
  const discoveryPrompt = `Find a real BigQuery public dataset that would provide EXTERNAL CONTEXT or ENRICHMENT for the following business problem:

"${userGoal}"

Requirements:
1. The dataset MUST exist under the project 'bigquery-public-data'.
2. Search Google to find the exact dataset and table names.
3. PRIORITIZE "External Context" data: weather, demographics, census, economic indicators, geographic features, or market statistics.
4. AVOID "Core Business" data: Do NOT select datasets that look like internal company records (e.g., avoid order histories, customer lists, or internal transactions) unless explicitly required for external benchmarking.
5. Return ONLY the fully qualified ID in the format: bigquery-public-data.dataset_name.table_name
6. If multiple tables exist, choose the most commonly used or primary one.
7. Do NOT invent or hallucinate dataset names.

Examples of preferred "External Context" datasets:
- bigquery-public-data.noaa_gsod.gsod2023 (Weather)
- bigquery-public-data.census_bureau_acs.zip_codes_2018_5yr (Demographics)
- bigquery-public-data.geo_open_streets.lines (Geographic)
- bigquery-public-data.google_trends.top_terms (Market Trends)

Return ONLY the dataset ID, nothing else.`;

  const FALLBACK = 'bigquery-public-data.thelook_ecommerce.orders';

  try {
    const result = callVertexAIWithSearch(discoveryPrompt);
    const cleanId = result.trim().replace(/[`'"]/g, '').split('\n')[0];
    
    if (!cleanId.startsWith('bigquery-public-data.') || cleanId.split('.').length < 3) {
      return FALLBACK;
    }
  
    const verifiedId = verifyAndResolveTable(cleanId);
    return verifiedId || FALLBACK;
  } catch (e) {
    return FALLBACK;
  }
}

/**
 * Verifies a table exists in BigQuery. If the exact table doesn't exist,
 * attempts to find a valid table in the same dataset.
 * @param {string} candidateId - Fully qualified ID (project.dataset.table)
 * @returns {string|null} Verified table ID or null if not found.
 */
function verifyAndResolveTable(candidateId) {
  const parts = candidateId.split('.');
  if (parts.length < 3) return null;
  
  const projectId = parts[0];
  const datasetId = parts[1];
  const tableId = parts.slice(2).join('.'); 
  
  try {
    BigQuery.Tables.get(projectId, datasetId, tableId);
    return candidateId;
  } catch (e) {}
  
  try {
    const tables = BigQuery.Tables.list(projectId, datasetId, { maxResults: 20 });
    if (tables.tables && tables.tables.length > 0) {
      const preferredPatterns = ['trips', 'orders', 'events', 'data', 'stats', 'records'];
      let match = null;
      for (const pattern of preferredPatterns) {
        match = tables.tables.find(t => t.tableReference.tableId.toLowerCase().includes(pattern));
        if (match) break;
      }
      if (!match) match = tables.tables[0];
      
      return `${projectId}.${datasetId}.${match.tableReference.tableId}`;
    }
  } catch (listError) {}
  
  return null;
}


function planAndGenerateData(userGoal, options) {
  // Step 0: If using public dataset and no ID specified, discover one using search grounding
  if (options.usePublicDataset && !options.publicDatasetId) {
    options.publicDatasetId = discoverPublicDataset(userGoal);
  }
  
  const prompt = buildPlanningPrompt(userGoal, options);
  const response = callVertexAIWithRetry(prompt);
  
  let parsed;
  try {
    let jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    jsonStr = repairTruncatedJson(jsonStr);
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse AI response. Try reducing the row/table count.');
  }
  
  // Extract preview
  const dataPreview = [];
  if (parsed.tables) {
    for (const table of parsed.tables) {
      if (table.csvData) {
        const lines = table.csvData.trim().split('\n');
        const headers = parseCSVLine(lines[0]);
        const previewRows = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          const row = {};
          headers.forEach((h, i) => { row[h.trim().replace(/^"|"$/g, '')] = values[i] || ''; });
          return row;
        });
        dataPreview.push({
          tableName: table.tableName,
          headers: headers.map(h => h.trim().replace(/^"|"$/g, '')),
          rows: previewRows,
          totalRows: lines.length - 1
        });
      }
    }
  }
  
  // Validation and Clean-up
  validateGeneratedData(parsed, options.rowCount);

  return {
    tables: parsed.tables,
    systemInstruction: parsed.systemInstruction,
    referenceDate: parsed.referenceDate || '2023-11-01',
    publicDatasetId: parsed.publicDatasetId || options.publicDatasetId,
    oneSentenceSummary: parsed.oneSentenceSummary || null,
    demoGuide: parsed.demoGuide,
    appliedFactors: parsed.appliedFactors || null,
    dataPreview: dataPreview
  };
}

function buildPlanningPrompt(userGoal, options) {
  const maxRows = Math.min(options.rowCount || 100, 150);
  const publicDatasetInfo = options.usePublicDataset && options.publicDatasetId 
    ? `- RELATED PUBLIC DATASET (ENRICHMENT ONLY): ${options.publicDatasetId}
       * ROLE: This dataset serves as EXTERNAL CONTEXT (e.g., weather, statistics) to enrich the core business data.
       * CONSTRAINT: DO NOT use this dataset as a replacement for core business operations (e.g., do not use public orders/customers if you are generating a retail demo).
       * JOIN STRATEGY: Link via common attributes like 'zip_code', 'category', 'region', or 'date' rather than internal system IDs.`
    : `- IMPORTANT: NO public dataset should be used for this demo. Focus ONLY on synthetic tables below. Do NOT attempt to JOIN with external public-data.`;
  
  return `You are a versatile data analyst and BigQuery expert capable of generating realistic datasets for ANY industry or business function.
Design and generate a demo dataset based on the following business problem.

**DOMAIN ADAPTATION**: Carefully analyze the business problem below to identify the industry, job function, and operational context. Adapt ALL data generation (table structures, column names, values, relationships) to match that specific domain. Do not default to generic examples or assume a particular industry unless explicitly stated.

## Business Problem
${userGoal}

## Requirements
- Number of tables: ${options.tableCount}
- Rows per table: **Target exactly ${maxRows} diverse rows** per table.
- Columns per table: **Target 6-10 descriptive columns** per table to ensure analytical depth.
${publicDatasetInfo}

## REALISTIC DATA SYNTHESIS (CRITICAL)
Generate data that reflects real-world business complexity. Apply the following domain-agnostic principles, **adapting them to the specific industry/function identified above**:

### 1. Temporal Patterns
Apply cyclical variations appropriate to the business context:
- **Day-of-week effects**: Weekday vs. weekend behavioral differences
- **End-of-period spikes**: Month-end, quarter-end, or fiscal year-end concentrations
- **Holiday/Event impacts**: Peak periods, promotional windows, or seasonal patterns
Infer relevant cycles based on the stated industry and problem.

### 2. Attribute Correlations
Ensure realistic correlations between dimensions:
- **Geography × Behavior**: Regional preferences, local trends, or location-based patterns
- **Segment × Channel**: Customer type affecting preferred interaction methods
- **Tier/Rank × Frequency**: Engagement levels varying by loyalty status or classification
Create statistically plausible distributions — not random noise.

### 3. Business Logic Linkage (Cross-Table Consistency)
Ensure data across tables is logically consistent:
- **Constraint-based value linkage**: Capacity limits affecting downstream transactions (e.g., if a resource is exhausted, related activity stops)
- **Status/State transitions**: Multi-step workflows with valid state progressions
- **Temporal dependencies**: Lead times between related events (e.g., approval → execution timing)
Infer appropriate business rules based on the stated industry and challenge.

### 4. Real-World Content (CRITICAL - Avoid Fictional Data)
Use **actual real-world data** wherever possible to maximize authenticity:
- **Products/Brands**: Use real brand names, product lines, and SKUs appropriate to the industry (e.g., "iPhone 15 Pro", "Nike Air Max", "Toyota Camry")
- **Geographic Locations**: Use real city names, regions, and countries. Match locations to the business context (e.g., major retail markets, manufacturing hubs)
- **Person Names**: Use culturally appropriate, realistic names for the stated region/language (e.g., Japanese names for Japan-based scenarios)
- **Numerical Values**: Use realistic price points, quantities, and metrics based on real-world benchmarks (e.g., actual market prices, typical order volumes)
- **Dates**: Use recent, realistic dates anchored to the referenceDate

**DO NOT invent fictional brands, fake product names, or placeholder values like "Product A" or "Company XYZ".**

### 5. Factual Consistency (CRITICAL - Company/Entity Alignment)
If the business problem mentions a **specific company, organization, or brand**, ensure ALL generated data is factually consistent with that entity:
- **Employees/Talents/Staff**: Only use names of people who ACTUALLY belong to that organization. Do NOT mix in people from competing organizations.
- **Products/Services**: Only use products/services that the specified company ACTUALLY offers. Do NOT include competitor products.
- **Locations/Facilities**: Only reference facilities that the company ACTUALLY owns or operates. Do NOT use generic placeholder names.
- **Partnerships/Clients**: Reference realistic business relationships based on publicly known information.

**If you are unsure whether a specific entity belongs to the mentioned company, DO NOT include it. It is better to use fewer but accurate data points than to include factually incorrect associations.**

**If NO specific company/organization is mentioned in the business problem**: Create a COHERENT fictional business context. Choose ONE realistic company profile (industry vertical, size, geography) and generate ALL data as if it belongs to this single hypothetical entity. Ensure internal consistency - all facilities, products, and personnel should belong to the same fictional organization. Do NOT mix data from multiple unrelated real-world companies.

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
  "systemInstruction": "Specific instruction for the agent (3-5 sentences). Focus on defining the persona and domain expertise. Instruct the agent to wait for user input before acting, but emphasize autonomous persistence in error recovery once a goal is assigned.",
  "referenceDate": "YYYY-MM-DD",
  "publicDatasetId": "bigquery-public-data.dataset.table",
  "oneSentenceSummary": "A concise, professional one-sentence summary of the business challenge and the generated solution.",
  "appliedFactors": {
    "temporalPatterns": ["List of 2-3 specific temporal patterns applied (e.g., 'Weekday lunch surge', 'Month-end reconciliation spike')"],
    "correlations": ["List of 2-3 specific data correlations applied (e.g., 'Region-specific product preference', 'High-tier customer loyalty frequency')"],
    "businessLogic": ["List of 2-3 specific business logic constraints applied (e.g., 'Inventory threshold triggers', 'Sequential status transition integrity')"]
  },
  "demoGuide": [
    {
      "title": "Descriptive title of the analysis (e.g., 'Geospatial Delay Root Cause Analysis')",
      "prompt": "Full prompt for the user to copy. Rules: 1. Do NOT mention specific table or column names (the agent must find them). 2. Present as a complex business question. 3. Synergize BigQuery analytics with Google Maps (location grounding) and Public Datasets where available."
    }
  ]
}

## Critical Notes
- **DEMO PROMPTS (CRITICAL)**: Generate EXACTLY 5 structured demo prompts that showcase the agent's "reasoning" and "tool-use" capabilities.
    1. **NO TABLES/COLUMNS**: Do NOT mention \`production_batches\`, \`port_id\`, etc. in the prompt text.
    2. **TOOL SYNERGY**: At least one prompt MUST require the agent to use BOTH BigQuery (for historical trends/metrics) and Google Maps (for travel times, routes, or place details) to answer.
    3. **PROBLEM-CENTRIC**: Focus on high-level business goals (e.g., "Identify the financial impact of logistics delays in coastal regions and propose an optimized route for the highest-value shipments").
- **MAXIMUM DATA (CRITICAL)**: You MUST generate **exactly ${maxRows} rows** for every table. Do NOT use "etc.", "...", or any placeholder to truncate data. This is a technical requirement for a simulation.
- **RELATIONAL INTEGRITY & NAMING**: 
    1. **Primary/Foreign Keys MUST follow the format \`[entity]_id\`** (e.g., \`talent_id\`, \`theater_id\`).
    2. **STRICT SYMMETRY**: Foreign Keys MUST have the EXACT same name as the Primary Key they reference. Do NOT use prefixes like \`main_\` or \`ref_\` for ID columns.
    3. **STAR SCHEMA PREFERENCE**: When generating multiple tables, favor a "Star Schema" approach. Include at least one central "Dimension/Master" table (e.g., \`products\`, \`locations\`, \`customers\`) that other "Fact/Log" tables reference. This ensures better data connectivity and analytical depth.
    4. **NO ISOLATED TABLES (CRITICAL)**: Every table MUST be connected to at least one other table. Isolated tables (islands) are strictly forbidden. Ensure that all tables can be joined together directly or through an intermediary table.
    5. Tables MUST be designed for joining.
- **LANGUAGE CONSISTENCY (CRITICAL)**: Detect the language used in the "Business Problem" above. You MUST use this same language for ALL user-facing fields, including:
    - Table and Column descriptions
    - STRING values in the CSV data (e.g., product names, categories, person names, names of things)
    - \`systemInstruction\`
    - \`appliedFactors\` descriptions
    - \`demoGuide\` titles and prompts
- **TECHNICAL NAMES (CRITICAL)**: Table names, column names, and ALL ID fields (primary/foreign keys) MUST use English (snake_case) for technical compatibility and data integrity. Do NOT translate technical identifiers.
- **ABSTRACT INSTRUCTIONS**: Do NOT mention column names in prompts.
- **STRICT CSV FORMATTING**:
    1. **ALWAYS wrap text-based values** (STRING) in double quotes.
    2. **DO NOT wrap numeric values** (INTEGER, FLOAT) in quotes.
`;
}

// ===========================================
// Step 2: Validation
// ===========================================

function validateGeneratedData(planResult, targetRows) {
  if (!planResult.tables || planResult.tables.length === 0) {
    throw new Error('No table definitions generated');
  }
  
  for (const table of planResult.tables) {
    if (!table.schema || !table.csvData) throw new Error(`Incomplete table data for "${table.tableName}"`);
    
    // Validate and repair CSV/Schema column count mismatch
    const lines = table.csvData.trim().split('\n');
    if (lines.length === 0) throw new Error(`Empty CSV data for "${table.tableName}"`);
    
    const csvHeaders = parseCSVLine(lines[0]);
    const schemaColumnCount = table.schema.length;
    const csvColumnCount = csvHeaders.length;
    
    if (csvColumnCount !== schemaColumnCount) {
      // console.log(`Column mismatch for "${table.tableName}": CSV has ${csvColumnCount} columns, schema has ${schemaColumnCount}. Repairing...`);
      
      // Rebuild schema from CSV headers, inferring types from existing schema or defaulting to STRING
      const schemaMap = {};
      for (const field of table.schema) {
        schemaMap[field.name.toLowerCase()] = field;
      }
      
      const repairedSchema = csvHeaders.map(headerName => {
        const normalizedName = headerName.trim().toLowerCase();
        if (schemaMap[normalizedName]) {
          return schemaMap[normalizedName];
        }
        // Default to STRING for unknown columns
        return { name: headerName.trim(), type: 'STRING', description: 'Auto-generated field' };
      });
      
      table.schema = repairedSchema;
      // console.log(`Repaired schema for "${table.tableName}" to ${repairedSchema.length} columns.`);
    }

    const expectedColumnCount = table.schema.length;
    
    // --- Row count threshold check ---
    const dataRowCount = lines.length - 1; // Exclude header
    const minExpectedRows = Math.min(10, Math.floor(targetRows * 0.2)); // Dynamic minimum threshold
    
    if (dataRowCount < minExpectedRows) {
      console.warn(`[CSV QUALITY] Table "${table.tableName}" has only ${dataRowCount} rows (expected at least ${minExpectedRows}). Data may be sparse.`);
    }

    // --- Per-row column validation and repair ---
    const repairedLines = [];
    let repairCount = 0;
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let parts = parseCSVLine(line);
      
      // Repair rows with wrong column count
      if (parts.length !== expectedColumnCount) {
        if (lineIdx === 0) {
          // Header row mismatch - this shouldn't happen after schema repair, but handle it
          console.warn(`[CSV REPAIR] Header row has ${parts.length} columns, expected ${expectedColumnCount}. Skipping repair.`);
        } else {
          // Data row mismatch - repair by padding or truncating
          if (parts.length < expectedColumnCount) {
            // Pad with empty values
            while (parts.length < expectedColumnCount) {
              parts.push('');
            }
          } else {
            // Truncate excess columns
            parts = parts.slice(0, expectedColumnCount);
          }
          repairCount++;
        }
      }
      repairedLines.push(parts);
    }
    
    if (repairCount > 0) {
      console.warn(`[CSV REPAIR] Repaired ${repairCount} malformed rows in "${table.tableName}".`);
    }


    // --- Row Count Validation ---
    // Note: We intentionally do NOT pad with generated placeholder data.
    // It's better to have fewer realistic rows than many fake placeholder values
    // like "theater_name_13" or "location_prefecture_14".
    const currentDataRows = repairedLines.length - 1; // Exclude header
    if (currentDataRows < targetRows) {
      console.warn(`[ROW COUNT] Table "${table.tableName}" has ${currentDataRows} rows (target: ${targetRows}). AI did not generate enough rows.`);
    }

    // --- Robust Data Cleaning & Type Validation ---
    let typeRepairCount = 0;
    const cleanedLines = repairedLines.map((parts, lineIdx) => {
      // Skip header row for type validation
      if (lineIdx === 0) {
        return parts.map(v => v.replace(/^"|"$/g, '')).map((v, colIdx) => {
          const field = table.schema[colIdx];
          const type = field ? field.type.toUpperCase() : 'STRING';
          if (['INTEGER', 'FLOAT', 'DOUBLE', 'NUMBER', 'INT64', 'FLOAT64'].includes(type)) {
            return v;
          }
          return `"${v.replace(/"/g, '""')}"`;
        }).join(',');
      }
      
      // Data rows: validate and repair each cell
      return parts.map((val, colIdx) => {
        const field = table.schema[colIdx];
        const type = field ? field.type.toUpperCase() : 'STRING';
        const columnName = field ? field.name : `col${colIdx}`;
        
        // Use the new validation helper
        const result = validateAndRepairValue(val, type, columnName, lineIdx - 1);
        if (result.repaired) {
          typeRepairCount++;
        }
        return result.value;
      }).map((v, colIdx) => {
        // Final Re-quoting as per BigQuery requirements
        const field = table.schema[colIdx];
        const type = field ? field.type.toUpperCase() : 'STRING';
        
        if (['INTEGER', 'FLOAT', 'DOUBLE', 'NUMBER', 'INT64', 'FLOAT64'].includes(type)) {
          return v; // Numbers stay unquoted
        }
        // Strings, Dates, etc. get strictly quoted
        return `"${v.replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    if (typeRepairCount > 0) {
      console.warn(`[TYPE REPAIR] Fixed ${typeRepairCount} type violations in "${table.tableName}".`);
    }
    
    table.csvData = cleanedLines.join('\n');
  }
}

/**
 * Validates and repairs a cell value based on its declared type.
 * Returns the repaired value and whether repair was needed.
 * @param {string} value - The raw value
 * @param {string} type - The column type (INTEGER, FLOAT, DATE, STRING, etc.)
 * @param {string} columnName - Column name for context-aware defaults
 * @param {number} rowIndex - Row index for generating sequential defaults
 * @returns {{value: string, repaired: boolean}}
 */
function validateAndRepairValue(value, type, columnName, rowIndex) {
  const upperType = type.toUpperCase();
  const trimmedVal = value.trim();
  
  // Empty values are allowed (NULL)
  if (trimmedVal === '') {
    return { value: '', repaired: false };
  }
  
  switch(upperType) {
    case 'INT64':
    case 'INTEGER':
      // Check for range expressions like "51-100"
      const rangeMatch = trimmedVal.match(/^(\d+)\s*[-–—]\s*\d+$/);
      if (rangeMatch) {
        return { value: rangeMatch[1], repaired: true };
      }
      // Check for valid integer
      if (/^-?\d+$/.test(trimmedVal)) {
        return { value: trimmedVal, repaired: false };
      }
      // Try to extract a number
      const intMatch = trimmedVal.match(/-?\d+/);
      if (intMatch) {
        return { value: intMatch[0], repaired: true };
      }
      // Generate fallback
      return { value: generateDefaultValue(upperType, columnName, rowIndex), repaired: true };
      
    case 'FLOAT64':
    case 'FLOAT':
    case 'DOUBLE':
    case 'NUMBER':
      // Check for valid float
      if (/^-?\d*\.?\d+$/.test(trimmedVal)) {
        return { value: trimmedVal, repaired: false };
      }
      // Try to extract a number
      const floatMatch = trimmedVal.match(/-?\d+\.?\d*/);
      if (floatMatch) {
        return { value: floatMatch[0], repaired: true };
      }
      // Generate fallback
      return { value: generateDefaultValue(upperType, columnName, rowIndex), repaired: true };
      
    case 'DATE':
      // Check for valid date format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedVal)) {
        return { value: trimmedVal, repaired: false };
      }
      // Try to extract a date pattern
      const dateMatch = trimmedVal.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return { value: dateMatch[0], repaired: true };
      }
      // Generate fallback
      return { value: generateDefaultValue(upperType, columnName, rowIndex), repaired: true };
      
    case 'TIMESTAMP':
    case 'DATETIME':
      // Accept ISO format or similar
      if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmedVal)) {
        return { value: trimmedVal, repaired: false };
      }
      // Generate fallback as date
      return { value: generateDefaultValue('DATE', columnName, rowIndex), repaired: true };
      
    default:
      // STRING type - accept as-is
      return { value: trimmedVal, repaired: false };
  }
}

/**
 * Generates a sensible default value for a given type and column.
 * @param {string} type - The column type
 * @param {string} columnName - Column name for context-aware generation
 * @param {number} rowIndex - Row index for sequential IDs
 * @returns {string} A valid default value
 */
function generateDefaultValue(type, columnName, rowIndex) {
  const upperType = type.toUpperCase();
  const lowerColName = columnName.toLowerCase();
  
  switch(upperType) {
    case 'INT64':
    case 'INTEGER':
      // ID columns get sequential values
      if (lowerColName.endsWith('_id') || lowerColName === 'id') {
        return String(rowIndex + 1);
      }
      // Count/quantity columns
      if (lowerColName.includes('count') || lowerColName.includes('quantity') || lowerColName.includes('num')) {
        return String(Math.floor(Math.random() * 100) + 1);
      }
      // Default integer
      return String(Math.floor(Math.random() * 1000));
      
    case 'FLOAT64':
    case 'FLOAT':
    case 'DOUBLE':
    case 'NUMBER':
      // Price/amount columns
      if (lowerColName.includes('price') || lowerColName.includes('amount') || lowerColName.includes('cost')) {
        return (Math.random() * 1000 + 10).toFixed(2);
      }
      // Rating/score columns
      if (lowerColName.includes('rating') || lowerColName.includes('score')) {
        return (Math.random() * 4 + 1).toFixed(1);
      }
      // Default float
      return (Math.random() * 100).toFixed(2);
      
    case 'DATE':
      // Generate a date within the past year
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * 365));
      return d.toISOString().split('T')[0];
      
    case 'TIMESTAMP':
    case 'DATETIME':
      const dt = new Date();
      dt.setDate(dt.getDate() - Math.floor(Math.random() * 365));
      return dt.toISOString();
      
    default:
      // STRING type
      return `${columnName}_${rowIndex + 1}`;
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Handle escaped double quotes: ""
        current += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
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

/**
 * Generates a short, filesystem-safe base name from the user's goal.
 * @param {string} userGoal - The user's business problem description
 * @param {string} suffix - Unique suffix for collision avoidance
 * @returns {string} A short, descriptive base name (e.g. retail-inventory-abcd1234)
 */
function generateBaseName(userGoal, suffix) {
  // Use AI to generate a short English identifier
  const prompt = `Generate a short, filesystem-safe identifier (2-3 words, lowercase, hyphens only) that describes this business problem:

"${userGoal}"

Rules:
- Use ONLY lowercase letters and hyphens (no numbers, no special characters)
- Maximum 20 characters
- Must be descriptive of the business domain
- Examples: "retail-inventory", "bakery-sales", "hotel-booking", "logistics-fleet"

Return ONLY the name, nothing else.`;

  try {
    const result = callVertexAI(prompt);
    let cleanName = result.trim().toLowerCase()
      .replace(/[^a-z-]/g, '-')     // Replace non-alphabet/non-hyphen with hyphen
      .replace(/-+/g, '-')           // Collapse multiple hyphens
      .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
      .substring(0, 15);             // Limit length to 15 to stay under 26 total with suffix
    
    if (cleanName.length < 3) cleanName = 'demo-env';
    return `${cleanName}-${suffix}`;
  } catch (e) {
    return `env-${suffix}`;
  }
}

function generateSetupScript(params) {
  const { datasetId, systemInstruction, referenceDate, publicDatasetId, suffix, tables, userGoal, dirName } = params;
  
  const escapedInstruction = systemInstruction
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\''")
    .replace(/\{/g, '{{')
    .replace(/\}/g, '}}')
    .replace(/\n/g, '\\n');

  // Build local BQ creation commands
  let bqCommands = `echo "🗄 Creating BigQuery Dataset: ${datasetId}..."\n`;
  bqCommands += `bq mk --dataset --location=US ${datasetId} 2>/dev/null || echo "    ✅ Dataset already exists."\n\n`;

  for (const table of tables) {
    const schemaStr = table.schema.map(f => `${f.name}:${f.type}`).join(',');
    bqCommands += `echo "📊 Table: ${table.tableName}..."\n`;
    bqCommands += `if bq show ${datasetId}.${table.tableName} >/dev/null 2>&1; then\n`;
    bqCommands += `  echo "    ✅ Table already exists, skipping load."\n`;
    bqCommands += `else\n`;
    bqCommands += `  echo "    📥 Loading sample data..."\n`;
    bqCommands += `  cat <<'__CSV_EOF__' > ${table.tableName}.csv\n${table.csvData}\n__CSV_EOF__\n`;
    bqCommands += `  bq load --source_format=CSV --skip_leading_rows=1 --allow_quoted_newlines --null_marker="" --quote='"' --encoding=UTF-8 --location=US ${datasetId}.${table.tableName} ${table.tableName}.csv ${schemaStr}\n`;
    bqCommands += `  rm ${table.tableName}.csv\n`;
    bqCommands += `  echo "    ✅ Loaded."\n`;
    bqCommands += `fi\n\n`;
  }

  // Robustly escape instruction for a text file
  const rawInstruction = systemInstruction;

  return `#!/bin/bash
# ===========================================
# BigQuery MCP Agent Demo - Setup Script
# Generated: ${new Date().toISOString()}
# Demo: ${dirName}
# ===========================================

set -e

# --- Cleanup Mode Handler ---
  if [ "$1" = "--cleanup" ] || [ "$1" = "-c" ]; then
    echo ""
    echo "========================================================="
    echo "🧹 DEMO CLEANUP MODE"
    echo "========================================================="
    echo ""
    echo "This will delete the following resources:"
    echo "  • BigQuery Dataset: ${datasetId}"
    echo "  • Maps API Key: MCP-Demo-Key-${suffix}"
    echo "  • Cloud Run Service: ${dirName} (if deployed)"
    echo "  • Agent Engine (Reasoning Engine) instance: ${dirName}"
    echo "  • Gemini Enterprise registration (App): ${dirName}"
    echo "  • Local Directory: ~/${dirName}"
    echo ""
    read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
    echo
    if [[ ! \$REPLY =~ ^[Yy]$ ]]; then
      echo "Cleanup cancelled."
      exit 0
    fi
    
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    
    echo ""
    echo "🗑️  Deleting BigQuery Dataset: ${datasetId}..."
    bq rm -r -f -d \$PROJECT_ID:${datasetId} 2>/dev/null && echo "   ✅ Dataset deleted." || echo "   ⚠️  Dataset not found or already deleted."
    
    echo ""
    echo "🔑 Deleting Maps API Key: MCP-Demo-Key-${suffix}..."
    KEY_NAME=$(gcloud alpha services api-keys list --filter="displayName:MCP-Demo-Key-${suffix}" --format="value(name)" 2>/dev/null || echo "")
    if [ ! -z "\$KEY_NAME" ]; then
      gcloud alpha services api-keys delete "\$KEY_NAME" --quiet 2>/dev/null && echo "   ✅ API Key deleted." || echo "   ⚠️  Failed to delete API Key."
    else
      echo "   ⚠️  API Key not found or already deleted."
    fi

    echo ""
    echo "🚀 Deleting Cloud Run service: ${dirName}..."
    gcloud run services delete ${dirName} --region=us-central1 --quiet 2>/dev/null && echo "   ✅ Cloud Run service deleted." || echo "   ⚠️  Service not found or already deleted."

    echo ""
    echo "🤖 Deleting Agent Engine (Reasoning Engine) instance..."
    TOKEN=\$(gcloud auth print-access-token)
    # Robust search: Try exact match first, then suffix match
    RE_NAME=\$(curl -s -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" \
        "https://us-central1-aiplatform.googleapis.com/v1/projects/\$PROJECT_ID/locations/us-central1/reasoningEngines" | \
        jq -r --arg dir "${dirName}" --arg suf "${suffix}" '.. | objects | select(.displayName? == $dir or (.displayName? | strings | endswith($suf))) | .name' | head -n 1)
    
    if [ ! -z "\$RE_NAME" ] && [ "\$RE_NAME" != "null" ]; then
      RE_ID_NUM=\$(echo "\$RE_NAME" | grep -oE "[0-9]+$")
      curl -s -X DELETE -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" \
        "https://us-central1-aiplatform.googleapis.com/v1/\$RE_NAME?force=true" && echo "   ✅ Agent Engine instance deleted." || echo "   ⚠️  Failed to delete Agent Engine instance."
    else
      echo "   ⚠️  Agent Engine instance not found matching '${dirName}' or suffix '${suffix}'."
    fi

    echo ""
    echo "🌍 Deleting Gemini Enterprise registration (App/Agent)..."
    # Search all common locations
    for LOC in "global" "us" "eu"; do
      ENGINES_JSON=$(curl -s -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" \
        "https://discoveryengine.googleapis.com/v1alpha/projects/\$PROJECT_ID/locations/\$LOC/collections/default_collection/engines")
      
      # Try to find engine matching name directly in this location
      ENGINE_NAME=$(echo "\$ENGINES_JSON" | jq -r --arg dir "${dirName}" '.engines[]? | select(.displayName == $dir) | .name' 2>/dev/null | head -n 1)
      
      if [ ! -z "\$ENGINE_NAME" ] && [ "\$ENGINE_NAME" != "null" ]; then
        echo "   🗑 Deleting Gemini Enterprise App: \${dirName} (Location: \$LOC)..."
        curl -s -X DELETE -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" \
          "https://discoveryengine.googleapis.com/v1alpha/\$ENGINE_NAME" && echo "   ✅ Gemini Enterprise App deleted." || echo "   ⚠️  Failed to delete Gemini Enterprise App."
        break
      fi

      # 2. If no engine match, scan for individual agents within EXISTING engines in this location
      for E_NAME in $(echo "\$ENGINES_JSON" | jq -r '.engines[]? | .name'); do
        ASSISTANTS=$(curl -s -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" "https://discoveryengine.googleapis.com/v1alpha/\${E_NAME}/assistants")
        for A_NAME in $(echo "\$ASSISTANTS" | jq -r '.assistants[]? | .name'); do
          AGENTS_JSON=$(curl -s -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" "https://discoveryengine.googleapis.com/v1alpha/\${A_NAME}/agents?pageSize=100")
          TARGET_AGENT_NAME=$(echo "\$AGENTS_JSON" | jq -r --arg dir "${dirName}" --arg suf "${suffix}" --arg re "\$RE_ID_NUM" '.agents[]? | select(.displayName == $dir or (.displayName | endswith($suf)) or (.adkAgentDefinition.provisionedReasoningEngine.reasoningEngine | contains($re))) | .name' 2>/dev/null | head -n 1)
          
          if [ ! -z "\$TARGET_AGENT_NAME" ] && [ "\$TARGET_AGENT_NAME" != "null" ]; then
            echo "   🗑 Unregistering agent: \${TARGET_AGENT_NAME} (Location: \$LOC)..."
            curl -s -X DELETE -H "Authorization: Bearer \$TOKEN" -H "X-Goog-User-Project: \$PROJECT_ID" \
              "https://discoveryengine.googleapis.com/v1alpha/\$TARGET_AGENT_NAME" && echo "   ✅ Gemini Enterprise Agent unlisted." || echo "   ⚠️  Failed to unlist Gemini Enterprise Agent."
            break 3
          fi
        done
      done
    done
    
    echo ""
    echo "📂 Deleting local directory and uv cache: ~/${dirName}..."
    cd ~
    rm -rf ~/${dirName}
    rm -rf ~/.cache/uv
    echo "   ✅ Directory and UV cache deleted."
    
    echo ""
    echo "========================================================="
    echo "✅ CLEANUP COMPLETE"
    echo "========================================================="
    exit 0
  fi

# --- 1. Project Detection & Confirmation ---
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No default project found in your environment."
  echo "Please run 'gcloud config set project [PROJECT_ID]' first."
  exit 1
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

# --- 1.1 Authentication & Permissions Check ---
echo "🔐 Checking authentication..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null || echo "")
if [ -z "$PROJECT_NUMBER" ]; then
  echo "❌ Error: Could not retrieve project details. This usually means you are not authenticated or the project ID is invalid."
  echo "Please run the following commands and try again:"
  echo "  1. gcloud auth login"
  echo "  2. gcloud auth application-default login"
  exit 1
fi

echo "💾 Checking disk space..."
FREE_SPACE=$(df -k . | awk 'NR==2 {print $4}')
if [ "$FREE_SPACE" -lt 1048576 ]; then
  echo "⚠️  CRITICAL: Low disk space detected ($((FREE_SPACE/1024)) MB left)."
  echo "    Deployment will likely fail (needs ~1GB free)."
  echo "    Use the cleanup command to free up space:"
  echo "    bash \$0 --cleanup"
  echo ""
  read -p "Attempt to continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
fi

# --- 1.2 Deployment Choice ---
echo ""
echo "========================================================="
echo "🚀 DEPLOYMENT STRATEGY"
echo "========================================================="
echo "Select your deployment target:"
echo "  [1] Local (Recommended for quick testing via Cloud Shell)"
echo "      - Launches 'adk web' on a local port."
echo "      - Best for quick iteration."
echo ""
echo "  [2] Cloud Run (Public URL)"
echo "      - Deploys the agent to a public, unauthenticated URL."
echo "      - Automates API enablement, Docker build, and IAM roles."
echo "      - Warning: Organization policies may block public ingress."
echo ""
echo "  [3] Deploy to Gemini Enterprise"
echo "      - Automated Agent Engine deployment."
echo "      - Registers your agent to Gemini Enterprise."
echo ""
read -p "Enter Choice [1, 2 or 3] (Default: 1): " DEPLOY_CHOICE
DEPLOY_CHOICE=\${DEPLOY_CHOICE:-1}

# Immediate check for Gemini Enterprise
if [ "\$DEPLOY_CHOICE" = "3" ]; then
  echo ""
  echo "========================================================="
  echo "🤖 GEMINI ENTERPRISE PRE-DEPLOYMENT CHECK"
  echo "========================================================="
  echo "This option will automatically deploy to Agent Engine and"
  echo "register it to Gemini Enterprise."
  echo ""
  echo "⚠️  IMPORTANT: You MUST have a Gemini Enterprise instance"
  echo "   already created in this project."
  echo ""
  echo "If you haven't, please create one here first:"
  echo "https://console.cloud.google.com/gemini-enterprise/products?project=\$PROJECT_ID"
  echo ""
  read -p "Have you confirmed the instance exists? (y/n) " -n 1 -r
  echo
  if [[ ! \$REPLY =~ ^[Yy]$ ]]; then
      echo "Exiting. Please create the instance and run the script again."
      exit 1
  fi
fi

# --- 2. IAM & API Checks ---
echo "📡 Checking & Enabling APIs..."
gcloud services enable \\
  aiplatform.googleapis.com \\
  bigquery.googleapis.com \\
  apikeys.googleapis.com \\
  mapstools.googleapis.com \\
  discoveryengine.googleapis.com \\
  cloudresourcemanager.googleapis.com \\
  serviceusage.googleapis.com \\
  iam.googleapis.com \\
  cloudbilling.googleapis.com \\
  logging.googleapis.com \\
  monitoring.googleapis.com \\
  clouderrorreporting.googleapis.com \\
  telemetry.googleapis.com \\
  --project="$PROJECT_ID"

if [ "$DEPLOY_CHOICE" = "2" ]; then
  echo "📡 Enabling Cloud Run specific APIs..."
  gcloud services enable \\
    run.googleapis.com \\
    cloudbuild.googleapis.com \\
    artifactregistry.googleapis.com \\
    --project="$PROJECT_ID"
fi

# --- 2.1 Ensure Service Agent Ready ---
echo "🛡 Ensuring Reasoning Engine Service Agent exists..."
# Creating the service identity for AI Platform often triggers the specific RE SA as well
gcloud beta services identity create --service=aiplatform.googleapis.com --project="$PROJECT_ID" || true
# Give it a moment to stabilize
sleep 3

# --- 2.1 IAM Configuration for Reasoning Engine ---
echo "🔐 Configuring IAM permissions for Agent Engine..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
RE_SA="service-\${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"

# --- IAM Helper Functions ---
check_and_grant_role() {
  local project=$1
  local member=$2
  local role=$3
  local max_retries=3
  local retry_count=0
  
  while [ \$retry_count -lt \$max_retries ]; do
    echo "  Checking/Granting \$role..."
    gcloud projects add-iam-policy-binding "\$project" \\
      --member="serviceAccount:\$member" \\
      --role="\$role" --condition=None >/dev/null 2>&1 || true
    
    # Wait a moment for propagation before verification
    sleep 2
    
    # Verify the binding exists
    if gcloud projects get-iam-policy "\$project" \
        --flatten="bindings[].members" \
        --format="value(bindings.role)" \
        --filter="bindings.members:serviceAccount:\$member AND bindings.role:\$role" | grep -q "\$role"; then
      echo "    ✅ Core role confirmed."
      return 0
    fi
    
    retry_count=\$((retry_count + 1))
    echo "    ⚠️ Verification failed, retrying (\$retry_count/\$max_retries)..."
    sleep 3
  done
  echo "    ❌ ERROR: Failed to verify \$role after \$max_retries attempts."
  echo "       Please manually grant the role using this command:"
  echo "       gcloud projects add-iam-policy-binding \"\$project\" --member=\"serviceAccount:\$member\" --role=\"\$role\" --condition=None"
  return 1
}

# Grant specific roles required for MCP tool execution and BigQuery access
for ROLE in "roles/mcp.toolUser" "roles/bigquery.jobUser" "roles/bigquery.dataViewer" "roles/serviceusage.serviceUsageConsumer"; do
  check_and_grant_role "$PROJECT_ID" "\$RE_SA" "\$ROLE"
done

# If Cloud Run is selected, ensure the default compute service account has required permissions
if [ "$DEPLOY_CHOICE" = "2" ]; then
  echo "🔐 Configuring IAM permissions for Cloud Run Service Account..."
  COMPUTE_SA="\${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  for ROLE in "roles/mcp.toolUser" "roles/bigquery.jobUser" "roles/bigquery.dataViewer" "roles/serviceusage.serviceUsageConsumer" "roles/aiplatform.user" "roles/logging.logWriter" "roles/storage.admin" "roles/artifactregistry.writer" "roles/run.developer" "roles/iam.serviceAccountUser" "roles/iam.serviceAccountTokenCreator"; do
    check_and_grant_role "$PROJECT_ID" "\$COMPUTE_SA" "\$ROLE"
  done
fi

# Enable MCP services
echo "🔧 Enabling MCP services..."
gcloud beta services mcp enable bigquery.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true
gcloud beta services mcp enable mapstools.googleapis.com --project="$PROJECT_ID" 2>/dev/null || true

# --- 2.2 User-level IAM Configuration (for Cloud Shell users) ---
echo "🔐 Configuring user permissions for local execution..."
USER_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
# For Cloud Run deployment, the user needs roles to build and deploy
ROLES_TO_GRANT=("roles/mcp.toolUser" "roles/serviceusage.serviceUsageConsumer")
if [ "$DEPLOY_CHOICE" = "2" ]; then
  ROLES_TO_GRANT+=("roles/run.admin" "roles/cloudbuild.builds.builder" "roles/iam.serviceAccountUser" "roles/artifactregistry.admin")
fi

for ROLE in "\${ROLES_TO_GRANT[@]}"; do
  echo "  Granting \$ROLE to \$USER_ACCOUNT..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \\
    --member="user:\$USER_ACCOUNT" \\
    --role="\$ROLE" --condition=None >/dev/null 2>&1 || true
  echo "    ✅ Done"
done

# Check for BQ permissions (with timeout to prevent hanging on new projects)
echo "🛡 Checking permissions..."
CAN_MK_BQ=$(timeout 30 bq ls --project_id="$PROJECT_ID" 2>&1 || echo "timeout_or_error")
if [[ $CAN_MK_BQ == *"Access Denied"* ]]; then
  echo "❌ Error: Your account doesn't have BigQuery access in this project."
  exit 1
fi
echo "✅ Permissions OK"

# --- 3. Data Provisioning ---
${bqCommands}

# --- 4. Project Setup (Flat Structure) ---
if [ -d "${dirName}" ]; then
  echo "📂 Removing existing directory ${dirName} for a clean setup..."
  rm -rf "${dirName}"
fi

echo "📦 Setting up project directory..."
mkdir -p ${dirName}/adk_agent/mcp_app
cd ${dirName}

# Generate requirements.txt
cat <<'__REQ_EOF__' > requirements.txt
google-adk>=1.0.0
google-genai>=1.9.0
python-dotenv>=1.0.0
vertexai>=1.0.0
db-dtypes>=1.0.0
__REQ_EOF__

# Generate pyproject.toml required for adk project type
cat <<'__PYPROJ_EOF__' > pyproject.toml
[project]
name = "mcp-agent"
version = "0.1.0"
dependencies = ["google-adk>=1.0.0", "google-genai>=1.9.0"]
[tool.adk]
project_type = "agent"
__PYPROJ_EOF__

# Generate Dockerfile using uv for performance (PoC v9 style)
cat <<'__DOCKER_EOF__' > Dockerfile
FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app
COPY requirements.txt pyproject.toml ./
RUN uv pip install --system -r requirements.txt
COPY . .
ENV PORT 8080
ENV GOOGLE_GENAI_USE_VERTEXAI=1
ENV PYTHONUNBUFFERED=1
CMD ["adk", "web", "adk_agent", "--host", "0.0.0.0", "--port", "8080"]
__DOCKER_EOF__

# --- 5. Environment Setup ---
echo "📦 Preparing environment..."
# We always prepare the environment regardless of choice to ensure local testing works
if ! command -v uv >/dev/null 2>&1; then
    echo "    installing uv via astral.sh..."
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1 || true
    # Add to current PATH for the rest of the script
    export PATH="\$HOME/.cargo/bin:\$PATH"
fi
# Set UV to copy mode to prevent cross-filesystem hardlink failures (os error 28)
export UV_LINK_MODE=copy
uv cache clean >/dev/null 2>&1
uv venv
if ! uv pip install --no-cache -r requirements.txt; then
  echo ""
  echo "❌ ERROR: Installation failed."
  echo "   This is often caused by 'No space left on device'."
  echo "   Please run 'bash $0 --cleanup' to free up space and try again."
  exit 1
fi

# --- 6. Generate Maps API Key ---
echo "🔑 Generating Maps API key..."
API_KEY_JSON=$(gcloud alpha services api-keys create --display-name="MCP-Demo-Key-${suffix}" \\
    --api-target=service=mapstools.googleapis.com \\
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

# Create .env in the root
cat <<__ENV_EOF__ > .env
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT="$PROJECT_ID"
GOOGLE_CLOUD_LOCATION="global"
DEMO_DATASET="${datasetId}"
MAPS_API_KEY="$API_KEY"
PYTHONUNBUFFERED=1
GRPC_ENABLE_FORK_SUPPORT=1
__ENV_EOF__

# Symlink .env to packages for visibility
ln -sf ../.env adk_agent/.env
ln -sf ../../.env adk_agent/mcp_app/.env

# Ignore large directories to prevent Reason Engine payload bloating
cat <<'__GITIGNORE_EOF__' > adk_agent/.gitignore
.venv/
.venv
__pycache__/
*.pyc
*.pyo
.pytest_cache/
__GITIGNORE_EOF__

# Create __init__.py files for proper Python package structure
touch adk_agent/__init__.py
cat <<'__INIT_EOF__' > adk_agent/mcp_app/__init__.py
from . import agent
__INIT_EOF__


# --- 7. Customizing Agent ---
echo "🔧 Configuring agent..."



cat <<'__TOOLS_EOF__' > adk_agent/mcp_app/tools.py
import os
import asyncio
import dotenv
import google.auth
import google.auth.transport.requests
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
from google.adk.tools.mcp_tool.mcp_tool import MCPTool
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
import httpx
import anyio
import time

# Enforce sequential execution across all tools to prevent session termination
_tool_semaphore = asyncio.Semaphore(1)

def get_project_id():
    """Robustly retrieves the project ID from env, .env, or credentials."""
    # 1. Direct env
    pid = os.getenv("GOOGLE_CLOUD_PROJECT")
    if pid: return pid
    
    # 2. Try loading .env from root or package
    dotenv.load_dotenv()
    pid = os.getenv("GOOGLE_CLOUD_PROJECT")
    if pid: return pid
    
    # 3. Fallback to auth default
    try:
        _, pid = google.auth.default()
        if pid: return pid
    except: pass
    return "UNKNOWN"

# =============================================================================
# 🛡️ Stability Patches for Reasoning Engine (Mandatory)
# =============================================================================

_orig_client_init = httpx.AsyncClient.__init__
def _patched_client_init(self, *args, **kwargs):
    kwargs['http2'] = False 
    # Use long timeouts for stable MCP sessions (300s)
    kwargs['timeout'] = httpx.Timeout(300.0, connect=60.0)
    return _orig_client_init(self, *args, **kwargs)

_token_cache = {"token": None, "expiry": 0}
_token_lock = asyncio.Lock()

async def _get_fresh_mcp_token():
    """Retrieves a fresh access token with async-safe caching."""
    global _token_cache
    async with _token_lock:
        now = time.time()
        if _token_cache["token"] and now < _token_cache["expiry"]:
            return _token_cache["token"]
        try:
            scopes = ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/bigquery"]
            credentials, _ = google.auth.default(scopes=scopes)
            # Run blocking refresh in a thread to avoid stalling the event loop
            await anyio.to_thread.run_sync(credentials.refresh, google.auth.transport.requests.Request())
            _token_cache = {"token": credentials.token, "expiry": now + 1800}
            return credentials.token
        except: return ""

_orig_send = httpx.AsyncClient.send
async def _patched_send(self, request, *args, **kwargs):
    # BigQuery MCP Auth Injection
    if "bigquery.googleapis.com/mcp" in str(request.url):
        token = await _get_fresh_mcp_token()
        if token: request.headers['Authorization'] = f"Bearer {token}"
            
    # Execute actual request
    response = await _orig_send(self, request, *args, **kwargs)
    
    # Error Transmutation (Prevent crash on recoverable tool errors)
    if response.status_code in [400, 403] and "bigquery.googleapis.com/mcp" in str(request.url):
        try:
            body = await response.aread()
            if b'"jsonrpc":' in body: response.status_code = 200
            response._content = body
        except: pass
    return response

# Apply Stability Patches
try:
    # 1. HTTP/2 Disable for stability
    httpx.AsyncClient.__init__ = _patched_client_init
    httpx.AsyncClient.send = _patched_send
    
    # 2. Sequential MCP Initialization Patch
    _orig_get_tools = MCPToolset.get_tools
    async def _patched_get_tools(self, *args, **kwargs):
        async with _tool_semaphore:
            return await _orig_get_tools(self, *args, **kwargs)
    MCPToolset.get_tools = _patched_get_tools

    # 3. Deep Drip & Global Lock Recovery (Phase 4)
    try:
        _orig_run_async = MCPTool.run_async
        async def _patched_run_async(self, *args, **kwargs):
            # The lock must surround the ENTIRE retry loop to prevent concurrent 
            # "retry stampedes" that crash the session manager.
            async with _tool_semaphore:
                max_retries = 3
                for attempt in range(max_retries + 1):
                    try:
                        result = await _orig_run_async(self, *args, **kwargs)
                        # [Deep Drip] Add a small delay AFTER success to let the SSE pipe breathe
                        await asyncio.sleep(1.5)
                        return result
                    except Exception as e:
                        err_msg = str(e).lower()
                        # Catch both explicit McpError and raw strings from lower levels
                        if ("session terminated" in err_msg or "mcperror" in err_msg or "broken pipe" in err_msg or "protocol error" in err_msg or "eos" in err_msg) and attempt < max_retries:
                            backoff_time = 5 * (2 ** attempt)
                            print(f"  [DEBUG] MCP Session failure: {err_msg}. Recovering ({attempt + 1}/{max_retries})... Waiting {backoff_time}s")
                            await asyncio.sleep(backoff_time) 
                            continue
                        elif '429' in str(e) or 'resource exhausted' in err_msg:
                            if attempt < max_retries:
                                backoff_time = 5 * (2 ** attempt)
                                print(f"  [DEBUG] ⚠️ MCP Resource exhausted (429). Cooling down for {backoff_time}s...")
                                await asyncio.sleep(backoff_time)
                                continue
                        raise
        MCPTool.run_async = _patched_run_async
    except Exception as e:
        print(f"  [DEBUG] Failed to patch MCPTool.run_async: {e}")

except Exception as e:
    print(f"  [DEBUG] Stability patches not applied: {e}")


# Prevent AnyIO cross-task cancellation errors
import anyio._backends._asyncio
_orig_cancel_exit = anyio._backends._asyncio.CancelScope.__exit__
def _patched_cancel_exit(self, etype, exc, tb):
    try: return _orig_cancel_exit(self, etype, exc, tb)
    except RuntimeError as e:
        if "different task" in str(e): return False
        raise
anyio._backends._asyncio.CancelScope.__exit__ = _patched_cancel_exit

# Prevent telemetry serialization failures for complex tool outputs
try:
    from opentelemetry.sdk.trace import Span
    import json
    def _safe_stringify(value):
        if isinstance(value, (dict, list)):
            try: return json.dumps(value, ensure_ascii=False, default=str)
            except: return str(value)
        return value
    _orig_set_attribute = Span.set_attribute
    def _patched_set_attribute(self, key, value):
        return _orig_set_attribute(self, key, _safe_stringify(value))
    Span.set_attribute = _patched_set_attribute
except: pass

# =============================================================================
# 🔧 MCP Toolset Configuration
# =============================================================================
def get_maps_mcp_url():
    """Returns the base Maps MCP URL."""
    return "https://mapstools.googleapis.com/mcp"

def get_bigquery_mcp_url():
    """Returns the project-scoped BigQuery MCP URL using a query parameter."""
    project_id = get_project_id()
    # Using ?project= query parameter as the header alone was insufficient for public datasets
    return f"https://bigquery.googleapis.com/mcp?project={project_id}"

def get_bigquery_mcp_toolset():
    """Creates a BigQuery MCP toolset. URL is project-scoped to ensure quota/perms."""
    project_id = get_project_id()
    url = get_bigquery_mcp_url()
    if project_id == "UNKNOWN":
        print("  [CRITICAL] GOOGLE_CLOUD_PROJECT is missing! MCP calls will likely fail.")
        
    return MCPToolset(connection_params=StreamableHTTPConnectionParams(
        url=url, 
        headers={"x-goog-user-project": project_id},
        timeout=300
    ))

def get_maps_mcp_toolset():
    """Creates a Google Maps MCP toolset."""
    dotenv.load_dotenv()
    maps_api_key = os.getenv('MAPS_API_KEY')
    project_id = get_project_id()
    url = get_maps_mcp_url()
    return MCPToolset(connection_params=StreamableHTTPConnectionParams(
        url=url, 
        headers={
            "x-goog-api-key": maps_api_key
        },
        timeout=300
    ))
__TOOLS_EOF__

cat <<__AGENT_EOF__ > adk_agent/mcp_app/agent.py
import os

# =============================================================================
# Environment Configuration
# Force project ID and location BEFORE importing ADK/genai
# =============================================================================
os.environ["GOOGLE_CLOUD_PROJECT"] = "$PROJECT_ID"
# Force global location for Gemini 3 models
os.environ["GOOGLE_CLOUD_LOCATION"] = "global"

import dotenv
dotenv.load_dotenv()

from . import tools
from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import types

PROJECT_ID = "$PROJECT_ID"

maps_toolset = tools.get_maps_mcp_toolset()
bigquery_toolset = tools.get_bigquery_mcp_toolset()

# =============================================================================
# AGENT CONFIGURATION (Zero-Formatting Instruction Pattern)
# =============================================================================
# We intentionally avoid Python f-strings or .format() here to prevent crashes
# when the generated System Instruction contains literal curly braces {}.
# =============================================================================

base_instruction = """
Help the user answer questions by strategically combining insights from BigQuery and Google Maps:

1. **BigQuery Toolset**: Access data in the [PROJECT_ID].[DATASET_ID] dataset.
   - Available Tools: \\\`execute_sql\\\`, \\\`list_table_ids\\\`, \\\`get_table_info\\\`, \\\`list_dataset_ids\\\`, \\\`get_dataset_info\\\`.
   - DATASET ISOLATION (CRITICAL): You MUST ONLY access the \\\`[DATASET_ID]\\\` dataset. DO NOT use \\\`list_dataset_ids\\\` to discover other datasets. DO NOT query any dataset other than \\\`[DATASET_ID]\\\` (except public datasets when explicitly instructed). If a user asks about data not in \\\`[DATASET_ID]\\\`, inform them that only this dataset is available for this demo.
[PUBLIC_DATASET_INFO]

[GENERATED_SYSTEM_INSTRUCTION]

- REFERENCE DATE: The current date for this demo is [REFERENCE_DATE]. Use this for absolute time references (e.g., 'today', 'last month').

2. **Maps Toolset**: Real-world location analysis.
   - Available Tools: \\\`compute_routes\\\`, \\\`get_place\\\`, \\\`search_places\\\`, \\\`geocode\\\`, \\\`reverse_geocode\\\`.
   - IMPORTANT: There is NO weather tool. Do not hallucinate or attempt to use weather services.

---------------------------------------------------
CRITICAL OPERATIONAL RULES:
- DATA DISCOVERY & ACCURACY (HIGHEST PRIORITY): 
    * ADAPTIVE DISCOVERY: Use \\\`get_table_info\\\` only when necessary to confirm schemas for a specific query. 
    * DO NOT ASSUME column names (e.g., 'region', 'category', 'prefecture') exist without checking. Hallucinating columns causes fatal errors.
    * AUTONOMOUS ERROR RECOVERY: If a SQL query fails, DO NOT ask the user for help immediately. Instead, output a status message explaining the error (e.g. "⚠️ Query failed due to column mismatch. Re-checking schema..."), then re-run \\\`get_table_info\\\` to verify schema, explore values with \\\`SELECT DISTINCT\\\`, and fix the query yourself. Be relentless in finding the correct data.
    * VALUE EXPLORATION: For unfamiliar columns, run \\\`SELECT DISTINCT column LIMIT 10\\\` to identify valid values.
- EXECUTION FLOW: 
    * REACTIVE BEHAVIOR: Always wait for a specific user request or question before starting data analysis or tool execution. Respond to greetings with a friendly message and a brief offer of help.
    * MULTI-STEP PLANNING: For complex requests, summarize your planned steps in 1-2 sentences before starting the first tool execution. This keeps the user informed of your reasoning path.
    * RANGE QUERIES & DISCOVERY (STRICT RULE): If you need to analyze a time range (e.g., 'first two weeks') or discover unique values for a column, you MUST query ONLY THE SMALLEST PRACTICAL SUBSET (e.g., first day or LIMIT 10) first to verify data density and schema. DO NOT 'gulp' large ranges or entire columns in a single response, as this crashes the data pipe.
    * GULP PREVENTION (MANDATORY): EVERY \\\`execute_sql\\\` query MUST include a \\\`LIMIT 100\\\` or smaller unless you are explicitly counting rows. Never attempt to retrieve thousands of rows at once.
    * SELECT ONLY: Only SELECT statements are supported. Do not attempt INSERT, UPDATE, or DELETE.
    * SEQUENTIAL EXECUTION (MANDATORY): You MUST call exactly ONE tool per response and wait for its output. Proposing multiple tools (parallelism) is COMPLETELY FORBIDDEN and triggers fatal session termination by the infrastructure. Slow, steady progress is the only way to succeed.
- GEOSPATIAL CONTEXT: Use specific location data from BigQuery (city, state, etc.) in Maps tool calls to ensure accuracy.
- PROGRESS UPDATES (MANDATORY): You MUST output a brief status message with an emoji BEFORE every single tool call (e.g., "📊 Checking schema...", "🔍 Running SQL...", "🗺️ Calculating routes..."). This is critical for the user to see your progress in the UI. Even if you are repeating a step, report it.
- PUBLIC DATASET ACCESS (CRITICAL):
    * The projectId argument in ALL BigQuery tool calls MUST ALWAYS be YOUR project ID ([PROJECT_ID]). NEVER use "bigquery-public-data" as projectId.
    * Access public tables ONLY via \\\`execute_sql\\\` using fully qualified names (e.g., \\\`bigquery-public-data.google_trends.top_terms\\\`).
---------------------------------------------------
"""

public_info = "- Additional Dataset: Use [PUBLIC_DATASET_ID] for context." if "[PUBLIC_DATASET_ID]" else ""

# Embedding instruction directly (Reverted from separate file approach)
gen_instruction = r"""
${rawInstruction}
"""

instruction = base_instruction\
    .replace("[PROJECT_ID]", PROJECT_ID)\
    .replace("[DATASET_ID]", "${datasetId}")\
    .replace("[REFERENCE_DATE]", "${referenceDate}")\
    .replace("[PUBLIC_DATASET_INFO]", public_info.replace("[PUBLIC_DATASET_ID]", "${publicDatasetId || ''}"))\
    .replace("[GENERATED_SYSTEM_INSTRUCTION]", gen_instruction)

# Configure the model with automatic retries for 429/5xx errors
gemini_model = Gemini(
    model="gemini-3.1-pro-preview",
    retry_options=types.HttpRetryOptions(
        attempts=8,              # Increase attempts to handle higher load
        initial_delay=2.0,       # Initial backoff delay
        max_delay=60.0,          # Cap wait time at 60s
        exp_base=2.0,            # Exponential backoff
        http_status_codes=[429]  # Explicitly retry on Resource Exhausted
    )
)

root_agent = LlmAgent(
    model=gemini_model,
    name='root_agent',
    instruction=instruction,
    tools=[maps_toolset, bigquery_toolset]
)

# Export only the root_agent. 
# The 'uvx agent-starter-pack enhance' command will automatically wrap this
# in an App container and generate the entry point for Agent Engine.
__all__ = ["root_agent"]
__AGENT_EOF__


# --- 8. Agent Engine & Gemini Enterprise Infrastructure ---
if [ "$DEPLOY_CHOICE" = "3" ]; then
  # Automate 'agent-starter-pack enhance'
  echo ""
  echo "🔧 Initializing Agent Engine infrastructure..."
  # We MUST be in the adk_agent directory for enhance to handle mcp_app correctly
  cd adk_agent
  export UV_LINK_MODE=copy
  printf '\n\n\n\n\n\n\n' | uvx --no-cache agent-starter-pack enhance
  
  # Apply naming fixes (Robust regex for different quote styles and separators)
  echo "🔧 Applying project name customizations..."
  rm -f .resource_name
  # Replace name in adk_agent/pyproject.toml (Tool normalizes adk_agent -> adk-agent)
  perl -pi -e "s/name *= *[\\\"']adk[-_]agent[\\\"']/name = \\\"${dirName}\\\"/" pyproject.toml
  # Replace default name in deploy.py
  perl -pi -e "s/default *= *[\\\"']adk[-_]agent[\\\"']/default=\\\"${dirName}\\\"/" mcp_app/app_utils/deploy.py 2>/dev/null || true
  cd ..
fi

# --- 9. Final Launch & Tips ---
if [ "$DEPLOY_CHOICE" = "3" ]; then
  echo ""
  echo "========================================================="
  echo "🚀 DEPLOYING TO GEMINI ENTERPRISE"
  echo "========================================================="
  
  echo "🤖 Step 1/2: Deploying to Vertex AI Agent Engine..."
  cd adk_agent
  make deploy
  
  echo ""
  echo "🤖 Step 2/2: Registering Agent to Gemini Enterprise..."
  # Count apps across all common locations
  TOKEN=$(gcloud auth print-access-token)
  APP_COUNT=0
  for LOC in "global" "us" "eu"; do
    JSON=$(curl -s -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: $PROJECT_ID" \
        "https://discoveryengine.googleapis.com/v1alpha/projects/$PROJECT_ID/locations/$LOC/collections/default_collection/engines")
    COUNT=$(echo "$JSON" | jq -r ".engines | length" 2>/dev/null || echo "0")
    APP_COUNT=$((APP_COUNT + COUNT))
  done
  
  if [ "$APP_COUNT" = "1" ]; then
    echo "✅ Found exactly one Gemini Enterprise app. Automating registration..."
    # Y (Agent ID) -> Y (Project ID) -> 1 (App Selection) -> Any subsequent defaults (yes "")
    (printf "Y\\nY\\n1\\n"; yes "") | make register-gemini-enterprise
  else
    if [ "$APP_COUNT" = "0" ]; then
      echo "⚠️ No Gemini Enterprise apps found in 'global', 'us', or 'eu'. You might need to create one first."
    else
      echo "💡 Found $APP_COUNT apps across regions. Please select one manually:"
    fi
    # Fallback: Automated defaults (Y, Y) + interactive app selection
    (printf "Y\\nY\\n"; cat) | make register-gemini-enterprise
  fi

  cd ..
  
  clear
  echo "========================================================="
  echo "🎉 Gemini Enterprise Deployment & Registration Complete!"
  echo "========================================================="
  echo ""
  echo "📂 Project directory: ${dirName}"
  echo ""
  echo "🔗 View in Console:"
  echo "   https://console.cloud.google.com/gemini-enterprise/overview?project=$PROJECT_ID"
  echo ""
  echo "========================================================="
  echo "💡 TIPS:"
  echo "   • Your agent is now available in your Gemini Enterprise organization."
  echo "   • To CLEANUP:        bash setup-${dirName}.sh --cleanup"
  echo "========================================================="
  exit 0
fi

if [ "$DEPLOY_CHOICE" = "2" ]; then
  echo "🚀 Deploying to Cloud Run (this will take 2-3 minutes)..."
  # Note: --set-env-vars is used to inject the runtime configuration
  # Deploy to Cloud Run (Unauthenticated / IAP-less)
  SERVICE_NAME="${dirName}"
  gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --ingress all \
    --service-account "\${COMPUTE_SA}" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,MAPS_API_KEY=$API_KEY" \
    --quiet

  # Get the URL and append the auto-selection parameter for mcp_app
  BASE_URL=$(gcloud run services describe "$SERVICE_NAME" --region us-central1 --format='value(status.url)')
  SERVICE_URL="\${BASE_URL}/dev-ui/?app=mcp_app"
  
  clear
  echo "========================================================="
  echo "🎉 Cloud Run Deployment Complete!"
  echo "========================================================="
  echo ""
  echo "📂 Project directory: ${dirName}"
  echo "🌐 Public URL: \$SERVICE_URL"
  echo ""
  echo "========================================================="
  echo "💡 TIPS:"
  echo "   • The agent is now live at the URL above."
  echo "   • To CLEANUP:        bash setup-${dirName}.sh --cleanup"
  echo "========================================================="
  exit 0
fi

# --- Local Launch Logic ---
is_port_busy() {
  local port=\$1
  # Method 1: lsof (Standard on Mac)
  if command -v lsof >/dev/null 2>&1; then
    lsof -Pi :\$port -sTCP:LISTEN -t >/dev/null 2>&1 && return 0
  fi
  # Method 2: Python socket (Reliable fallback)
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1', \$port))" >/dev/null 2>&1 || return 0
  fi
  return 1
}

find_free_port() {
  local port=\$1
  while is_port_busy \$port; do
    port=\$((port + 1))
  done
  echo "\$port"
}

START_PORT=8000
if [ "$CLOUD_SHELL" = "true" ]; then START_PORT=8080; fi
PORT=$(find_free_port \$START_PORT)

clear
echo "========================================================="
echo "🎉 Local Setup Complete!"
echo "========================================================="
echo ""
echo "📂 Project directory: ${dirName}"
echo "🚀 Launching the Agent UI on port \$PORT..."
echo "   (Pre-configured for project: \$PROJECT_ID)"
if [ "$CLOUD_SHELL" = "true" ]; then
  echo ""
  echo "💡 CLOUD SHELL TIP:"
  echo "   Use the 'Web Preview' button (top right) and select 'Change port' to \$PORT."
fi
echo ""
echo "========================================================="
echo "💡 TIPS:"
echo "   • To STOP the UI:    Press Ctrl+C"
echo "   • To RESTART the UI: Run the following commands:"
echo ""
echo "     cd ~/${dirName}/adk_agent"
echo "     ../.venv/bin/adk web --port \$PORT"
echo ""
echo "   • To CLEANUP:        bash setup-${dirName}.sh --cleanup"
echo ""
echo "========================================================="
echo ""

cd adk_agent
../.venv/bin/adk web --port \$PORT
`;
}

// ===========================================
// Vertex AI & Utilities
// ===========================================

function callVertexAIWithRetry(prompt) { return executeWithRetry(() => callVertexAI(prompt)); }

function callVertexAI(prompt) {
  let location = CONFIG.LOCATION || 'global';
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${CONFIG.PROJECT_ID}/locations/${location}/publishers/google/models/${CONFIG.MODEL}:generateContent`;
  
  const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 65535 } };
  const response = UrlFetchApp.fetch(url, { method: 'POST', contentType: 'application/json', headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify(payload), muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error(`AI Error: ${response.getContentText()}`);
  return JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
}

/**
 * Calls Vertex AI with Google Search grounding enabled.
 * Used for discovering real BigQuery public dataset IDs.
 */
function callVertexAIWithSearch(prompt) {
  let location = CONFIG.LOCATION || 'global';
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${CONFIG.PROJECT_ID}/locations/${location}/publishers/google/models/${CONFIG.MODEL}:generateContent`;
  
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error(`AI Search Error: ${response.getContentText()}`);
  return JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
}


function executeWithRetry(fn) {
  let lastError;
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try { return fn(); } catch (error) { lastError = error; Utilities.sleep(CONFIG.RETRY_DELAY_MS * attempt); }
  }
  throw lastError;
}




/**
 * Fetches recent commit history from GitHub API as update logs.
 * Fallbacks to static CONFIG.UPDATE_LOG if API fails.
 */
function fetchGitLogs() {
  const repoUrl = 'https://api.github.com/repos/ryotat7/ge-demo-generator/commits';
  try {
    const response = UrlFetchApp.fetch(repoUrl + '?per_page=10', {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (response.getResponseCode() === 200) {
      const commits = JSON.parse(response.getContentText());
      return commits.map(c => {
        const msg = c.commit.message.split('\n')[0];
        const versionMatch = msg.match(/v\d+\.\d+\.\d+/);
        const version = versionMatch ? versionMatch[0] : c.sha.substring(0, 7);
        
        return {
          version: version,
          date: c.commit.author.date.split('T')[0],
          note: msg
        };
      });
    }
  } catch (e) {
    // console.log('GitHub API Error:', e.message);
  }
  return CONFIG.UPDATE_LOG; 
}

function updateSystemInstruction(setupScript, newInstruction) {
  const escaped = newInstruction.replace(/\\/g, '\\\\').replace(/'/g, "'\\''").replace(/\n/g, '\\n');
  return setupScript.replace(/(1\.\s+\*\*BigQuery toolset:\*\*.*?\n)([\s\S]*?)(\n\s+2\.\s+\*\*Maps Toolset:\*\*)/, `$1${escaped}$3`);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
