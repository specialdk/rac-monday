// Monday.com API MCP Connection - Complete Setup
// File: server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// Monday.com API Configuration
const MONDAY_CONFIG = {
    apiUrl: 'https://api.monday.com/v2',
    apiToken: process.env.MONDAY_API_TOKEN,
    apiVersion: '2023-04',
    
    // Rate limiting info
    rateLimit: {
        requests: 5000,
        period: 60 // seconds (per minute)
    }
};

// In-memory cache for boards, items, etc.
let mondayCache = {
    boards: [],
    users: [],
    teams: [],
    lastUpdated: null
};

app.use(express.json());
app.use(express.static('public'));

// Make authenticated GraphQL request to Monday.com
async function makeMondayRequest(query, variables = {}) {
    try {
        console.log('📡 Making Monday.com API request...');
        console.log('🔗 URL:', MONDAY_CONFIG.apiUrl);
        console.log('🎯 Query:', query.substring(0, 100) + '...');
        
        const response = await fetch(MONDAY_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': MONDAY_CONFIG.apiToken,
                'API-Version': MONDAY_CONFIG.apiVersion
            },
            body: JSON.stringify({
                query,
                variables
            })
        });

        console.log('📥 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📊 Response data keys:', Object.keys(data));
        
        if (data.errors) {
            console.error('❌ GraphQL Errors:', data.errors);
            throw new Error(data.errors.map(e => e.message).join(', '));
        }

        if (!data.data) {
            console.error('❌ No data in response:', data);
            throw new Error('No data field in API response');
        }

        console.log('✅ API request successful');
        return data.data;
    } catch (error) {
        console.error('❌ Monday.com API error:', error);
        throw error;
    }
}

// Test API connection
async function testMondayConnection() {
    try {
        console.log('📡 Testing Monday.com API connection...');
        
        const query = `
            query {
                me {
                    id
                    name
                    email
                    account {
                        id
                        name
                        plan {
                            version
                        }
                    }
                }
            }
        `;
        
        console.log('🔄 Making GraphQL request...');
        const result = await makeMondayRequest(query);
        
        console.log('📥 Raw API response:', JSON.stringify(result, null, 2));
        
        if (!result || !result.me) {
            throw new Error('Invalid response from Monday.com API - no user data found');
        }
        
        return result;
    } catch (error) {
        console.error('❌ Monday.com API test failed:', error);
        throw new Error(`Connection test failed: ${error.message}`);
    }
}

