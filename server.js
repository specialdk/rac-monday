// Monday.com API MCP Connection - Complete Setup
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
            justify-content: between;
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

         // Test connection to Monday.com
        function testConnection() {
    showLoading('connectionResult');
    
    fetch('/test-connection', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.user) {
                currentUser = data.user;
                // Remove account references since we don't have that data
                
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
                
        <div class="navigation-breadcrumb" id="navigationBreadcrumb">
            <div class="breadcrumb-item current" id="breadcrumbAll" onclick="navigateToAll()">
                👥 All Users
            </div>
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
    items(limit: 3) {
      id
      name
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

        // Enhanced navigation state
        let navigationState = {
            level: 'all', // 'all', 'user', 'project'
            userId: null,
            userLabel: null,
            projectId: null,
            projectName: null,
            projectData: null
        };
      
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
            
            updateBreadcrumb();
        }

        function navigateToUser() {
            console.log('🔄 Navigating back to User view');
            if (navigationState.userId) {
                navigationState.level = 'user';
                navigationState.projectId = null;
                navigationState.projectName = null;
                
                updateBreadcrumb();
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
                
                const mainItems = mainBoard.items && mainBoard.items.length ? mainBoard.items.length : 0;
                const subItems = relatedSubitems.reduce(function(sum, sub) {
                    return sum + (sub.items && sub.items.length ? sub.items.length : 0);
                }, 0);
                
                return {
                    id: mainBoard.id,
                    name: mainBoard.name,
                    description: mainBoard.description,
                    board_kind: mainBoard.board_kind,
                    groups: mainBoard.groups,
                    items: mainBoard.items,
                    hasSubitems: relatedSubitems.length > 0,
                    subitems: relatedSubitems,
                    totalItems: mainItems + subItems
                };
            });
        }

        function filterBoardsByUser(boards, userId) {
            if (!userId) return boards;
            
            return boards.filter(board => {
                const isOwner = board.owners && board.owners.some(owner => owner.id === userId);
                const isSubscriber = board.subscribers && board.subscribers.some(sub => sub.id === userId);
                return isOwner || isSubscriber;
            });
        }

       

        // Get all boards
        function getBoards() {
    showLoading('boardsResult');

    
    // Reset navigation to all users level
    navigationState.level = 'all';
    navigationState.userId = null;
    navigationState.userLabel = null;
    updateBreadcrumb();
    
    fetch('/api/boards')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Filter to show only current user's boards
                    const filteredBoards = filterBoardsByUser(data.boards, currentUser.id);
                    displayBoards(filteredBoards);
                    } else {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status disconnected">❌ Error: ' + (data.error || 'Failed to get boards') + '</div>';
                    }
                });
        }

        // Display boards in a nice format
        function displayBoards(boards) {
            const nestedBoards = createNestedBoardStructure(boards);
            
            let html = '<h4>📋 Your Projects (' + nestedBoards.length + ' main boards)</h4>';
            
            if (nestedBoards.length === 0) {
                html += '<p>No projects found.</p>';
                document.getElementById('boardsResult').innerHTML = html;
                return;
            }
            
            nestedBoards.forEach(board => {
                const itemCount = board.items ? board.items.length : 0;
                const groupCount = board.groups ? board.groups.length : 0;
                
                html += '<div class="board-card">';
                html += '<div class="board-header">';
                html += '<div class="board-name">📋 ' + board.name + '</div>';
                html += '</div>';
                html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
                html += '<div class="board-stats">';
                html += '<div class="stat">📝 ' + board.totalItems + ' total items</div>';
                html += '<div class="stat">📁 ' + groupCount + ' groups</div>';
                html += '<div class="stat">🆔 ' + board.id + '</div>';
                if (board.hasSubitems) {
                    html += '<div class="stat">🔎 ' + board.subitems.length + ' subitems</div>';
                }
                html += '</div>';
                html += '</div>';
            });
            
            document.getElementById('boardsResult').innerHTML = html;
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

// Get all boards
app.get("/api/boards", async (req, res) => {
  try {
    const query = `
            query {
                boards(limit: 50) {
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
                items(limit: 50) {
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
                    updates {
                        id
                        body
                        created_at
                    }
                }
            }
        `;

    const result = await makeMondayRequest(query);

    res.json({
      success: true,
      items: result.items || [],
      count: result.items?.length || 0,
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
                users(limit: 50) {
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
    // Get comprehensive stats
    const query = `
            query {
                boards(limit: 1000) {
                    id
                    state
                    board_kind
                    items {
                        id
                        state
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
      items: {
        total: boards.reduce(
          (sum, board) => sum + (board.items?.length || 0),
          0
        ),
        active: boards.reduce(
          (sum, board) =>
            sum +
            (board.items?.filter((item) => item.state === "active").length ||
              0),
          0
        ),
        done: boards.reduce(
          (sum, board) =>
            sum +
            (board.items?.filter((item) => item.state === "done").length || 0),
          0
        ),
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
