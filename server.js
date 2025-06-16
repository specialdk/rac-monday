// Monday.com API MCP Connection - Complete Setup
// File: server.js

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
                const boardIcon = board.board_kind === 'private' ? '🔒' : '📋';
                const kindBadge = board.board_kind === 'private' ? 
                    '<span style="background: #fef2f2; color: #dc2626; padding: 2px 6px; border-radius: 3px; font-size: 11px;">🔒 Private</span>' : 
                    '<span style="background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 3px; font-size: 11px;">🌐 Public</span>';
                
                html += '<div class="board-card">';
                html += '<div class="board-header">';
                html += '<div class="board-name">' + boardIcon + ' ' + board.name + ' ' + kindBadge + '</div>';
                html += '</div>';
                html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
                html += '<div class="board-stats">';
                html += '<div class="stat">📝 ' + itemCount + ' items</div>';
                html += '<div class="stat">📁 ' + groupCount + ' groups</div>';
                html += '<div class="stat">🆔 ' + board.id + '</div>';
                html += '</div>';
                
                // Special highlighting for Traffic Light Report
                if (board.name.includes('Traffic Light Report') || board.name.includes('Traffic Report')) {
                    html += '<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 6px; margin-top: 10px;">';
                    html += '<strong>⭐ Found your Traffic Report board!</strong><br>';
                    html += '<button onclick="getBoardDetails(\'' + board.id + '\')" style="margin-top: 5px;">📊 View Traffic Report Details</button>';
                    html += '</div>';
                }
                
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

// Get all boards - SIMPLE APPROACH WITH PRIVATE BOARD SUPPORT
app.get('/api/boards', async (req, res) => {
    try {
        const query = `
            query {
                boards(limit: 100, state: all) {
                    id
                    name
                    description
                    state
                    board_folder_id
                    board_kind
                    permissions
                    groups {
                        id
                        title
                        color
                    }
                    owners {
                        id
                        name
                        email
                    }
                }
            }
