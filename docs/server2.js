// Monday.com API MCP Connection - Complete Setup with User Filtering
// File: server.js

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

    if (data.errors) {
      throw new Error(data.errors.map((e) => e.message).join(", "));
    }

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

// Homepage with Monday.com interface
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Monday.com API MCP Connection</title>
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
        .item-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .item-row:last-child {
            border-bottom: none;
        }
        .status-label {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .status-working { background: #dbeafe; color: #1e40af; }
        .status-done { background: #dcfce7; color: #166534; }
        .status-stuck { background: #fef2f2; color: #dc2626; }
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
        .subitem-name {
            font-weight: bold;
            color: #4a5568;
            margin-bottom: 5px;
        }
        .subitem-stats {
            display: flex;
            gap: 10px;
            margin-bottom: 8px;
        }
        .subitem-items {
            font-size: 12px;
            color: #6b7280;
        }
        .subitem-row {
            padding: 2px 0;
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
            height: 24px;
            border-radius: 4px;
            position: absolute;
            display: flex;
            align-items: center;
            padding: 0 8px;
            font-size: 11px;
            color: white;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: transform 0.2s ease;
            min-width: 20px;
        }

        .gantt-bar:hover {
            transform: scale(1.05);
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .gantt-bar.status-planned { background: #3b82f6; }
        .gantt-bar.status-active { background: #10b981; }
        .gantt-bar.status-completed { background: #64748b; }
        .gantt-bar.status-delayed { background: #ef4444; }
        .gantt-bar.status-no-dates { 
            background: #f59e0b; 
            position: relative;
            left: 10px;
            width: 200px;
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

        .date-input {
            padding: 4px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            width: 100px;
        }

        .edit-dates-btn {
            background: #8b5cf6;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }

        .edit-dates-btn:hover {
            background: #7c3aed;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Monday.com API MCP Connection</h1>
        
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
            <h3>🔐 Step 1: Test Connection</h3>
            <p>Test your Monday.com API connection and get account info:</p>
            <button onclick="testConnection()">🚀 Test Monday.com Connection</button>
            <div id="connectionResult"></div>
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

                <div class="button-grid">
                    <button onclick="getBoards()" disabled id="btn-boards">📋 Get All Boards</button>
                    <button onclick="getBoardDetails()" disabled id="btn-board-details">🔍 Get Board Details</button>
                    <button onclick="createBoard()" disabled id="btn-create-board">➕ Create New Board</button>
                </div>
                <div id="boardsResult"></div>
            </div>

            <!-- Items Tab -->
            <div id="items-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getItems()" disabled id="btn-items">📝 Get All Items</button>
                    <button onclick="createItem()" disabled id="btn-create-item">➕ Create New Item</button>
                    <button onclick="updateItem()" disabled id="btn-update-item">✏️ Update Item</button>
                </div>
                <div id="itemsResult"></div>
            </div>

            <!-- Users Tab -->
            <div id="users-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getUsers()" disabled id="btn-users">👥 Get Users</button>
                    <button onclick="getTeams()" disabled id="btn-teams">🏢 Get Teams</button>
                    <button onclick="getUserActivity()" disabled id="btn-activity">📊 Get User Activity</button>
                </div>
                <div id="usersResult"></div>
            </div>

            <!-- Updates Tab -->
            <div id="updates-tab" class="tab-content">
                <div class="button-grid">
                    <button onclick="getUpdates()" disabled id="btn-updates">💬 Get Recent Updates</button>
                    <button onclick="createUpdate()" disabled id="btn-create-update">➕ Create Update</button>
                </div>
                <div id="updatesResult"></div>
            </div>

            <!-- Analytics Tab -->
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
        let isConnected = false;
        let currentUser = null;
        let allBoards = [];
        let allUsers = [];
        let currentFilter = 'ALL';

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

        // Enhanced getBoards function that also loads users
        function getBoards() {
            showLoading('boardsResult');
            document.getElementById('filterStatus').textContent = 'Loading projects and users...';
            
            // Load both boards and users
            Promise.all([
                fetch('/api/boards').then(response => response.json()),
                fetch('/api/users').then(response => response.json())
            ])
            .then(([boardsData, usersData]) => {
                if (boardsData.success && usersData.success) {
                    allBoards = boardsData.boards;
                    allUsers = usersData.users;
                    
                    populateUserFilter();
                    displayBoards(allBoards);
                    
                    document.getElementById('filterStatus').textContent = 
                        'Showing ' + allBoards.length + ' projects (All users)';
                } else {
                    document.getElementById('boardsResult').innerHTML = 
                        '<div class="status disconnected">❌ Error loading data</div>';
                }
            })
            .catch(error => {
                document.getElementById('boardsResult').innerHTML = 
                    '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
            });
        }

        // Populate the user filter dropdown
        function populateUserFilter() {
            const userSelect = document.getElementById('userFilter');
            userSelect.innerHTML = '';
            
            // Add "ALL" option
            const allOption = document.createElement('option');
            allOption.value = 'ALL';
            allOption.textContent = '👥 ALL USERS (' + allBoards.length + ' projects)';
            userSelect.appendChild(allOption);
            
            // Add individual users
            allUsers.forEach(user => {
                if (user.enabled) { // Only show active users
                    const userBoards = filterBoardsByUser(allBoards, user.id);
                    if (userBoards.length > 0) { // Only show users who have projects
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = '👤 ' + user.name + ' (' + userBoards.length + ' projects)';
                        userSelect.appendChild(option);
                    }
                }
            });
            
            // Enable the controls
            userSelect.disabled = false;
            document.getElementById('openFilterBtn').disabled = false;
            
            console.log('User filter populated with', allUsers.length, 'users');
        }

        // Filter boards by user (owner or subscriber)
        function filterBoardsByUser(boards, userId) {
            if (userId === 'ALL') {
                return boards;
            }
            
            return boards.filter(board => {
                // Check if user is owner
                const isOwner = board.owners && board.owners.some(owner => owner.id === userId);
                
                // Check if user is subscriber  
                const isSubscriber = board.subscribers && board.subscribers.some(sub => sub.id === userId);
                
                return isOwner || isSubscriber;
            });
        }

        // Apply the selected user filter
        function applyUserFilter() {
            const userSelect = document.getElementById('userFilter');
            const selectedUserId = userSelect.value;
            const selectedUserName = userSelect.options[userSelect.selectedIndex].textContent;
            
            console.log('Applying filter for user:', selectedUserId, selectedUserName);
            
            showLoading('boardsResult');
            document.getElementById('filterStatus').textContent = 'Filtering projects...';
            
            // Filter boards
            const filteredBoards = filterBoardsByUser(allBoards, selectedUserId);
            
            // Update display
            setTimeout(() => {
                displayBoards(filteredBoards);
                
                // Update status
                if (selectedUserId === 'ALL') {
                    document.getElementById('filterStatus').textContent = 
                        'Showing ' + filteredBoards.length + ' projects (All users)';
                } else {
                    const userName = selectedUserName.replace('👤 ', '').split(' (')[0];
                    document.getElementById('filterStatus').textContent = 
                        'Showing ' + filteredBoards.length + ' projects for ' + userName;
                }
                
                currentFilter = selectedUserId;
            }, 200);
        }

        // Helper function to create nested structure
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

        // Toggle function
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

        // Enhanced displayBoards with user filtering
        function displayBoards(boards) {
            console.log('Displaying boards with user filter...');
            
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
                
                // Add toggle button
                if (hasSubitems) {
                    html += '<button class="toggle-btn" data-board-id="' + board.id + '" id="toggle-' + board.id + '">';
                    html += '▶️ </button>';
                } else {
                    html += '<span style="width: 25px; display: inline-block;"></span>';
                }
                
                html += '<div class="board-name">📋 ' + board.name + '</div>';
                html += '</div>';
                
                html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
                html += '<p><strong>Type:</strong> ' + board.board_kind + ' | <strong>Workspace:</strong> ' + (board.workspace && board.workspace.name ? board.workspace.name : 'Unknown') + '</p>';
                
                // Add user information
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
                    html += '<div class="stat">📎 ' + board.subitems.length + ' subitems</div>';
                }
                html += '</div>';
                
                // Add subitems container
                if (hasSubitems) {
                    html += '<div class="subitems-container" id="subitems-' + board.id + '">';
                    html += '<h5>📎 Subitems:</h5>';
                    
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
            
            // Add event listeners for toggle buttons
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
            
            console.log('Boards displayed with user filtering');
        }

        // Get board details
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

        // Create new board
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
                        getBoards(); // Refresh board list
                    } else {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status disconnected">❌ Error: ' + (data.error || 'Failed to create board') + '</div>';
                    }
                });
        }

        // Get all items
        function getItems() {
            showLoading('itemsResult');
            
            fetch('/api/items')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('itemsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Create new item
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

        // Update item
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

        // Get users
        function getUsers() {
            showLoading('usersResult');
            
            fetch('/api/users')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('usersResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Get teams
        function getTeams() {
            showLoading('usersResult');
            
            fetch('/api/teams')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('usersResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Get user activity
        function getUserActivity() {
            showLoading('usersResult');
            
            fetch('/api/activity')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('usersResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Get updates
        function getUpdates() {
            showLoading('updatesResult');
            
            fetch('/api/updates')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('updatesResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Create update
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

        // Get workspace stats
        function getWorkspaceStats() {
            showLoading('analyticsResult');
            
            fetch('/api/stats')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('analyticsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Get activity logs
        function getActivityLogs() {
            showLoading('analyticsResult');
            
            fetch('/api/logs')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('analyticsResult').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Execute custom GraphQL query
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

        // Show debug information
        function showDebugInfo() {
            fetch('/api/debug')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('debugInfo').innerHTML = 
                        '<div class="result">' + JSON.stringify(data, null, 2) + '</div>';
                });
        }

        // Tab functionality
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }

        // Helper functions
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

// Test connection endpoint
app.post("/test-connection", async (req, res) => {
  try {
    console.log("🔍 Testing Monday.com connection...");

    const result = await testMondayConnection();

    // DEBUG: Let's see what we actually get
    console.log("📥 Raw API response:", JSON.stringify(result, null, 2));

    // Check if result.me exists
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

// Get all boards with enhanced data for user filtering
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
                    items_page(limit: 10) {
                        items {
                            id
                            name
                            state
                        }
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      boards: result.boards || [],
      count: result.boards?.length || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get specific board details
app.get("/api/board/:id", async (req, res) => {
  try {
    const boardId = req.params.id;

    const query = `
            query($boardId: ID!) {
                boards(ids: [$boardId]) {
                    id
                    name
                    description
                    state
                    board_kind
                    permissions
                    groups {
                        id
                        title
                        color
                        items {
                            id
                            name
                            state
                            column_values {
                                id
                                text
                                title
                                type
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

    res.json({
      success: true,
      board: result.boards?.[0] || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create new board
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

// Get all items
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

// Create new item
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

// Update item
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

// Get users
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

// Get teams
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

// Get activity logs
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

// Get updates
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

// Create update
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

// Get workspace statistics
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

    // Calculate statistics
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

// Get activity logs
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

// Execute custom GraphQL query
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

// Debug endpoint
app.get("/api/debug", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
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
    endpoints: [
      "GET /api/boards",
      "GET /api/board/:id",
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

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    hasApiToken: !!MONDAY_CONFIG.apiToken,
    service: "Monday.com API MCP",
  });
});

app.listen(port, () => {
  console.log(`📋 Monday.com API MCP running on port ${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`🔗 GraphQL API: ${MONDAY_CONFIG.apiUrl}`);
  console.log(`🎯 Ready for Monday.com integration!`);

  if (!MONDAY_CONFIG.apiToken) {
    console.warn("⚠️  Please set MONDAY_API_TOKEN environment variable");
    console.warn(
      "📋 Get your token from: https://monday.com → Profile → Developer → My Access Tokens"
    );
  }
});