// Homepage with Monday.com interface
app.get('/', (req, res) => {
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
                <li>Rate Limit: ${MONDAY_CONFIG.rateLimit.requests} requests per minute</li>
                <li>API Token: <span id="tokenStatus">${MONDAY_CONFIG.apiToken ? 'Configured' : 'Not set'}</span></li>
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

        // Test connection to Monday.com
        function testConnection() {
            showLoading('connectionResult');
            
            fetch('/test-connection', { method: 'POST' })
                .then(response => {
                    console.log('Response status:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('Response data:', data);
                    if (data.success && data.user) {
                        currentUser = data.user;
                        const planVersion = data.user.account?.plan?.version || 'Unknown';
                        const accountName = data.user.account?.name || 'Unknown Account';
                        
                        document.getElementById('connectionResult').innerHTML = 
                            '<div class="status connected">✅ Connection successful!</div>' +
                            '<p><strong>User:</strong> ' + (data.user.name || 'Unknown') + ' (' + (data.user.email || 'No email') + ')</p>' +
                            '<p><strong>Account:</strong> ' + accountName + '</p>' +
                            '<p><strong>Plan:</strong> ' + planVersion + '</p>' +
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
                    console.error('Fetch error:', error);
                    document.getElementById('connectionResult').innerHTML = 
                        '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
                });
        }

        // Get all boards
        function getBoards() {
            showLoading('boardsResult');
            
            fetch('/api/boards')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        displayBoards(data.boards);
                    } else {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status disconnected">❌ Error: ' + (data.error || 'Failed to get boards') + '</div>';
                    }
                });
        }

        // Display boards in a nice format
        function displayBoards(boards) {
            let html = '<h4>📋 Your Boards (' + boards.length + ')</h4>';
            
            boards.forEach(board => {
                const itemCount = board.items ? board.items.length : 0;
                const groupCount = board.groups ? board.groups.length : 0;
                
                html += '<div class="board-card">';
                html += '<div class="board-header">';
                html += '<div class="board-name">📋 ' + board.name + '</div>';
                html += '</div>';
                html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
                html += '<div class="board-stats">';
                html += '<div class="stat">📝 ' + itemCount + ' items</div>';
                html += '<div class="stat">📁 ' + groupCount + ' groups</div>';
                html += '<div class="stat">🆔 ' + board.id + '</div>';
                html += '</div>';
                
                if (board.items && board.items.length > 0) {
                    html += '<h5>Recent Items:</h5>';
                    board.items.slice(0, 3).forEach(item => {
                        html += '<div class="item-row">';
                        html += '<span>📝 ' + item.name + '</span>';
                        html += '<span class="status-label status-working">Active</span>';
                        html += '</div>';
                    });
                }
                
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
app.post('/test-connection', async (req, res) => {
    try {
        console.log('🔍 Testing Monday.com connection...');
        
        if (!MONDAY_CONFIG.apiToken) {
            console.error('❌ No API token configured');
            throw new Error('API token not configured. Please set MONDAY_API_TOKEN environment variable.');
        }

        console.log('📡 Making API request to Monday.com...');
        const user = await testMondayConnection();
        
        console.log('✅ Monday.com connection successful:', {
            userId: user.me?.id,
            userName: user.me?.name,
            userEmail: user.me?.email
        });
        
        res.json({
            success: true,
            user: user.me,
            message: 'Connection successful'
        });
    } catch (error) {
        console.error('❌ Monday.com connection failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

// Check connection status
app.get('/connection-status', (req, res) => {
    res.json({
        hasToken: !!MONDAY_CONFIG.apiToken,
        apiUrl: MONDAY_CONFIG.apiUrl,
        apiVersion: MONDAY_CONFIG.apiVersion
    });
});

// Get all boards - ENHANCED TO INCLUDE MAIN WORKSPACE
app.get('/api/boards', async (req, res) => {
    try {
        // Get workspaces the user has access to
        const workspacesQuery = `
            query {
                workspaces(limit: 20) {
                    id
                    name
                    description
                    state
                }
            }
        `;

        const workspacesResult = await makeMondayRequest(workspacesQuery);
        console.log('🏢 Workspaces found:', workspacesResult.workspaces?.map(w => w.name));

        let allBoards = [];
        
        // Process all workspaces, including Main workspace
        for (const workspace of workspacesResult.workspaces || []) {
            try {
                const boardsQuery = `
                    query($workspaceId: ID!) {
                        boards(workspace_ids: [$workspaceId], limit: 50) {
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
                        }
                    }
                `;

                const boardsResult = await makeMondayRequest(boardsQuery, { workspaceId: workspace.id });
                
                if (boardsResult.boards && boardsResult.boards.length > 0) {
                    allBoards = [...allBoards, ...boardsResult.boards];
                    console.log(`📋 Found ${boardsResult.boards.length} boards in workspace "${workspace.name}"`);
                    console.log(`   Board names: ${boardsResult.boards.map(b => b.name).join(', ')}`);
                } else {
                    console.log(`📋 No boards accessible in workspace "${workspace.name}"`);
                }
            } catch (workspaceError) {
                console.log(`⚠️ Could not access workspace "${workspace.name}":`, workspaceError.message);
                
                // Try alternative method for Main workspace
                if (workspace.name === 'Main workspace') {
                    try {
                        console.log('🔄 Trying alternative query for Main workspace...');
                        const mainWorkspaceQuery = `
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
                                }
                            }
                        `;
                        
                        const mainResult = await makeMondayRequest(mainWorkspaceQuery);
                        const mainWorkspaceBoards = mainResult.boards?.filter(b => 
                            b.workspace?.name === 'Main workspace' || 
                            b.workspace?.id === '1110698'
                        ) || [];
                        
                        if (mainWorkspaceBoards.length > 0) {
                            allBoards = [...allBoards, ...mainWorkspaceBoards];
                            console.log(`📋 Found ${mainWorkspaceBoards.length} boards in Main workspace via alternative method`);
                            console.log(`   Board names: ${mainWorkspaceBoards.map(b => b.name).join(', ')}`);
                        }
                    } catch (alternativeError) {
                        console.log('⚠️ Alternative method for Main workspace also failed:', alternativeError.message);
                    }
                }
            }
        }
        
        console.log('📊 Total boards found:', allBoards.length);
        console.log('📝 All board names:', allBoards.map(b => b.name));
        
        res.json({
            success: true,
            boards: allBoards,
            count: allBoards.length,
            workspaces: workspacesResult.workspaces?.map(w => w.name) || [],
            note: 'Retrieved boards from accessible workspaces, including Main workspace'
        });
    } catch (error) {
        console.error('❌ Boards API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific board details
app.get('/api/board/:id', async (req, res) => {
    try {
        const boardId = req.params.id;
        
        const query = `
            query($boardId: [ID!]) {
                boards(ids: $boardId) {
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
                    items_page(limit: 25) {
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
                }
            }
        `;

        const result = await makeMondayRequest(query, { boardId: [boardId] });
        
        res.json({
            success: true,
            board: result.boards?.[0] || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create new board
app.post('/api/create-board', async (req, res) => {
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
            boardKind: boardKind || 'public',
            description: description || null
        };

        const result = await makeMondayRequest(mutation, variables);
        
        res.json({
            success: true,
            board: result.create_board
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all items - FIXED FOR ACCESSIBLE ITEMS
app.get('/api/items', async (req, res) => {
    try {
        const query = `
            query {
                items_page(limit: 50) {
                    items {
                        id
                        name
                        state
                        created_at
                        updated_at
                        board {
                            id
                            name
                            workspace {
                                id
                                name
                            }
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
        
        console.log('📝 Items API response:', {
            totalItems: result.items_page?.items?.length || 0,
            uniqueBoards: [...new Set(result.items_page?.items?.map(i => i.board?.name) || [])],
            sampleItems: result.items_page?.items?.slice(0, 3)?.map(i => i.name) || []
        });
        
        res.json({
            success: true,
            items: result.items_page?.items || [],
            count: result.items_page?.items?.length || 0,
            boardsSeen: [...new Set(result.items_page?.items?.map(i => i.board?.name) || [])]
        });
    } catch (error) {
        console.error('❌ Items API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create new item
app.post('/api/create-item', async (req, res) => {
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
            groupId: groupId || null
        };

        const result = await makeMondayRequest(mutation, variables);
        
        res.json({
            success: true,
            item: result.create_item
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update item
app.post('/api/update-item', async (req, res) => {
    try {
        const { itemId, name, columnValues } = req.body;
        
        let mutation = '';
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
            item: result.change_simple_column_value || result.change_multiple_column_values
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get users
app.get('/api/users', async (req, res) => {
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
            count: result.users?.length || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get teams
app.get('/api/teams', async (req, res) => {
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
            count: result.teams?.length || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get activity logs
app.get('/api/activity', async (req, res) => {
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
            count: result.activity_logs?.length || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get updates
app.get('/api/updates', async (req, res) => {
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
            count: result.updates?.length || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create update
app.post('/api/create-update', async (req, res) => {
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
            update: result.create_update
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get workspace statistics
app.get('/api/stats', async (req, res) => {
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
                active: boards.filter(b => b.state === 'active').length,
                archived: boards.filter(b => b.state === 'archived').length,
                public: boards.filter(b => b.board_kind === 'public').length,
                private: boards.filter(b => b.board_kind === 'private').length
            },
            items: {
                total: boards.reduce((sum, board) => sum + (board.items?.length || 0), 0),
                active: boards.reduce((sum, board) => 
                    sum + (board.items?.filter(item => item.state === 'active').length || 0), 0),
                done: boards.reduce((sum, board) => 
                    sum + (board.items?.filter(item => item.state === 'done').length || 0), 0)
            },
            users: {
                total: users.length,
                active: users.filter(u => u.enabled).length,
                admins: users.filter(u => u.is_admin).length,
                guests: users.filter(u => u.is_guest).length
            },
            teams: {
                total: teams.length
            }
        };
        
        res.json({
            success: true,
            statistics: stats,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get activity logs
app.get('/api/logs', async (req, res) => {
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
            count: result.activity_logs?.length || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Execute custom GraphQL query
app.post('/api/custom-query', async (req, res) => {
    try {
        const { query, variables } = req.body;
        
        if (!query) {
            throw new Error('Query is required');
        }
        
        const result = await makeMondayRequest(query, variables || {});
        
        res.json({
            success: true,
            data: result,
            query: query,
            variables: variables || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            query: req.body.query
        });
    }
});

// Test permissions endpoint
app.get('/api/test-permissions', async (req, res) => {
    try {
        const tests = [];
        
        // Test 1: Basic user info (should always work)
        try {
            const userQuery = `query { me { id name email } }`;
            const userResult = await makeMondayRequest(userQuery);
            tests.push({ test: 'User Info', status: 'PASS', data: userResult.me });
        } catch (error) {
            tests.push({ test: 'User Info', status: 'FAIL', error: error.message });
        }
        
        // Test 2: Account info
        try {
            const accountQuery = `query { me { account { id name plan { version } } } }`;
            const accountResult = await makeMondayRequest(accountQuery);
            tests.push({ test: 'Account Info', status: 'PASS', data: accountResult.me.account });
        } catch (error) {
            tests.push({ test: 'Account Info', status: 'FAIL', error: error.message });
        }
        
        // Test 3: Basic boards access
        try {
            const boardsQuery = `query { boards(limit: 1) { id name } }`;
            const boardsResult = await makeMondayRequest(boardsQuery);
            tests.push({ test: 'Basic Boards', status: 'PASS', data: boardsResult.boards });
        } catch (error) {
            tests.push({ test: 'Basic Boards', status: 'FAIL', error: error.message });
        }
        
        // Test 4: Users access
        try {
            const usersQuery = `query { users(limit: 1) { id name } }`;
            const usersResult = await makeMondayRequest(usersQuery);
            tests.push({ test: 'Users Access', status: 'PASS', data: usersResult.users });
        } catch (error) {
            tests.push({ test: 'Users Access', status: 'FAIL', error: error.message });
        }
        
        // Test 5: Teams access
        try {
            const teamsQuery = `query { teams(limit: 1) { id name } }`;
            const teamsResult = await makeMondayRequest(teamsQuery);
            tests.push({ test: 'Teams Access', status: 'PASS', data: teamsResult.teams });
        } catch (error) {
            tests.push({ test: 'Teams Access', status: 'FAIL', error: error.message });
        }
        
        const passedTests = tests.filter(t => t.status === 'PASS').length;
        const totalTests = tests.length;
        
        res.json({
            success: true,
            summary: `${passedTests}/${totalTests} permission tests passed`,
            tests,
            recommendations: generateRecommendations(tests)
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

function generateRecommendations(tests) {
    const recommendations = [];
    
    const failedTests = tests.filter(t => t.status === 'FAIL');
    
    if (failedTests.some(t => t.test === 'Basic Boards')) {
        recommendations.push('Your account may need board access permissions or a plan upgrade');
    }
    
    if (failedTests.some(t => t.test === 'Users Access')) {
        recommendations.push('User management requires admin privileges or higher plan');
    }
    
    if (failedTests.some(t => t.test === 'Teams Access')) {
        recommendations.push('Team access requires admin privileges');
    }
    
    if (failedTests.length === 0) {
        recommendations.push('All permissions working! You have full API access');
    }
    
    return recommendations;
}

// Debug endpoint - RESTORED
app.get('/api/debug', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        config: {
            apiUrl: MONDAY_CONFIG.apiUrl,
            apiVersion: MONDAY_CONFIG.apiVersion,
            hasToken: !!MONDAY_CONFIG.apiToken,
            rateLimit: MONDAY_CONFIG.rateLimit
        },
        cache: {
            boardsCount: mondayCache.boards.length,
            usersCount: mondayCache.users.length,
            teamsCount: mondayCache.teams.length,
            lastUpdated: mondayCache.lastUpdated
        },
        endpoints: [
            'GET /api/boards',
            'GET /api/board/:id', 
            'POST /api/create-board',
            'GET /api/items',
            'POST /api/create-item',
            'POST /api/update-item',
            'GET /api/users',
            'GET /api/teams',
            'GET /api/activity',
            'GET /api/updates',
            'POST /api/create-update',
            'GET /api/stats',
            'GET /api/logs',
            'POST /api/custom-query',
            'GET /api/test-permissions'
        ],
        permissionTests: 'Available at /api/test-permissions'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        hasApiToken: !!MONDAY_CONFIG.apiToken,
        service: 'Monday.com API MCP'
    });
});

app.listen(port, () => {
    console.log(`📋 Monday.com API MCP running on port ${port}`);
    console.log(`📊 Dashboard: http://localhost:${port}`);
    console.log(`🔗 GraphQL API: ${MONDAY_CONFIG.apiUrl}`);
    console.log(`🎯 Ready for Monday.com integration!`);
    
    if (!MONDAY_CONFIG.apiToken) {
        console.warn('⚠️  Please set MONDAY_API_TOKEN environment variable');
        console.warn('📋 Get your token from: https://monday.com → Profile → Developer → My Access Tokens');
    }
});
// PRIVATE BOARDS EXTENSION - Add this to the END of your server.js file

// Get all boards including private ones - Enhanced endpoint
app.get('/api/boards-all', async (req, res) => {
    try {
        console.log('🔍 Fetching ALL boards (public + private)...');
        
        let allBoards = [];
        
        // Method 1: Try to get all boards directly (works for boards you own/have access to)
        try {
            const allBoardsQuery = `
                query {
                    boards(limit: 200) {
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
                        subscribers {
                            id
                            name
                        }
                    }
                }
            `;
            
            const directResult = await makeMondayRequest(allBoardsQuery);
            allBoards = directResult.boards || [];
            console.log(`📋 Direct method found ${allBoards.length} boards`);
            
        } catch (directError) {
            console.log('⚠️ Direct boards query failed:', directError.message);
        }
        
        // Method 2: Get boards from workspaces (including private workspaces)
        try {
            const workspacesQuery = `
                query {
                    workspaces(limit: 50) {
                        id
                        name
                        description
                        state
                        kind
                    }
                }
            `;
            
            const workspacesResult = await makeMondayRequest(workspacesQuery);
            console.log('🏢 Available workspaces:', workspacesResult.workspaces?.map(w => `${w.name} (${w.kind})`));
            
            for (const workspace of workspacesResult.workspaces || []) {
                try {
                    const workspaceBoardsQuery = `
                        query($workspaceId: ID!) {
                            boards(workspace_ids: [$workspaceId], limit: 100) {
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
                            }
                        }
                    `;
                    
                    const workspaceBoards = await makeMondayRequest(workspaceBoardsQuery, { workspaceId: workspace.id });
                    
                    if (workspaceBoards.boards && workspaceBoards.boards.length > 0) {
                        // Add boards that aren't already in our list
                        const newBoards = workspaceBoards.boards.filter(wb => 
                            !allBoards.some(ab => ab.id === wb.id)
                        );
                        allBoards = [...allBoards, ...newBoards];
                        console.log(`📋 Workspace "${workspace.name}": found ${workspaceBoards.boards.length} boards (${newBoards.length} new)`);
                    }
                    
                } catch (workspaceError) {
                    console.log(`⚠️ Could not access workspace "${workspace.name}":`, workspaceError.message);
                }
            }
            
        } catch (workspaceError) {
            console.log('⚠️ Workspace enumeration failed:', workspaceError.message);
        }
        
        // Method 3: Try to get boards you're subscribed to
        try {
            const myBoardsQuery = `
                query {
                    me {
                        id
                        name
                    }
                }
            `;
            
            const meResult = await makeMondayRequest(myBoardsQuery);
            
            if (meResult.me?.id) {
                // Get boards where current user is owner or subscriber
                const userBoardsQuery = `
                    query {
                        boards(limit: 200) {
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
                            owners {
                                id
                                name
                                email
                            }
                            subscribers {
                                id
                                name
                            }
                            groups {
                                id
                                title
                                color
                            }
                        }
                    }
                `;
                
                const userResult = await makeMondayRequest(userBoardsQuery);
                const userBoards = userResult.boards || [];
                
                // Filter for boards where user is owner or subscriber
                const myBoards = userBoards.filter(board => 
                    board.owners?.some(owner => owner.id === meResult.me.id) ||
                    board.subscribers?.some(sub => sub.id === meResult.me.id)
                );
                
                // Add any new boards
                const newUserBoards = myBoards.filter(ub => 
                    !allBoards.some(ab => ab.id === ub.id)
                );
                allBoards = [...allBoards, ...newUserBoards];
                console.log(`👤 User-specific search: found ${myBoards.length} boards (${newUserBoards.length} new)`);
            }
            
        } catch (userError) {
            console.log('⚠️ User-specific boards search failed:', userError.message);
        }
        
        // Categorize boards
        const publicBoards = allBoards.filter(b => b.board_kind === 'public');
        const privateBoards = allBoards.filter(b => b.board_kind === 'private');
        const shareableBoards = allBoards.filter(b => b.board_kind === 'share');
        
        console.log('📊 Final board summary:', {
            total: allBoards.length,
            public: publicBoards.length,
            private: privateBoards.length,
            shareable: shareableBoards.length
        });
        
        res.json({
            success: true,
            boards: allBoards,
            summary: {
                total: allBoards.length,
                public: publicBoards.length,
                private: privateBoards.length,
                shareable: shareableBoards.length,
                byWorkspace: allBoards.reduce((acc, board) => {
                    const workspace = board.workspace?.name || 'Unknown';
                    acc[workspace] = (acc[workspace] || 0) + 1;
                    return acc;
                }, {})
            },
            categorized: {
                public: publicBoards,
                private: privateBoards,
                shareable: shareableBoards
            },
            note: 'Retrieved all accessible boards including private ones'
        });
        
    } catch (error) {
        console.error('❌ Enhanced boards API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get only private boards
app.get('/api/boards-private', async (req, res) => {
    try {
        console.log('🔒 Fetching PRIVATE boards only...');
        
        const query = `
            query {
                boards(limit: 200) {
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
                    items_page(limit: 5) {
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
        const allBoards = result.boards || [];
        
        // Filter for private boards only
        const privateBoards = allBoards.filter(board => board.board_kind === 'private');
        
        console.log(`🔒 Found ${privateBoards.length} private boards out of ${allBoards.length} total`);
        
        res.json({
            success: true,
            boards: privateBoards,
            count: privateBoards.length,
            totalChecked: allBoards.length,
            boardNames: privateBoards.map(b => b.name),
            note: 'Filtered for private boards only'
        });
        
    } catch (error) {
        console.error('❌ Private boards API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get boards by permissions level
app.get('/api/boards-by-permission', async (req, res) => {
    try {
        const permissionLevel = req.query.level || 'all'; // all, owner, subscriber, viewer
        
        console.log(`🔐 Fetching boards by permission level: ${permissionLevel}`);
        
        const query = `
            query {
                me {
                    id
                    name
                }
                boards(limit: 200) {
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
        
        const result = await makeMondayRequest(query);
        const currentUser = result.me;
        const allBoards = result.boards || [];
        
        let filteredBoards = allBoards;
        
        if (permissionLevel === 'owner') {
            filteredBoards = allBoards.filter(board => 
                board.owners?.some(owner => owner.id === currentUser.id)
            );
        } else if (permissionLevel === 'subscriber') {
            filteredBoards = allBoards.filter(board => 
                board.subscribers?.some(sub => sub.id === currentUser.id)
            );
        } else if (permissionLevel === 'private-owner') {
            filteredBoards = allBoards.filter(board => 
                board.board_kind === 'private' && 
                board.owners?.some(owner => owner.id === currentUser.id)
            );
        }
        
        const summary = {
            total: filteredBoards.length,
            public: filteredBoards.filter(b => b.board_kind === 'public').length,
            private: filteredBoards.filter(b => b.board_kind === 'private').length,
            shareable: filteredBoards.filter(b => b.board_kind === 'share').length
        };
        
        console.log(`🔐 Permission filter "${permissionLevel}": ${filteredBoards.length} boards`);
        
        res.json({
            success: true,
            boards: filteredBoards,
            summary,
            filter: permissionLevel,
            currentUser: {
                id: currentUser.id,
                name: currentUser.name
            },
            note: `Filtered boards by permission level: ${permissionLevel}`
        });
        
    } catch (error) {
        console.error('❌ Permission-based boards API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Enhanced test for private board access
app.get('/api/test-private-access', async (req, res) => {
    try {
        console.log('🧪 Testing private board access capabilities...');
        
        const tests = [];
        
        // Test 1: Can we see board kinds?
        try {
            const boardKindsQuery = `
                query {
                    boards(limit: 10) {
                        id
                        name
                        board_kind
                        permissions
                    }
                }
            `;
            const result = await makeMondayRequest(boardKindsQuery);
            const boards = result.boards || [];
            const kinds = [...new Set(boards.map(b => b.board_kind))];
            
            tests.push({
                test: 'Board Kinds Detection',
                status: 'PASS',
                data: { totalBoards: boards.length, kinds }
            });
        } catch (error) {
            tests.push({
                test: 'Board Kinds Detection',
                status: 'FAIL',
                error: error.message
            });
        }
        
        // Test 2: Can we access workspace info?
        try {
            const workspaceQuery = `
                query {
                    workspaces {
                        id
                        name
                        kind
                        state
                    }
                }
            `;
            const result = await makeMondayRequest(workspaceQuery);
            const workspaces = result.workspaces || [];
            
            tests.push({
                test: 'Workspace Access',
                status: 'PASS',
                data: { 
                    count: workspaces.length,
                    types: [...new Set(workspaces.map(w => w.kind))]
                }
            });
        } catch (error) {
            tests.push({
                test: 'Workspace Access',
                status: 'FAIL',
                error: error.message
            });
        }
        
        // Test 3: Can we see ownership info?
        try {
            const ownershipQuery = `
                query {
                    me { id name }
                    boards(limit: 5) {
                        id
                        name
                        board_kind
                        owners { id name }
                        subscribers { id name }
                    }
                }
            `;
            const result = await makeMondayRequest(ownershipQuery);
            const me = result.me;
            const boards = result.boards || [];
            
            const ownedBoards = boards.filter(b => 
                b.owners?.some(owner => owner.id === me.id)
            );
            
            tests.push({
                test: 'Ownership Detection',
                status: 'PASS',
                data: { 
                    userId: me.id,
                    totalBoards: boards.length,
                    ownedBoards: ownedBoards.length
                }
            });
        } catch (error) {
            tests.push({
                test: 'Ownership Detection',
                status: 'FAIL',
                error: error.message
            });
        }
        
        const passCount = tests.filter(t => t.status === 'PASS').length;
        
        res.json({
            success: true,
            summary: `${passCount}/${tests.length} private access tests passed`,
            tests,
            recommendations: passCount === tests.length ? 
                ['All tests passed! You should be able to access private boards'] :
                ['Some tests failed - check your API token permissions']
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

console.log('🔒 Private boards endpoints added:');
console.log('   GET /api/boards-all - All boards (public + private)');
console.log('   GET /api/boards-private - Private boards only'); 
console.log('   GET /api/boards-by-permission?level=owner - Filter by permission');
console.log('   GET /api/test-private-access - Test private access capabilities');
