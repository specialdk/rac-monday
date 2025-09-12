// Monday.com API MCP Connection - v2.2 Fixed
const express = require("express");
const fetch = require("node-fetch");
const app = express();
const port = process.env.PORT || 3000;

const MONDAY_CONFIG = {
  apiUrl: "https://api.monday.com/v2",
  apiToken: process.env.MONDAY_API_TOKEN,
  apiVersion: "2023-04",
};

app.use(express.json());

async function makeMondayRequest(query, variables = {}) {
  try {
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
    if (data.errors)
      throw new Error(data.errors.map((e) => e.message).join(", "));
    return data.data;
  } catch (error) {
    console.error("Monday.com API error:", error);
    throw error;
  }
}

async function testMondayConnection() {
  const query = `query { me { id name email } }`;
  return await makeMondayRequest(query);
}

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Monday.com MCP v2.1 - Fixed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: white; padding: 20px; border-radius: 8px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .pending { background: #fff3cd; color: #856404; }
        button { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
        .clickable { cursor: pointer; color: #007bff; text-decoration: underline; }
        .project-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Monday.com MCP v2.1 - Fixed</h1>
        
        <div>
            <h3>Connection Status</h3>
            <div id="connectionStatus" class="status disconnected">Not Connected</div>
            <button type="button" id="testBtn">Test Connection</button>
            <div id="connectionResult"></div>
        </div>

        <div>
            <h3>Your Projects</h3>
            <button type="button" id="boardsBtn" disabled>Get Boards</button>
            <div id="boardsResult"></div>
        </div>
    </div>

<script>
// Global variables
let isConnected = false;
let allBoards = [];

// Test connection function
function testConnection() {
    console.log('testConnection called');
    document.getElementById('connectionResult').innerHTML = '<div class="status pending">Testing connection...</div>';
    
    fetch('/test-connection', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.user) {
                document.getElementById('connectionResult').innerHTML = 
                    '<div class="status connected">Connection successful!<br>User: ' + data.user.name + ' (' + data.user.email + ')</div>';
                
                document.getElementById('connectionStatus').innerHTML = 'Connected - API ready';
                document.getElementById('connectionStatus').className = 'status connected';
                
                document.getElementById('boardsBtn').disabled = false;
                isConnected = true;
            } else {
                document.getElementById('connectionResult').innerHTML = 
                    '<div class="status disconnected">Connection failed: ' + (data.error || 'Unknown error') + '</div>';
            }
        })
        .catch(error => {
            document.getElementById('connectionResult').innerHTML = 
                '<div class="status disconnected">Network Error: ' + error.message + '</div>';
        });
}

// Get boards function
function getBoards() {
    console.log('getBoards called');
    document.getElementById('boardsResult').innerHTML = '<div class="status pending">Loading boards...</div>';
    
    fetch('/api/boards')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allBoards = data.boards;
                displayBoards(data.boards);
            } else {
                document.getElementById('boardsResult').innerHTML = 
                    '<div class="status disconnected">Error loading boards: ' + data.error + '</div>';
            }
        })
        .catch(error => {
            document.getElementById('boardsResult').innerHTML = 
                '<div class="status disconnected">Network Error: ' + error.message + '</div>';
        });
}

// Display boards function
function displayBoards(boards) {
    let html = '<h4>Your Projects (' + boards.length + ' boards)</h4>';
    
    boards.forEach(board => {
        const itemCount = board.items_page && board.items_page.items ? board.items_page.items.length : 0;
        
        html += '<div class="project-card">';
        html += '<div class="clickable" onclick="drillDown(\'' + board.id + '\', \'' + board.name + '\')">';
        html += board.name + '</div>';
        html += '<p>Description: ' + (board.description || 'No description') + '</p>';
        html += '<p>Items: ' + itemCount + ' | ID: ' + board.id + '</p>';
        html += '</div>';
    });
    
    document.getElementById('boardsResult').innerHTML = html;
}

// Drill down function
function drillDown(boardId, boardName) {
    console.log('drillDown called:', boardName, boardId);
    
    document.getElementById('boardsResult').innerHTML = '<div class="status pending">Loading project details...</div>';
    
    fetch('/api/board/' + boardId)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.board) {
                displaySingleProject(data.board);
            } else {
                document.getElementById('boardsResult').innerHTML = 
                    '<div class="status disconnected">Error loading project details</div>';
            }
        })
        .catch(error => {
            document.getElementById('boardsResult').innerHTML = 
                '<div class="status disconnected">Network Error: ' + error.message + '</div>';
        });
}

// Display single project
function displaySingleProject(board) {
    let html = '<button type="button" onclick="backToBoards()">← Back to All Projects</button>';
    html += '<h3>' + board.name + '</h3>';
    html += '<p>Description: ' + (board.description || 'No description') + '</p>';
    
    if (board.columns && board.columns.length > 0) {
        html += '<h4>Available Columns:</h4>';
        board.columns.forEach(column => {
            html += '<div style="margin: 5px 0; padding: 5px; background: #f8f9fa;">';
            html += column.title + ' (' + column.type + ')';
            html += '</div>';
        });
    }
    
    document.getElementById('boardsResult').innerHTML = html;
}

// Back to boards function
function backToBoards() {
    displayBoards(allBoards);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('testBtn').addEventListener('click', testConnection);
    document.getElementById('boardsBtn').addEventListener('click', getBoards);
});

</script>
</body>
</html>`);
});

// Backend endpoints
app.post("/test-connection", async (req, res) => {
  try {
    const result = await testMondayConnection();
    if (!result?.me) {
      return res.json({ success: false, error: "No user data returned" });
    }
    res.json({ success: true, user: result.me });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/boards", async (req, res) => {
  try {
    const query = `query {
      boards(limit: 50) {
        id name description state board_kind
        items_page(limit: 5) {
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
    const query = `query($boardId: ID!) {
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
  console.log(`Monday.com MCP v2.1 running on port ${port}`);
});
