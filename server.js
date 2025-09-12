// Monday.com API MCP Connection - v2.1 Enhanced with Gantt Chart and Navigation
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
  rateLimit: {
    requests: 5000,
    period: 60,
  },
};

// In-memory cache
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
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

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
  const query = `query { me { id name email } }`;
  return await makeMondayRequest(query);
}

// Homepage
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Monday.com MCP v2.1 - Enhanced Gantt & Navigation</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #FF5722 0%, #FF7043 100%); min-height: 100vh; }
        .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); }
        h1 { color: #2d3748; text-align: center; margin-bottom: 30px; }
        .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .status { padding: 12px; border-radius: 6px; margin: 10px 0; font-weight: 500; }
        .status.connected { background: #ecfdf5; border: 1px solid #10b981; color: #047857; }
        .status.disconnected { background: #fef2f2; border: 1px solid #ef4444; color: #dc2626; }
        .status.pending { background: #fffbeb; border: 1px solid #f59e0b; color: #d97706; }
        button { background: #FF5722; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; margin: 5px; font-size: 14px; }
        button:hover { background: #FF7043; }
        button:disabled { background: #9ca3af; cursor: not-allowed; }
        .board-name.clickable-project { cursor: pointer; transition: color 0.2s ease; }
        .board-name.clickable-project:hover { color: #FF5722; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Monday.com MCP v2.1 - Enhanced Gantt & Navigation</h1>
        
        <div class="section">
            <h3>🔗 Connection Status</h3>
            <div id="connectionStatus" class="status disconnected">❌ Not Connected</div>
            <button onclick="testConnection()">🚀 Test Connection</button>
            <div id="connectionResult"></div>
        </div>

        <div class="section">
            <h3>📊 Your Projects</h3>
            <button onclick="getBoards()" disabled id="btn-boards">📋 Get All Boards</button>
            <div id="boardsResult"></div>
        </div>
    </div>

    <script>
        let isConnected = false;
        let allBoards = [];

        function testConnection() {
            document.getElementById('connectionResult').innerHTML = '<div class="status pending">🔄 Testing...</div>';
            
            fetch('/test-connection', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.user) {
                        document.getElementById('connectionResult').innerHTML = 
                            '<div class="status connected">✅ Connection successful!</div>' +
                            '<p><strong>User:</strong> ' + data.user.name + ' (' + data.user.email + ')</p>';
                        
                        document.getElementById('connectionStatus').innerHTML = '✅ Connected - Monday.com API ready';
                        document.getElementById('connectionStatus').className = 'status connected';
                        
                        document.getElementById('btn-boards').disabled = false;
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

        function getBoards() {
            document.getElementById('boardsResult').innerHTML = '<div class="status pending">🔄 Loading boards...</div>';
            
            fetch('/api/boards')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        allBoards = data.boards;
                        displayBoards(data.boards);
                    } else {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status disconnected">❌ Error loading boards</div>';
                    }
                })
                .catch(error => {
                    document.getElementById('boardsResult').innerHTML = 
                        '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
                });
        }

        function displayBoards(boards) {
            let html = '<h4>📋 Your Projects (' + boards.length + ' boards)</h4>';
            
            boards.forEach(board => {
                const itemCount = board.items_page && board.items_page.items ? board.items_page.items.length : 0;
                
                html += '<div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 15px; margin: 10px 0; background: white;">';
                html += '<div class="board-name clickable-project" onclick="drillDownToProject(\'' + board.id + '\', \'' + board.name + '\')">';
                html += '📋 ' + board.name + '</div>';
                html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
                html += '<p><strong>Items:</strong> ' + itemCount + ' | <strong>ID:</strong> ' + board.id + '</p>';
                html += '</div>';
            });
            
            document.getElementById('boardsResult').innerHTML = html;
        }

        function drillDownToProject(boardId, boardName) {
            console.log('🔍 DEBUG: Drilling down to project:', boardName, boardId);
            
            document.getElementById('boardsResult').innerHTML = '<div class="status pending">🔄 Loading project details...</div>';
            
            fetch('/api/board/' + boardId)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.board) {
                        displaySingleProject(data.board);
                    } else {
                        document.getElementById('boardsResult').innerHTML = 
                            '<div class="status disconnected">❌ Error loading project details</div>';
                    }
                })
                .catch(error => {
                    document.getElementById('boardsResult').innerHTML = 
                        '<div class="status disconnected">❌ Network Error: ' + error.message + '</div>';
                });
        }

        function displaySingleProject(board) {
            let html = '<div>';
            html += '<button onclick="backToAllProjects()" style="background: #64748b; color: white; margin-bottom: 20px;">← Back to All Projects</button>';
            html += '<h3>📋 ' + board.name + '</h3>';
            html += '<p><strong>Description:</strong> ' + (board.description || 'No description') + '</p>';
            
            if (board.columns && board.columns.length > 0) {
                html += '<h4>📊 Available Columns:</h4>';
                board.columns.forEach(column => {
                    html += '<div style="margin: 5px 0; padding: 5px; background: #f1f5f9; border-radius: 4px;">';
                    html += '<strong>' + column.title + '</strong> (' + column.type + ')';
                    html += '</div>';
                });
            }
            
            if (board.groups && board.groups.length > 0) {
                html += '<h4>📝 Project Items:</h4>';
                board.groups.forEach(group => {
                    if (group.items && group.items.length > 0) {
                        html += '<h5>📁 ' + group.title + ' (' + group.items.length + ' items)</h5>';
                        group.items.forEach(item => {
                            html += '<div style="padding: 8px; margin: 4px 0; background: #f8fafc; border-radius: 4px;">';
                            html += '<strong>' + item.name + '</strong> (State: ' + item.state + ')';
                            html += '</div>';
                        });
                    }
                });
            }
            
            html += '</div>';
            document.getElementById('boardsResult').innerHTML = html;
        }

        function backToAllProjects() {
            displayBoards(allBoards);
        }
    </script>
</body>
</html>`);
});

// Backend endpoints
app.post("/test-connection", async (req, res) => {
  try {
    const result = await testMondayConnection();
    if (!result || !result.me) {
      return res.json({ success: false, error: "No user data returned" });
    }
    res.json({ success: true, user: result.me });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/boards", async (req, res) => {
  try {
    const query = `
      query {
        boards(limit: 100) {
          id name description state board_kind
          items_page(limit: 10) {
            items { id name state }
          }
        }
      }`;

    const result = await makeMondayRequest(query);
    res.json({ success: true, boards: result.boards || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/board/:id", async (req, res) => {
  try {
    const query = `
      query($boardId: ID!) {
        boards(ids: [$boardId]) {
          id name description state board_kind
          columns { id title type }
          groups {
            id title
            items { id name state }
          }
        }
      }`;

    const result = await makeMondayRequest(query, { boardId: req.params.id });
    res.json({ success: true, board: result.boards?.[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`📋 Monday.com MCP v2.1 running on port ${port}`);
});
