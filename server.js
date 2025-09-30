// Monday.com API MCP Connection v8.0 - Enhanced Navigation & Gantt Chart
// File: server8.js

const express = require("express");
const fetch = require("node-fetch");
const app = express();
const port = process.env.PORT || 3000;

// Monday.com API Configuration
const MONDAY_CONFIG = {
  apiUrl: "https://api.monday.com/v2",
  apiToken: process.env.MONDAY_API_TOKEN,
  apiVersion: "2023-04",

  // Rate limiting info
  rateLimit: {
    requests: 5000,
    period: 60, // seconds (per minute)
  },
};

// In-memory cache for boards, items, etc.
let mondayCache = {
  boards: [],
  users: [],
  teams: [],
  lastUpdated: null,
};

app.use(express.json());
app.use(express.static("public"));

// Make authenticated GraphQL request to Monday.com
async function makeMondayRequest(query, variables = {}) {
  try {
    console.log("📡 Making Monday.com API request...");

    const response = await fetch(MONDAY_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: MONDAY_CONFIG.apiToken,
        "API-Version": MONDAY_CONFIG.apiVersion,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const data = await response.json();

    console.log("📥 Monday.com API response status:", response.status);

    if (!response.ok) {
      console.error("❌ HTTP Error:", response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (data.errors) {
      console.error("❌ GraphQL Errors:", data.errors);
      throw new Error(data.errors.map((e) => e.message).join(", "));
    }

    console.log("✅ Monday.com API request successful");
    return data.data;
  } catch (error) {
    console.error("❌ Monday.com API error:", error);
    throw error;
  }
}

// Test API connection
async function testMondayConnection() {
  try {
    const query = `
    query {
        me {
            id
            name
            email
        }
    }
`;

    const result = await makeMondayRequest(query);
    return result;
  } catch (error) {
    throw new Error(`Connection test failed: ${error.message}`);
  }
}

// Homepage with Monday.com interface - Enhanced Navigation
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Monday.com API MCP Connection v8.0 - Enhanced Navigation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #FF5722 0%, #FF7043 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h1 { color: #2d3748; text-align: center; margin-bottom: 30px; }
        .section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .section h3 { margin-top: 0; color: #4a5568; }
        .status {
            padding: 12px;
            border-radius: 6px;
            margin: 10px 0;
            font-weight: 500;
        }
        .status.connected { background: #ecfdf5; border: 1px solid #10b981; color: #047857; }
        .status.disconnected { background: #fef2f2; border: 1px solid #ef4444; color: #dc2626; }
        .status.pending { background: #fffbeb; border: 1px solid #f59e0b; color: #d97706; }
        button {
            background: #FF5722;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        button:hover { background: #FF7043; }
        button:disabled { background: #9ca3af; cursor: not-allowed; }
        .result {
            background: #1f2937;
            color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
            margin: 10px 0;
        }
        .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin: 15px 0;
        }
        .highlight { background: #fef3c7; padding: 2px 4px; border-radius: 3px; }
        .board-card {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            background: white;
        }
        .board-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .board-name {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
        }
        .clickable-project {
            cursor: pointer;
            transition: color 0.2s ease;
        }
        .clickable-project:hover {
            color: #FF5722;
            text-decoration: underline;
        }
        .board-stats {
            display: flex;
            gap: 15px;
            margin-top: 10px;
        }
        .stat {
            background: #f3f4f6;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
        }
        .tab-button {
            background: #f3f4f6;
            color: #4a5568;
            border: none;
            padding: 8px 16px;
            margin: 0 2px;
            border-radius: 6px 6px 0 0;
            cursor: pointer;
        }
        .tab-button.active {
            background: #FF5722;
            color: white;
        }
        .tab-content {
            display: none;
            background: #f8fafc;
            padding: 20px;
            border-radius: 0 8px 8px 8px;
        }
        .tab-content.active {
            display: block;
        }
        /* Enhanced Navigation Styles */
        .navigation-breadcrumb {
            background: #e0f2fe;
            border: 2px solid #0ea5e9;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            display: none;
        }
        .breadcrumb-item {
            display: inline-block;
            margin-right: 10px;
            padding: 5px 10px;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            color: #0ea5e9;
            font-weight: bold;
        }
        .breadcrumb-item:hover {
            background: #f0f9ff;
        }
        .breadcrumb-item.current {
            background: #0ea5e9;
            color: white;
            cursor: default;
        }
        .breadcrumb-separator {
            margin: 0 5px;
            color: #64748b;
        }
        /* Toggle functionality styles */
        .toggle-btn {
            background: none;
            border: none;
            font-size: 14px;
            cursor: pointer;
            padding: 0;
            margin-right: 10px;
            vertical-align: middle;
        }
        .toggle-btn:hover {
            transform: scale(1.1);
        }
        .subitems-container {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 6px;
            padding: 15px;
            display: none;
        }
        .subitem-card {
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 10px;
            margin: 8px 0;
        }
        /* User filter styles */
        .filter-section {
            background: #e3f2fd;
            border: 2px solid #2196f3;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .filter-controls {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        .filter-label {
            font-weight: bold;
            color: #1976d2;
        }
        .user-select {
            padding: 8px 12px;
            border: 1px solid #2196f3;
            border-radius: 4px;
            background: white;
            font-size: 14px;
            min-width: 200px;
        }
        .open-btn {
            background: #2196f3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }
        .open-btn:hover {
            background: #1976d2;
        }
        .filter-status {
            font-style: italic;
            color: #666;
            margin-left: 10px;
        }

        /* Gantt Chart Styles */
        .gantt-section {
            background: #f0f9ff;
            border: 2px solid #0ea5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            display: none;
        }

        .gantt-controls {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .gantt-btn {
            background: #0ea5e9;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }

        .gantt-btn:hover {
            background: #0284c7;
        }

        .gantt-btn:disabled {
            background: #94a3b8;
            cursor: not-allowed;
        }

        .gantt-container {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow-x: auto;
            max-height: 600px;
            overflow-y: auto;
        }

        .gantt-header {
            display: grid;
            grid-template-columns: 300px 1fr;
            background: #f8fafc;
            border-bottom: 2px solid #e2e8f0;
            font-weight: bold;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .gantt-header-left {
            padding: 15px;
            border-right: 1px solid #e2e8f0;
        }

        .gantt-header-right {
            display: flex;
            min-width: 800px;
        }

        .gantt-month {
            flex: 1;
            padding: 15px;
            text-align: center;
            border-right: 1px solid #e2e8f0;
            background: #f1f5f9;
        }

        .gantt-row {
            display: grid;
            grid-template-columns: 300px 1fr;
            border-bottom: 1px solid #f1f5f9;
        }

        .gantt-row:hover {
            background: #f8fafc;
        }

        .gantt-project {
            padding: 12px;
            border-right: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .gantt-project-name {
            font-weight: bold;
            color: #1e293b;
            font-size: 14px;
            cursor: pointer;
        }

        .gantt-project-name:hover {
            color: #FF5722;
        }

        .gantt-project-info {
            font-size: 12px;
            color: #64748b;
        }

        .gantt-timeline {
            display: flex;
            align-items: center;
            position: relative;
            min-width: 800px;
            padding: 8px 0;
        }

        .gantt-bar {
            position: absolute;
            height: 24px;
            border-radius: 4px;
            color: white;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            min-width: 2%;
            z-index: 5;
        }

        .gantt-bar.status-active {
            background: linear-gradient(45deg, #10b981, #059669);
            border: 1px solid #047857;
        }

        .gantt-bar.status-planned {
            background: linear-gradient(45deg, #3b82f6, #2563eb);
            border: 1px solid #1d4ed8;
        }

        .gantt-bar.status-delayed {
            background: linear-gradient(45deg, #ef4444, #dc2626);
            border: 1px solid #b91c1c;
        }

        .gantt-no-dates {
            color: #f59e0b;
            font-style: italic;
            padding: 8px 16px;
            font-size: 12px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            margin: 4px 0;
        }

        .gantt-legend {
            display: flex;
            gap: 20px;
            margin-top: 15px;
            flex-wrap: wrap;
        }

        .gantt-legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }

        .gantt-legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }

        /* Single project drill-down styles */
        .project-detail-section {
            background: #f0fdf4;
            border: 2px solid #22c55e;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            display: none;
        }

        .project-detail-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 20px;
        }

        .back-btn {
            background: #6b7280;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            margin-right: 15px;
        }

        .back-btn:hover {
            background: #4b5563;
        }

        .project-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
        }

        .project-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }

        .meta-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #d1d5db;
        }

        .meta-label {
            font-size: 12px;
            color: #6b7280;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .meta-value {
            font-size: 16px;
            color: #1f2937;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Monday.com API MCP Connection v8.0</h1>
        
        <!-- Connection Status -->
        <div class="section">
            <h3>🔗 Connection Status</h3>
            <div id="connectionStatus" class="status disconnected">
                ❌ Not Connected - Need to authenticate first
            </div>
            <p><strong>Monday.com Configuration:</strong></p>
            <ul>
                <li>API URL: ${MONDAY_CONFIG.apiUrl}</li>
                <li>API Version: ${MONDAY_CONFIG.apiVersion}</li>
                <li>Rate Limit: ${
                  MONDAY_CONFIG.rateLimit.requests
                } requests per minute</li>
                <li>API Token: <span id="tokenStatus">${
                  MONDAY_CONFIG.apiToken ? "Configured" : "Not set"
                }</span></li>
            </ul>
        </div>

        <!-- Authentication Test -->
        <div class="section">
            <h3>🔍 Step 1: Test Connection</h3>
            <p>Test your Monday.com API connection and get account info:</p>
            <button onclick="testConnection()">🚀 Test Monday.com Connection</button>
            <div id="connectionResult"></div>
        </div>

        <!-- Enhanced Navigation Breadcrumb -->
        <div class="navigation-breadcrumb" id="navigationBreadcrumb">
            <div class="breadcrumb-item current" id="breadcrumbAll" onclick="navigateToAll()">
                👥 All Users
            </div>
        </div>

        <!-- Main Data Tabs -->
        <div class="section">
            <h3>📊 Step 2: Explore Your Monday.com Data</h3>
            
            <!-- Tab Navigation -->
            <div>
                <button class="tab-button active" onclick="showTab('boards')">📋 Boards</button>
                <button class="tab-button" onclick="showTab('items')">📝 Items</button>
                <button class="tab-button" onclick="showTab('users')">👥 Users</button>
                <button class="tab-button" onclick="showTab('updates')">💬 Updates</button>
                <button class="tab-button" onclick="showTab('analytics')">📈 Analytics</button>
            </div>

            <!-- Boards Tab -->
            <div id="boards-tab" class="tab-content active">
                <!-- User Filter Section -->
                <div class="filter-section">
                    <div class="filter-controls">
                        <span class="filter-label">🔍 Filter by User:</span>
                        <select id="userFilter" class="user-select" disabled>
                            <option value="">Loading users...</option>
                        </select>
                        <button id="openFilterBtn" class="open-btn" onclick="applyUserFilter()" disabled>
                            📂 OPEN
                        </button>
                        <span id="filterStatus" class="filter-status">Select a user to filter projects</span>
                    </div>
                </div>

                <!-- Single Project Detail Section -->
                <div class="project-detail-section" id="projectDetailSection">
                    <div class="project-detail-header">
                        <button class="back-btn" onclick="navigateBack()">← Back</button>
                        <div class="project-title" id="projectTitle">Project Details</div>
                    </div>
                    
                    <div class="project-meta" id="projectMeta">
                        <!-- Project metadata will be populated here -->
                    </div>
                    
                    <div id="singleProjectGantt">
                        <!-- Single project Gantt chart will be rendered here -->
                    </div>
                </div>

                <!-- Gantt Chart Section -->
                <div class="gantt-section" id="ganttSection">
                    <div class="gantt-controls">
                        <span class="filter-label">📊 Project Timeline:</span>
                        <button id="showGanttBtn" class="gantt-btn" onclick="showGanttChart()" disabled>
                            📈 Show Gantt Chart
                        </button>
                        <button id="hideGanttBtn" class="gantt-btn" onclick="hideGanttChart()" style="display: none;">
                            📋 Hide Gantt Chart
                        </button>
                        <span id="ganttStatus" class="filter-status"></span>
                    </div>
                    <div id="ganttContainer"></div>
                </div>

                <div class="button-grid">
                    <button onclick="getBoards()" disabled id="btn-boards">📋 Get All Boards</button>
                    <button onclick="getBoardDetails()" disabled id="btn-board-details">🔍 Get Board Details</button>
                    <button onclick="createBoard()" disabled id="btn-create-board">➕ Create New Board</button>
                </div>
                <div id="boardsResult"></div>
            </div>

            <!-- Other tabs remain the same... -->
            <div id="items-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getItems()" disabled id="btn-items">📝 Get All Items</button>
                    <button onclick="createItem()" disabled id="btn-create-item">➕ Create New Item</button>
                    <button onclick="updateItem()" disabled id="btn-update-item">✏️ Update Item</button>
                </div>
                <div id="itemsResult"></div>
            </div>

            <div id="users-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getUsers()" disabled id="btn-users">👥 Get Users</button>
                    <button onclick="getTeams()" disabled id="btn-teams">🏢 Get Teams</button>
                    <button onclick="getUserActivity()" disabled id="btn-activity">📊 Get User Activity</button>
                </div>
                <div id="usersResult"></div>
            </div>

            <div id="updates-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getUpdates()" disabled id="btn-updates">💬 Get Recent Updates</button>
                    <button onclick="createUpdate()" disabled id="btn-create-update">➕ Create Update</button>
                </div>
                <div id="updatesResult"></div>
            </div>

            <div id="analytics-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getWorkspaceStats()" disabled id="btn-stats">📈 Workspace Stats</button>
                    <button onclick="getActivityLogs()" disabled id="btn-logs">📋 Activity Logs</button>
                </div>
                <div id="analyticsResult"></div>
            </div>
        </div>

        <!-- Custom Queries -->
        <div class="section">
            <h3>🛠️ Step 3: Custom GraphQL Queries</h3>
            <p>Write and test custom GraphQL queries:</p>
            <textarea id="customQuery" rows="8" style="width: 100%; font-family: monospace; padding: 10px;" placeholder="Enter your GraphQL query here...
Example:
query {
  boards(limit: 5) {
    id
    name
    items_page(limit: 3) {
      items {
        id
        name
      }
    }
  }
}"></textarea>
            <br>
            <button onclick="executeCustomQuery()" disabled id="btn-custom">🚀 Execute Query</button>
            <div id="customResult"></div>
        </div>

        <!-- Debug Information -->
        <div class="section">
            <h3>🐛 Debug Information</h3>
            <button onclick="showDebugInfo()" disabled id="btn-debug">📋 Show Debug Info</button>
            <div id="debugInfo"></div>
        </div>
    </div>

    <script>
                
    console.log('Script loaded successfully');
    
        let isConnected = false;
        let currentUser = null;
        let allBoards = [];
        let allUsers = [];
        let currentFilter = 'ALL';
        let currentFilteredBoards = [];
        
        // Enhanced navigation state
        let navigationState = {
            level: 'all', // 'all', 'user', 'project'
            userId: null,
            userLabel: null,
            projectId: null,
            projectName: null,
            projectData: null
        };

        // Test connection to Monday.com
        function testConnection() {
            showLoading('connectionResult');
            
            fetch('/test-connection', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.user) {
                        currentUser = data.user;
                        
                        document.getElementById('connectionResult').innerHTML = 
                            '<div class="status connected">✅ Connection successful!</div>' +
                            '<p><strong>User:</strong> ' + (data.user.name || 'Unknown') + ' (' + (data.user.email || 'No email') + ')</p>' +
                            '<p><strong>User ID:</strong> ' + (data.user.id || 'Unknown') + '</p>';
                        
                        document.getElementById('connectionStatus').innerHTML = 
                            '✅ Connected - Monday.com API ready';
                        document.getElementById('connectionStatus').className = 'status connected';
                        
                        enableAllButtons();
                        isConnected = true;
                    } else {
                        document.getElementById('connectionResult').innerHTML = 
                            '<div class="status disconnected">❌ Connection failed: ' + (data.error || 'Unknown error') + '</div>';
                    }
                })
                .catch(error => {
                    document.getElementById('connectionResult').innerHTML = 
                        '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
                });
        }

        // Enhanced getBoards function with navigation
        function getBoards() {
            console.log('🔍 Loading boards and users...');
            showLoading('boardsResult');
            document.getElementById('filterStatus').textContent = 'Loading projects and users...';
            
            // Reset navigation to all users level
            navigationState.level = 'all';
            navigationState.userId = null;
            navigationState.userLabel = null;
            updateBreadcrumb();
            hideProjectDetail();
            
            // Load both boards and users
            Promise.all([
                fetch('/api/boards').then(response => response.json()),
                fetch('/api/users').then(response => response.json())
            ])
            .then(([boardsData, usersData]) => {
                if (boardsData.success && usersData.success) {
                    allBoards = boardsData.boards;
                    allUsers = usersData.users;
                    
                    const nestedBoards = createNestedBoardStructure(allBoards);
                    const mainBoardCount = nestedBoards.length;
                    
                    populateUserFilter();
                    displayBoards(allBoards);
                    
                    currentFilteredBoards = nestedBoards;
                    
                    document.getElementById('filterStatus').textContent = 
                        'Showing ' + mainBoardCount + ' main boards (All users)';
                        
                    console.log('✅ Loaded', allBoards.length, 'total boards,', mainBoardCount, 'main boards');
                } else {
                    document.getElementById('boardsResult').innerHTML = 
                        '<div class="status disconnected">❌ Error loading data</div>';
                }
            })
            .catch(error => {
                console.error('❌ Error loading boards:', error);
                document.getElementById('boardsResult').innerHTML = 
                    '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
            });
        }

        // Enhanced navigation functions
        function updateBreadcrumb() {
            const breadcrumb = document.getElementById('navigationBreadcrumb');
            const allItem = document.getElementById('breadcrumbAll');
            
            // Clear existing breadcrumb items except "All Users"
            const existingItems = breadcrumb.querySelectorAll('.breadcrumb-item:not(#breadcrumbAll), .breadcrumb-separator');
            existingItems.forEach(item => item.remove());
            
            if (navigationState.level === 'all') {
                allItem.className = 'breadcrumb-item current';
                breadcrumb.style.display = 'none';
            } else {
                allItem.className = 'breadcrumb-item';
                breadcrumb.style.display = 'block';
                
                if (navigationState.level === 'user' && navigationState.userLabel) {
                    const separator = document.createElement('span');
                    separator.className = 'breadcrumb-separator';
                    separator.textContent = '→';
                    breadcrumb.appendChild(separator);
                    
                    const userItem = document.createElement('div');
                    userItem.className = 'breadcrumb-item current';
                    userItem.textContent = navigationState.userLabel;
                    breadcrumb.appendChild(userItem);
                }
                
                if (navigationState.level === 'project' && navigationState.projectName) {
                    if (navigationState.userLabel) {
                        const userItem = breadcrumb.querySelector('.breadcrumb-item.current');
                        if (userItem) {
                            userItem.className = 'breadcrumb-item';
                            userItem.onclick = () => navigateToUser();
                        }
                    }
                    
                    const separator = document.createElement('span');
                    separator.className = 'breadcrumb-separator';
                    separator.textContent = '→';
                    breadcrumb.appendChild(separator);
                    
                    const projectItem = document.createElement('div');
                    projectItem.className = 'breadcrumb-item current';
                    projectItem.textContent = '📋 ' + navigationState.projectName;
                    breadcrumb.appendChild(projectItem);
                }
            }
        }

        function navigateToAll() {
            console.log('🔄 Navigating to All Users view');
            navigationState.level = 'all';
            navigationState.userId = null;
            navigationState.userLabel = null;
            navigationState.projectId = null;
            navigationState.projectName = null;
            
            // Reset user filter
            const userSelect = document.getElementById('userFilter');
            if (userSelect.options.length > 0) {
                userSelect.selectedIndex = 0; // Select "ALL USERS"
            }
            
            updateBreadcrumb();
            hideProjectDetail();
            getBoards(); // Reload all boards
        }

        function navigateToUser() {
            console.log('🔄 Navigating back to User view');
            if (navigationState.userId) {
                navigationState.level = 'user';
                navigationState.projectId = null;
                navigationState.projectName = null;
                
                updateBreadcrumb();
                hideProjectDetail();
                applyUserFilter(); // Reapply the user filter
            }
        }

        function navigateBack() {
            if (navigationState.level === 'project') {
                if (navigationState.userId) {
                    navigateToUser();
                } else {
                    navigateToAll();
                }
            } else if (navigationState.level === 'user') {
                navigateToAll();
            }
        }

        // Enhanced project drill-down function
        function drillDownToProject(boardId, boardName) {
            console.log('🔍 Drilling down to project:', boardName, 'ID:', boardId);
            
            // Update navigation state
            navigationState.level = 'project';
            navigationState.projectId = boardId;
            navigationState.projectName = boardName;
            
            showLoading('projectDetailSection');
            document.getElementById('projectDetailSection').style.display = 'block';
            document.getElementById('ganttSection').style.display = 'none';
            document.getElementById('boardsResult').style.display = 'none';
            
            updateBreadcrumb();
            
            // Fetch detailed project information
            fetch('/api/board/' + boardId)
                .then(response => response.json())
                .then(data => {
                    console.log('📊 Project details received:', data);
                    
                    if (data.success && data.board) {
                        navigationState.projectData = data.board;
                        displaySingleProjectDetails(data.board);
                    } else {
                        document.getElementById('projectDetailSection').innerHTML = 
                            '<div class="status disconnected">❌ Error loading project details: ' + (data.error || 'Unknown error') + '</div>';
                    }
                })
                .catch(error => {
                    console.error('❌ Error loading project details:', error);
                    document.getElementById('projectDetailSection').innerHTML = 
                        '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
                });
        }

        // Display single project details with Gantt
        function displaySingleProjectDetails(project) {
            console.log('📋 Displaying single project details for:', project.name);
            
            document.getElementById('projectTitle').textContent = project.name;
            
            // Build project metadata
            const itemCount = project.groups ? project.groups.reduce((sum, group) => sum + (group.items ? group.items.length : 0), 0) : 0;
            const groupCount = project.groups ? project.groups.length : 0;
            const columnCount = project.columns ? project.columns.length : 0;
            const ownerCount = project.owners ? project.owners.length : 0;
            
            let metaHtml = '';
            
            // Basic info cards
            metaHtml += '<div class="meta-card"><div class="meta-label">Description</div><div class="meta-value">' + (project.description || 'No description') + '</div></div>';
            metaHtml += '<div class="meta-card"><div class="meta-label">Type</div><div class="meta-value">' + project.board_kind + '</div></div>';
            metaHtml += '<div class="meta-card"><div class="meta-label">Items</div><div class="meta-value">' + itemCount + '</div></div>';
            metaHtml += '<div class="meta-card"><div class="meta-label">Groups</div><div class="meta-value">' + groupCount + '</div></div>';
            metaHtml += '<div class="meta-card"><div class="meta-label">Columns</div><div class="meta-value">' + columnCount + '</div></div>';
            metaHtml += '<div class="meta-card"><div class="meta-label">Team Size</div><div class="meta-value">' + ownerCount + '</div></div>';
            
            // Date columns info
            const dateColumns = project.columns ? project.columns.filter(col => ['date', 'timeline', 'creation_log', 'last_updated'].includes(col.type)) : [];
            metaHtml += '<div class="meta-card"><div class="meta-label">Date Columns</div><div class="meta-value">' + dateColumns.length + '</div></div>';
            
            document.getElementById('projectMeta').innerHTML = metaHtml;
            
            // Render single project Gantt
            renderSingleProjectGantt(project);
        }

        // Render Gantt chart for a single project
        function renderSingleProjectGantt(project) {
            console.log('📈 Rendering single project Gantt for:', project.name);
            
            let html = '<h4>📊 Project Timeline - ' + project.name + '</h4>';
            
            if (!project.groups || project.groups.length === 0) {
                html += '<div class="gantt-no-dates">📋 No groups/items found in this project</div>';
                document.getElementById('singleProjectGantt').innerHTML = html;
                return;
            }
            
            // Create timeline reference (3 months back, 6 months forward)
            const now = new Date();
            const timelineStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            const timelineEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0);
            
            html += '<div class="gantt-container">';
            
            // Header
            html += '<div class="gantt-header">';
            html += '<div class="gantt-header-left">Task Details</div>';
            html += '<div class="gantt-header-right">';
            
            for (let i = -3; i < 6; i++) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                html += '<div class="gantt-month">' + monthName + '</div>';
            }
            
            html += '</div></div>';
            
            // Process each group and its items
            let itemsWithDates = 0;
            let totalItems = 0;
            
            project.groups.forEach(group => {
                if (!group.items || group.items.length === 0) return;
                
                // Group header
                html += '<div class="gantt-row" style="background: #f1f5f9; font-weight: bold;">';
                html += '<div class="gantt-project">';
                html += '<div class="gantt-project-name">📁 ' + group.title + '</div>';
                html += '<div class="gantt-project-info">' + group.items.length + ' items in this group</div>';
                html += '</div>';
                html += '<div class="gantt-timeline"></div>';
                html += '</div>';
                
                // Group items
                group.items.forEach(item => {
                    totalItems++;
                    const itemDateInfo = findItemDates(item);
                    if (itemDateInfo.hasDateColumns && (itemDateInfo.startDate || itemDateInfo.endDate)) {
                        itemsWithDates++;
                    }
                    
                    html += '<div class="gantt-row">';
                    html += '<div class="gantt-project" style="padding-left: 25px;">';
                    html += '<div class="gantt-project-name">📋 ' + item.name + '</div>';
                    html += '<div class="gantt-project-info">';
                    html += 'Status: ' + (item.state || 'unknown');
                    if (itemDateInfo.dateColumns.length > 0) {
                        html += ' | 📅 ' + itemDateInfo.dateColumns.length + ' date fields';
                    }
                    html += '</div>';
                    html += '</div>';
                    
                    html += '<div class="gantt-timeline">';
                    
                    if (itemDateInfo.hasDateColumns && (itemDateInfo.startDate || itemDateInfo.endDate)) {
                        // Render timeline bar
                        let barHtml = '';
                        
                        if (itemDateInfo.startDate && itemDateInfo.endDate) {
                            const startPercent = calculateTimelinePosition(itemDateInfo.startDate, timelineStart, timelineEnd);
                            const endPercent = calculateTimelinePosition(itemDateInfo.endDate, timelineStart, timelineEnd);
                            const width = Math.max(2, endPercent - startPercent);
                            
                            barHtml = '<div class="gantt-bar status-active" style="left: ' + startPercent + '%; width: ' + width + '%;" title="' + formatDateRange(itemDateInfo.startDate, itemDateInfo.endDate) + '">' + 
                                     formatDateRange(itemDateInfo.startDate, itemDateInfo.endDate) + '</div>';
                        } else if (itemDateInfo.startDate) {
                            const startPercent = calculateTimelinePosition(itemDateInfo.startDate, timelineStart, timelineEnd);
                            barHtml = '<div class="gantt-bar status-planned" style="left: ' + startPercent + '%; width: 3%;" title="Start: ' + formatDate(itemDateInfo.startDate) + '">📅 ' + formatDate(itemDateInfo.startDate) + '</div>';
                        } else if (itemDateInfo.endDate) {
                            const endPercent = calculateTimelinePosition(itemDateInfo.endDate, timelineStart, timelineEnd);
                            barHtml = '<div class="gantt-bar status-delayed" style="left: ' + endPercent + '%; width: 3%;" title="Due: ' + formatDate(itemDateInfo.endDate) + '">🎯 ' + formatDate(itemDateInfo.endDate) + '</div>';
                        }
                        
                        html += barHtml;
                    } else {
                        html += '<div class="gantt-no-dates">📅 Add timeline or date columns to see schedule</div>';
                    }
                    
                    html += '</div>';
                    html += '</div>';
                });
            });
            
            html += '</div>'; // Close gantt-container
            
            // Summary and legend
            html += '<div class="gantt-legend">';
            html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #10b981;"></div>Active timeline (' + itemsWithDates + ')</div>';
            html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #3b82f6;"></div>Start dates</div>';
            html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #ef4444;"></div>Due dates</div>';
            html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #f59e0b;"></div>Need dates (' + (totalItems - itemsWithDates) + ')</div>';
            html += '</div>';
            
            html += '<div style="margin-top: 15px; padding: 15px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; font-size: 13px;">';
            html += '<strong>📋 Single Project Timeline Analysis:</strong><br>';
            html += '• <strong>Total Items:</strong> ' + totalItems + '<br>';
            html += '• <strong>Items with Dates:</strong> ' + itemsWithDates + ' (' + Math.round((itemsWithDates / totalItems) * 100) + '%)<br>';
            html += '• <strong>Timeline Period:</strong> ' + formatDate(timelineStart) + ' to ' + formatDate(timelineEnd) + '<br>';
            html += '• <strong>Groups:</strong> ' + project.groups.length + ' sections';
            html += '</div>';
            
            document.getElementById('singleProjectGantt').innerHTML = html;
        }

        // Enhanced function to find dates in individual items
        function findItemDates(item) {
            const dateInfo = {
                hasDateColumns: false,
                dateColumns: [],
                startDate: null,
                endDate: null
            };
            
            if (!item.column_values) return dateInfo;
            
            item.column_values.forEach(columnValue => {
                if (['date', 'timeline', 'creation_log', 'last_updated'].includes(columnValue.type)) {
                    dateInfo.hasDateColumns = true;
                    dateInfo.dateColumns.push(columnValue.title + ' (' + columnValue.type + ')');
                    
                    // Parse different date formats
                    if (columnValue.type === 'timeline' && columnValue.value) {
                        try {
                            const timelineData = JSON.parse(columnValue.value);
                            if (timelineData.from && !dateInfo.startDate) {
                                dateInfo.startDate = new Date(timelineData.from);
                            }
                            if (timelineData.to && !dateInfo.endDate) {
                                dateInfo.endDate = new Date(timelineData.to);
                            }
                        } catch (e) {
                            console.warn('Failed to parse timeline data:', columnValue.value);
                        }
                    } else if (columnValue.type === 'date' && columnValue.value) {
                        try {
                            const dateData = JSON.parse(columnValue.value);
                            if (dateData.date && !dateInfo.startDate) {
                                dateInfo.startDate = new Date(dateData.date);
                            }
                        } catch (e) {
                            console.warn('Failed to parse date data:', columnValue.value);
                        }
                    } else if (columnValue.text && (columnValue.type === 'creation_log' || columnValue.type === 'last_updated')) {
                        try {
                            const date = new Date(columnValue.text);
                            if (!isNaN(date.getTime()) && !dateInfo.startDate) {
                                dateInfo.startDate = date;
                            }
                        } catch (e) {
                            console.warn('Failed to parse log date:', columnValue.text);
                        }
                    }
                }
            });
            
            return dateInfo;
        }

        function hideProjectDetail() {
            document.getElementById('projectDetailSection').style.display = 'none';
            document.getElementById('ganttSection').style.display = 'block';
            document.getElementById('boardsResult').style.display = 'block';
        }

        // Enhanced user filter application
        function applyUserFilter() {
            const userSelect = document.getElementById('userFilter');
            const selectedUserId = userSelect.value;
            const selectedUserName = userSelect.options[userSelect.selectedIndex].textContent;
            
            console.log('🔍 Applying user filter:', selectedUserId, selectedUserName);
            
            // Update navigation state
            navigationState.level = selectedUserId === 'ALL' ? 'all' : 'user';
            navigationState.userId = selectedUserId === 'ALL' ? null : selectedUserId;
            navigationState.userLabel = selectedUserId === 'ALL' ? null : selectedUserName;
            navigationState.projectId = null;
            navigationState.projectName = null;
            
            showLoading('boardsResult');
            document.getElementById('filterStatus').textContent = 'Filtering projects...';
            hideProjectDetail();
            updateBreadcrumb();
            
            const filteredBoards = filterBoardsByUser(allBoards, selectedUserId);
            const filteredNestedBoards = createNestedBoardStructure(filteredBoards);
            currentFilteredBoards = filteredNestedBoards;
            
            setTimeout(() => {
                displayBoards(filteredBoards);
                
                if (selectedUserId === 'ALL') {
                    document.getElementById('filterStatus').textContent = 
                        'Showing ' + filteredNestedBoards.length + ' main boards (All users)';
                } else {
                    const userName = selectedUserName.replace('👤 ', '').split(' (')[0];
                    document.getElementById('filterStatus').textContent = 
                        'Showing ' + filteredNestedBoards.length + ' main boards for ' + userName;
                }
                
                currentFilter = selectedUserId;
                
                document.getElementById('showGanttBtn').disabled = false;
                document.getElementById('ganttSection').style.display = 'block';
                document.getElementById('ganttStatus').textContent = 
                    'Ready to show timeline for ' + filteredNestedBoards.length + ' main boards';
            }, 200);
        }

        // All other existing functions remain the same...
        // (populateUserFilter, filterBoardsByUser, createNestedBoardStructure, etc.)
        
        function populateUserFilter() {
            const userSelect = document.getElementById('userFilter');
            userSelect.innerHTML = '';
            
            const allNestedBoards = createNestedBoardStructure(allBoards);
            
            const allOption = document.createElement('option');
            allOption.value = 'ALL';
            allOption.textContent = '👥 ALL USERS (' + allNestedBoards.length + ' main boards)';
            userSelect.appendChild(allOption);
            
            allUsers.forEach(user => {
                if (user.enabled) {
                    const userBoards = filterBoardsByUser(allBoards, user.id);
                    const userNestedBoards = createNestedBoardStructure(userBoards);
                    if (userNestedBoards.length > 0) {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = '👤 ' + user.name + ' (' + userNestedBoards.length + ' main boards)';
                        userSelect.appendChild(option);
                    }
                }
            });
            
            userSelect.disabled = false;
            document.getElementById('openFilterBtn').disabled = false;
            
            console.log('User filter populated with', allUsers.length, 'users');
        }

        function filterBoardsByUser(boards, userId) {
            if (userId === 'ALL') {
                return boards;
            }
            
            return boards.filter(board => {
                const isOwner = board.owners && board.owners.some(owner => owner.id === userId);
                const isSubscriber = board.subscribers && board.subscribers.some(sub => sub.id === userId);
                return isOwner || isSubscriber;
            });
        }

        function createNestedBoardStructure(boards) {
            const mainBoards = [];
            const subitemBoards = [];
            
            boards.forEach(function(board) {
                if (board.name.indexOf('Subitems of ') === 0) {
                    subitemBoards.push(board);
                } else {
                    mainBoards.push(board);
                }
            });
            
            return mainBoards.map(function(mainBoard) {
                const relatedSubitems = subitemBoards.filter(function(subBoard) {
                    return subBoard.name === 'Subitems of ' + mainBoard.name;
                });
                
                const mainItems = mainBoard.items_page && mainBoard.items_page.items ? mainBoard.items_page.items.length : 0;
                const subItems = relatedSubitems.reduce(function(sum, sub) {
                    return sum + (sub.items_page && sub.items_page.items ? sub.items_page.items.length : 0);
                }, 0);
                
                return {
                    id: mainBoard.id,
                    name: mainBoard.name,
                    description: mainBoard.description,
                    board_kind: mainBoard.board_kind,
                    workspace: mainBoard.workspace,
                    groups: mainBoard.groups,
                    items_page: mainBoard.items_page,
                    owners: mainBoard.owners,
                    subscribers: mainBoard.subscribers,
                    hasSubitems: relatedSubitems.length > 0,
                    subitems: relatedSubitems,
                    totalItems: mainItems + subItems
                };
            });
        }

        function toggleSubitems(boardId) {
            const subitemsContainer = document.getElementById('subitems-' + boardId);
            const toggleBtn = document.getElementById('toggle-' + boardId);
            
            if (subitemsContainer && toggleBtn) {
                if (subitemsContainer.style.display === 'none' || subitemsContainer.style.display === '') {
                    subitemsContainer.style.display = 'block';
                    toggleBtn.innerHTML = '🔽 ';
                } else {
                    subitemsContainer.style.display = 'none';
                    toggleBtn.innerHTML = '▶️ ';
                }
            }
        }

        // Enhanced displayBoards with clickable project names for drill-down
        function displayBoards(boards) {
            console.log('Displaying boards with enhanced navigation...');
            
            const nestedBoards = createNestedBoardStructure(boards);
            console.log('Processing', nestedBoards.length, 'main boards');
            
            let html = '<h4>📋 Your Projects (' + nestedBoards.length + ' main boards)</h4>';
            
            if (nestedBoards.length === 0) {
                html += '<p>No projects found for the selected user.</p>';
                document.getElementById('boardsResult').innerHTML = html;
                return;
            }
            
            nestedBoards.forEach(function(board) {
                const itemCount = board.items_page && board.items_page.items ? board.items_page.items.length : 0;
                const groupCount = board.groups ? board.groups.length : 0;
                const hasSubitems = board.hasSubitems;
                const totalItems = board.totalItems;
                
                html += '<div class="board-card">';
                html += '<div class="board-header">';
                
                if (hasSubitems) {
                    html += '<button class="toggle-btn" data-board-id="' + board.id + '" id="toggle-' + board.id + '">';
                    html += '▶️ </button>';
                } else {
                    html += '<span style="width: 25px; display: inline-block;"></span>';
                }
                
                // Make project name clickable for drill-down
                html += '<div class="gantt-project-name" onclick="drillDownToProject(\'' + project.id + '\', \'' + project.name.replace(/'/g, "&#39;") + '\')">📋 ' + project.name + '</div>';
                html += '</div>';
                
                html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
                html += '<p><strong>Type:</strong> ' + board.board_kind + ' | <strong>Workspace:</strong> ' + (board.workspace && board.workspace.name ? board.workspace.name : 'Unknown') + '</p>';
                
                html += '<p><strong>👥 Team:</strong> ';
                if (board.owners && board.owners.length > 0) {
                    html += 'Owners: ' + board.owners.map(owner => owner.name).join(', ');
                }
                if (board.subscribers && board.subscribers.length > 0) {
                    if (board.owners && board.owners.length > 0) html += ' | ';
                    html += 'Subscribers: ' + board.subscribers.map(sub => sub.name).join(', ');
                }
                if ((!board.owners || board.owners.length === 0) && (!board.subscribers || board.subscribers.length === 0)) {
                    html += 'No assigned users';
                }
                html += '</p>';
                
                html += '<div class="board-stats">';
                html += '<div class="stat">📝 ' + totalItems + ' total items</div>';
                html += '<div class="stat">📁 ' + groupCount + ' groups</div>';
                html += '<div class="stat">🆔 ' + board.id + '</div>';
                if (hasSubitems) {
                    html += '<div class="stat">🔎 ' + board.subitems.length + ' subitems</div>';
                }
                html += '</div>';
                
                if (hasSubitems) {
                    html += '<div class="subitems-container" id="subitems-' + board.id + '">';
                    html += '<h5>🔎 Subitems:</h5>';
                    
                    board.subitems.forEach(function(subitem) {
                        const subItemCount = subitem.items_page && subitem.items_page.items ? subitem.items_page.items.length : 0;
                        html += '<div class="subitem-card">';
                        html += '<div class="subitem-name">📋 ' + subitem.name + '</div>';
                        html += '<div class="subitem-stats">';
                        html += '<span class="stat">📝 ' + subItemCount + ' items</span>';
                        html += '<span class="stat">🆔 ' + subitem.id + '</span>';
                        html += '</div>';
                        html += '</div>';
                    });
                    html += '</div>';
                }
                
                html += '</div>';
            });
            
            document.getElementById('boardsResult').innerHTML = html;
            
            setTimeout(function() {
                const toggleButtons = document.querySelectorAll('.toggle-btn');
                console.log('Attaching event listeners to', toggleButtons.length, 'toggle buttons');
                
                toggleButtons.forEach(function(button) {
                    button.addEventListener('click', function() {
                        const boardId = this.getAttribute('data-board-id');
                        console.log('Toggle clicked for board:', boardId);
                        toggleSubitems(boardId);
                    });
                });
            }, 100);
            
            console.log('Boards displayed with enhanced navigation');
        }

        // GANTT CHART FUNCTIONS (existing functions remain the same)
        function showGanttChart() {
            console.log('Showing Gantt chart for', currentFilteredBoards.length, 'projects');
            
            if (currentFilteredBoards.length === 0) {
                document.getElementById('ganttContainer').innerHTML = 
                    '<div class="status disconnected">❌ No projects to display. Please load and filter projects first.</div>';
                return;
            }
            
            document.getElementById('ganttStatus').textContent = 'Loading timeline...';
            renderSimpleGanttChart(currentFilteredBoards);
        }

        function hideGanttChart() {
            document.getElementById('ganttContainer').innerHTML = '';
            document.getElementById('showGanttBtn').style.display = 'inline-block';
            document.getElementById('hideGanttBtn').style.display = 'none';
            document.getElementById('ganttStatus').textContent = 'Gantt chart hidden';
        }

        function renderSimpleGanttChart(projects) {
            console.log('Rendering Gantt chart for', projects.length, 'main boards with date detection');
            
            let html = '<div class="gantt-container">';
            
            const now = new Date();
            const timelineStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const timelineEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0);
            
            html += '<div class="gantt-header">';
            html += '<div class="gantt-header-left">Project Details</div>';
            html += '<div class="gantt-header-right">';
            
            for (let i = 0; i < 6; i++) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                html += '<div class="gantt-month">' + monthName + '</div>';
            }
            
            html += '</div></div>';
            
            let projectsWithDates = 0;
            let totalDateColumns = 0;
            
            projects.forEach(project => {
                const itemCount = project.items_page && project.items_page.items ? project.items_page.items.length : 0;
                
                const dateInfo = findProjectDates(project);
                if (dateInfo.hasDateColumns) projectsWithDates++;
                totalDateColumns += dateInfo.dateColumns.length;
                
                html += '<div class="gantt-row">';
                html += '<div class="gantt-project">';
                // Make project name clickable in Gantt view too
                html += '<div class="board-name clickable-project" onclick="drillDownToProject(\'' + board.id + '\', \'' + board.name.replace(/'/g, "&#39;") + '\')">📋 ' + board.name + '</div>';
                html += '<div class="gantt-project-info">';
                html += 'Type: ' + project.board_kind + ' | Items: ' + itemCount;
                if (project.workspace && project.workspace.name) {
                    html += ' | Workspace: ' + project.workspace.name;
                }
                if (dateInfo.hasDateColumns) {
                    html += ' | 📅 ' + dateInfo.dateColumns.length + ' date columns';
                }
                html += '</div>';
                html += '</div>';
                
                html += '<div class="gantt-timeline">';
                
                if (dateInfo.hasDateColumns && (dateInfo.startDate || dateInfo.endDate)) {
                    let barHtml = '';
                    let barStyle = '';
                    let barText = '';
                    
                    if (dateInfo.startDate && dateInfo.endDate) {
                        const startPercent = calculateTimelinePosition(dateInfo.startDate, timelineStart, timelineEnd);
                        const endPercent = calculateTimelinePosition(dateInfo.endDate, timelineStart, timelineEnd);
                        const width = Math.max(2, endPercent - startPercent);
                        
                        barStyle = 'left: ' + startPercent + '%; width: ' + width + '%;';
                        barText = formatDateRange(dateInfo.startDate, dateInfo.endDate);
                        barHtml = '<div class="gantt-bar status-active" style="' + barStyle + '" title="' + barText + '">' + barText + '</div>';
                    } else if (dateInfo.startDate) {
                        const startPercent = calculateTimelinePosition(dateInfo.startDate, timelineStart, timelineEnd);
                        barStyle = 'left: ' + startPercent + '%; width: 3%;';
                        barText = '📅 ' + formatDate(dateInfo.startDate);
                        barHtml = '<div class="gantt-bar status-planned" style="' + barStyle + '" title="Start: ' + formatDate(dateInfo.startDate) + '">' + barText + '</div>';
                    } else if (dateInfo.endDate) {
                        const endPercent = calculateTimelinePosition(dateInfo.endDate, timelineStart, timelineEnd);
                        barStyle = 'left: ' + endPercent + '%; width: 3%;';
                        barText = '🎯 ' + formatDate(dateInfo.endDate);
                        barHtml = '<div class="gantt-bar status-delayed" style="' + barStyle + '" title="Due: ' + formatDate(dateInfo.endDate) + '">' + barText + '</div>';
                    }
                    
                    html += barHtml;
                } else if (dateInfo.hasDateColumns) {
                    html += '<div class="gantt-no-dates">📅 Date columns available: ' + dateInfo.dateColumns.join(', ') + ' - add dates to see timeline</div>';
                } else {
                    html += '<div class="gantt-no-dates">📅 Add date or timeline columns to see project timeline</div>';
                }
                
                html += '</div>';
                html += '</div>';
            });
            
            html += '</div>';
            
            html += '<div class="gantt-legend">';
            html += '<div class="gantt-legend-item">';
            html += '<div class="gantt-legend-color" style="background: #10b981;"></div>';
            html += 'Projects with timeline (' + projectsWithDates + ')';
            html += '</div>';
            html += '<div class="gantt-legend-item">';
            html += '<div class="gantt-legend-color" style="background: #3b82f6;"></div>';
            html += 'Start dates (milestones)';
            html += '</div>';
            html += '<div class="gantt-legend-item">';
            html += '<div class="gantt-legend-color" style="background: #ef4444;"></div>';
            html += 'Due dates (deadlines)';
            html += '</div>';
            html += '<div class="gantt-legend-item">';
            html += '<div class="gantt-legend-color" style="background: #f59e0b;"></div>';
            html += 'Need dates (' + (projects.length - projectsWithDates) + ')';
            html += '</div>';
            html += '</div>';
            
            html += '<div style="margin-top: 15px; padding: 15px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; font-size: 13px;">';
            html += '<strong>📋 How to add dates to your Monday.com projects:</strong><br>';
            html += '• <strong>Timeline Column:</strong> Go to your board → Add Column → Timeline → Set start & end dates<br>';
            html += '• <strong>Date Column:</strong> Go to your board → Add Column → Date → Pick single dates<br>';
            html += '• <strong>Supported types:</strong> "timeline" (best), "date", "creation_log", "last_updated"<br>';
            html += '• Projects with dates will show as colored bars on this timeline<br>';
            html += '• Timeline covers: <strong>' + formatDate(timelineStart) + ' to ' + formatDate(timelineEnd) + '</strong>';
            html += '</div>';
            
            document.getElementById('ganttContainer').innerHTML = html;
            document.getElementById('showGanttBtn').style.display = 'none';
            document.getElementById('hideGanttBtn').style.display = 'inline-block';
            document.getElementById('ganttStatus').textContent = 
                'Timeline: ' + projects.length + ' projects (' + projectsWithDates + ' with dates, ' + totalDateColumns + ' date columns)';
        }

        function findProjectDates(project) {
            const dateInfo = {
                hasDateColumns: false,
                dateColumns: [],
                startDate: null,
                endDate: null
            };
            
            if (project.columns) {
                project.columns.forEach(column => {
                    if (['date', 'timeline', 'creation_log', 'last_updated'].includes(column.type)) {
                        dateInfo.hasDateColumns = true;
                        dateInfo.dateColumns.push(column.title + ' (' + column.type + ')');
                    }
                });
            }
            
            if (project.items_page && project.items_page.items) {
                project.items_page.items.forEach(item => {
                    if (item.column_values) {
                        item.column_values.forEach(columnValue => {
                            if (['date', 'timeline', 'creation_log', 'last_updated'].includes(columnValue.type)) {
                                if (columnValue.type === 'timeline' && columnValue.value) {
                                    try {
                                        const timelineData = JSON.parse(columnValue.value);
                                        if (timelineData.from && !dateInfo.startDate) {
                                            dateInfo.startDate = new Date(timelineData.from);
                                        }
                                        if (timelineData.to && !dateInfo.endDate) {
                                            dateInfo.endDate = new Date(timelineData.to);
                                        }
                                    } catch (e) {
                                        console.warn('Failed to parse timeline data:', columnValue.value);
                                    }
                                } else if (columnValue.type === 'date' && columnValue.value) {
                                    try {
                                        const dateData = JSON.parse(columnValue.value);
                                        if (dateData.date && !dateInfo.startDate) {
                                            dateInfo.startDate = new Date(dateData.date);
                                        }
                                    } catch (e) {
                                        console.warn('Failed to parse date data:', columnValue.value);
                                    }
                                } else if (columnValue.text && (columnValue.type === 'creation_log' || columnValue.type === 'last_updated')) {
                                    try {
                                        const date = new Date(columnValue.text);
                                        if (!isNaN(date.getTime()) && !dateInfo.startDate) {
                                            dateInfo.startDate = date;
                                        }
                                    } catch (e) {
                                        console.warn('Failed to parse log date:', columnValue.text);
                                    }
                                }
                            }
                        });
                    }
                });
            }
            
            console.log('Date info for', project.name, ':', dateInfo);
            return dateInfo;
        }

        function calculateTimelinePosition(date, timelineStart, timelineEnd) {
            const totalTimelineMs = timelineEnd.getTime() - timelineStart.getTime();
            const dateMs = date.getTime() - timelineStart.getTime();
            const percentage = Math.max(0, Math.min(100, (dateMs / totalTimelineMs) * 100));
            return percentage;
        }

        function formatDate(date) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        function formatDateRange(startDate, endDate) {
            const start = formatDate(startDate);
            const end = formatDate(endDate);
            if (start === end) {
                return start;
            }
            return start + ' → ' + end;
        }

        // Rest of the existing functions from server5 (items, users, etc.)
        function getBoardDetails() {
            const boardId = prompt('Enter Board ID to get details:');
            if (!boardId) return;
            
            showLoading('boardsResult');
            
            fetch('/api/board/' + boardId)
                .then(response => response.json())
                .then(data => {
                    document.getElementById('boardsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function createBoard() {
            const boardName = prompt('Enter name for new board:');
            if (!boardName) return;
            
            showLoading('boardsResult');
            
            fetch('/api/create-board', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: boardName })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status connected">✅ Board created successfully! ID: ' + data.board.id + '</div>';
                        getBoards();
                    } else {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status disconnected">❌ Error: ' + (data.error || 'Failed to create board') + '</div>';
                    }
                });
        }

        function getItems() {
            showLoading('itemsResult');
            
            fetch('/api/items')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('itemsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function createItem() {
            const boardId = prompt('Enter Board ID:');
            const itemName = prompt('Enter item name:');
            if (!boardId || !itemName) return;
            
            showLoading('itemsResult');
            
            fetch('/api/create-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId, itemName })
            })
                .then(response => response.json())
                .then(data => {
                    document.getElementById('itemsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function updateItem() {
            const itemId = prompt('Enter Item ID to update:');
            const newName = prompt('Enter new name:');
            if (!itemId || !newName) return;
            
            showLoading('itemsResult');
            
            fetch('/api/update-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, name: newName })
            })
                .then(response => response.json())
                .then(data => {
                    document.getElementById('itemsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function getUsers() {
            showLoading('usersResult');
            
            fetch('/api/users')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('usersResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function getTeams() {
            showLoading('usersResult');
            
            fetch('/api/teams')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('usersResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function getUserActivity() {
            showLoading('usersResult');
            
            fetch('/api/activity')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('usersResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function getUpdates() {
            showLoading('updatesResult');
            
            fetch('/api/updates')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('updatesResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function createUpdate() {
            const itemId = prompt('Enter Item ID to update:');
            const updateText = prompt('Enter update text:');
            if (!itemId || !updateText) return;
            
            showLoading('updatesResult');
            
            fetch('/api/create-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, text: updateText })
            })
                .then(response => response.json())
                .then(data => {
                    document.getElementById('updatesResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function getWorkspaceStats() {
            showLoading('analyticsResult');
            
            fetch('/api/stats')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('analyticsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function getActivityLogs() {
            showLoading('analyticsResult');
            
            fetch('/api/logs')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('analyticsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function executeCustomQuery() {
            const query = document.getElementById('customQuery').value;
            if (!query.trim()) {
                alert('Please enter a GraphQL query');
                return;
            }
            
            showLoading('customResult');
            
            fetch('/api/custom-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            })
                .then(response => response.json())
                .then(data => {
                    document.getElementById('customResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function showDebugInfo() {
            fetch('/api/debug')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('debugInfo').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }

        function showLoading(elementId) {
            document.getElementById(elementId).innerHTML = 
                '<div class="status pending">🔄 Loading...</div>';
        }

        function enableAllButtons() {
            const buttons = [
                'btn-boards', 'btn-board-details', 'btn-create-board',
                'btn-items', 'btn-create-item', 'btn-update-item',
                'btn-users', 'btn-teams', 'btn-activity',
                'btn-updates', 'btn-create-update',
                'btn-stats', 'btn-logs',
                'btn-custom', 'btn-debug'
            ];
            buttons.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.disabled = false;
            });
        }

        // Check connection status on page load
        fetch('/connection-status')
            .then(response => response.json())
            .then(data => {
                if (data.hasToken) {
                    document.getElementById('tokenStatus').textContent = 'Configured ✅';
                } else {
                    document.getElementById('tokenStatus').textContent = 'Not configured ❌';
                }
            })
            .catch(() => {
                // Ignore errors on page load
            });
    </script>
</body>
</html>
    `);
});

// Backend endpoints start here
app.post("/test-connection", async (req, res) => {
  try {
    console.log("🔍 Testing Monday.com connection...");
    const result = await testMondayConnection();

    if (!result || !result.me) {
      console.log("❌ No user data in response");
      return res.json({
        success: false,
        error: "No user data returned from API",
        rawResponse: result,
      });
    }

    res.json({
      success: true,
      user: result.me,
      message: "Connection successful",
    });
  } catch (error) {
    console.error("❌ Monday.com connection failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack,
    });
  }
});

// Check connection status
app.get("/connection-status", (req, res) => {
  res.json({
    hasToken: !!MONDAY_CONFIG.apiToken,
    apiUrl: MONDAY_CONFIG.apiUrl,
    apiVersion: MONDAY_CONFIG.apiVersion,
  });
});

// Enhanced boards endpoint with detailed column data for date analysis
app.get("/api/boards", async (req, res) => {
  try {
    const query = `
            query {
                boards(limit: 100) {
                    id
                    name
                    description
                    state
                    board_kind
                    workspace {
                        id
                        name
                    }
                    owners {
                        id
                        name
                        email
                    }
                    subscribers {
                        id
                        name
                        email
                    }
                    groups {
                        id
                        title
                        color
                    }
                    columns {
                        id
                        title
                        type
                        settings_str
                    }
                    items_page(limit: 5) {
                        items {
                            id
                            name
                            state
                            column_values {
                                id
                                title
                                type
                                text
                                value
                            }
                        }
                    }
                }
            }
        `;

    console.log("🔍 Fetching boards with enhanced column data...");
    const result = await makeMondayRequest(query);

    console.log(
      "📊 Successfully fetched",
      result.boards?.length || 0,
      "boards with column data"
    );

    res.json({
      success: true,
      boards: result.boards || [],
      count: result.boards?.length || 0,
    });
  } catch (error) {
    console.error("❌ Enhanced boards API error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Enhanced single board endpoint with full item details and column values
app.get("/api/board/:id", async (req, res) => {
  try {
    const boardId = req.params.id;

    console.log("🔍 Fetching detailed board data for ID:", boardId);

    const query = `
            query($boardId: ID!) {
                boards(ids: [$boardId]) {
                    id
                    name
                    description
                    state
                    board_kind
                    permissions
                    workspace {
                        id
                        name
                    }
                    groups {
                        id
                        title
                        color
                        items {
                            id
                            name
                            state
                            created_at
                            updated_at
                            column_values {
                                id
                                title
                                type
                                text
                                value
                            }
                        }
                    }
                    columns {
                        id
                        title
                        type
                        settings_str
                    }
                    owners {
                        id
                        name
                        email
                    }
                    subscribers {
                        id
                        name
                        email
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query, { boardId });

    if (!result.boards || result.boards.length === 0) {
      return res.json({
        success: false,
        error: "Board not found or no access",
        boardId: boardId,
      });
    }

    console.log(
      "✅ Successfully fetched detailed board:",
      result.boards[0].name
    );

    res.json({
      success: true,
      board: result.boards[0],
    });
  } catch (error) {
    console.error("❌ Single board API error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      boardId: req.params.id,
    });
  }
});

// All remaining endpoints (create-board, items, users, teams, etc.)
app.post("/api/create-board", async (req, res) => {
  try {
    const { name, description, boardKind } = req.body;

    const mutation = `
            mutation($boardName: String!, $boardKind: BoardKind, $description: String) {
                create_board(
                    board_name: $boardName,
                    board_kind: $boardKind,
                    description: $description
                ) {
                    id
                    name
                    description
                }
            }
        `;

    const variables = {
      boardName: name,
      boardKind: boardKind || "public",
      description: description || null,
    };

    const result = await makeMondayRequest(mutation, variables);

    res.json({
      success: true,
      board: result.create_board,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/items", async (req, res) => {
  try {
    const query = `
            query {
                items_page(limit: 100) {
                    items {
                        id
                        name
                        state
                        created_at
                        updated_at
                        board {
                            id
                            name
                        }
                        group {
                            id
                            title
                        }
                        column_values {
                            id
                            text
                            title
                            type
                        }
                        creator {
                            id
                            name
                        }
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      items: result.items_page?.items || [],
      count: result.items_page?.items?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/create-item", async (req, res) => {
  try {
    const { boardId, itemName, groupId } = req.body;

    const mutation = `
            mutation($boardId: ID!, $itemName: String!, $groupId: String) {
                create_item(
                    board_id: $boardId,
                    item_name: $itemName,
                    group_id: $groupId
                ) {
                    id
                    name
                    state
                    board {
                        id
                        name
                    }
                }
            }
        `;

    const variables = {
      boardId: boardId,
      itemName: itemName,
      groupId: groupId || null,
    };

    const result = await makeMondayRequest(mutation, variables);

    res.json({
      success: true,
      item: result.create_item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/update-item", async (req, res) => {
  try {
    const { itemId, name, columnValues } = req.body;

    let mutation = "";
    let variables = {};

    if (name) {
      mutation = `
                mutation($itemId: ID!, $itemName: String!) {
                    change_simple_column_value(
                        item_id: $itemId,
                        column_id: "name",
                        value: $itemName
                    ) {
                        id
                        name
                    }
                }
            `;
      variables = { itemId, itemName: name };
    } else if (columnValues) {
      mutation = `
                mutation($itemId: ID!, $columnValues: JSON!) {
                    change_multiple_column_values(
                        item_id: $itemId,
                        column_values: $columnValues
                    ) {
                        id
                        name
                        column_values {
                            id
                            text
                            title
                        }
                    }
                }
            `;
      variables = { itemId, columnValues: JSON.stringify(columnValues) };
    }

    const result = await makeMondayRequest(mutation, variables);

    res.json({
      success: true,
      item:
        result.change_simple_column_value ||
        result.change_multiple_column_values,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const query = `
            query {
                users(limit: 100) {
                    id
                    name
                    email
                    title
                    birthday
                    country_code
                    is_admin
                    is_guest
                    enabled
                    created_at
                    time_zone_identifier
                    teams {
                        id
                        name
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      users: result.users || [],
      count: result.users?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/teams", async (req, res) => {
  try {
    const query = `
            query {
                teams(limit: 25) {
                    id
                    name
                    picture_url
                    users {
                        id
                        name
                        email
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      teams: result.teams || [],
      count: result.teams?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/activity", async (req, res) => {
  try {
    const query = `
            query {
                activity_logs(limit: 50) {
                    id
                    event
                    created_at
                    user_id
                    account_id
                    data
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      logs: result.activity_logs || [],
      count: result.activity_logs?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/updates", async (req, res) => {
  try {
    const query = `
            query {
                updates(limit: 50) {
                    id
                    body
                    text_body
                    created_at
                    updated_at
                    creator {
                        id
                        name
                    }
                    item {
                        id
                        name
                        board {
                            id
                            name
                        }
                    }
                    replies {
                        id
                        body
                        created_at
                        creator {
                            id
                            name
                        }
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      updates: result.updates || [],
      count: result.updates?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/create-update", async (req, res) => {
  try {
    const { itemId, text } = req.body;

    const mutation = `
            mutation($itemId: ID!, $body: String!) {
                create_update(
                    item_id: $itemId,
                    body: $body
                ) {
                    id
                    body
                    text_body
                    created_at
                    creator {
                        id
                        name
                    }
                }
            }
        `;

    const result = await makeMondayRequest(mutation, { itemId, body: text });

    res.json({
      success: true,
      update: result.create_update,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const query = `
            query {
                boards(limit: 200) {
                    id
                    state
                    board_kind
                    items_page(limit: 1) {
                        items {
                            id
                            state
                        }
                    }
                }
                users {
                    id
                    enabled
                    is_admin
                    is_guest
                }
                teams {
                    id
                }
            }
        `;

    const result = await makeMondayRequest(query);

    const boards = result.boards || [];
    const users = result.users || [];
    const teams = result.teams || [];

    const stats = {
      boards: {
        total: boards.length,
        active: boards.filter((b) => b.state === "active").length,
        archived: boards.filter((b) => b.state === "archived").length,
        public: boards.filter((b) => b.board_kind === "public").length,
        private: boards.filter((b) => b.board_kind === "private").length,
      },
      users: {
        total: users.length,
        active: users.filter((u) => u.enabled).length,
        admins: users.filter((u) => u.is_admin).length,
        guests: users.filter((u) => u.is_guest).length,
      },
      teams: {
        total: teams.length,
      },
    };

    res.json({
      success: true,
      statistics: stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const query = `
            query {
                activity_logs(limit: 100) {
                    id
                    event
                    created_at
                    user_id
                    account_id
                    data
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      logs: result.activity_logs || [],
      count: result.activity_logs?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/custom-query", async (req, res) => {
  try {
    const { query, variables } = req.body;

    if (!query) {
      throw new Error("Query is required");
    }

    const result = await makeMondayRequest(query, variables || {});

    res.json({
      success: true,
      data: result,
      query: query,
      variables: variables || {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      query: req.body.query,
    });
  }
});

app.get("/api/debug", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    version: "8.0 - Enhanced Navigation & Gantt",
    config: {
      apiUrl: MONDAY_CONFIG.apiUrl,
      apiVersion: MONDAY_CONFIG.apiVersion,
      hasToken: !!MONDAY_CONFIG.apiToken,
      rateLimit: MONDAY_CONFIG.rateLimit,
    },
    cache: {
      boardsCount: mondayCache.boards.length,
      usersCount: mondayCache.users.length,
      teamsCount: mondayCache.teams.length,
      lastUpdated: mondayCache.lastUpdated,
    },
    features: [
      "Enhanced navigation with breadcrumbs",
      "Project drill-down functionality",
      "Single project Gantt charts",
      "Real date detection from Monday.com",
      "Multi-level navigation (All → User → Project)",
      "Timeline analysis with date parsing",
    ],
    endpoints: [
      "GET /api/boards - Enhanced with column data",
      "GET /api/board/:id - Enhanced with full item details",
      "POST /api/create-board",
      "GET /api/items",
      "POST /api/create-item",
      "POST /api/update-item",
      "GET /api/users",
      "GET /api/teams",
      "GET /api/activity",
      "GET /api/updates",
      "POST /api/create-update",
      "GET /api/stats",
      "GET /api/logs",
      "POST /api/custom-query",
    ],
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    hasApiToken: !!MONDAY_CONFIG.apiToken,
    service: "Monday.com API MCP v8.0",
    features: [
      "Enhanced Navigation",
      "Project Drill-down",
      "Single Project Gantt",
    ],
  });
});

app.listen(port, () => {
  console.log(`📋 Monday.com API MCP v8.0 running on port ${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`🔗 GraphQL API: ${MONDAY_CONFIG.apiUrl}`);
  console.log(`🎯 Ready for Monday.com integration with enhanced navigation!`);

  if (!MONDAY_CONFIG.apiToken) {
    console.warn("⚠️ Please set MONDAY_API_TOKEN environment variable");
    console.warn(
      "📋 Get your token from: https://monday.com → Profile → Developer → My Access Tokens"
    );
  }
});
