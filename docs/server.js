// Monday.com API MCP Connection - Complete Setup with User Filtering
// File: server.js

// Complete JavaScript for Monday.com Dashboard with Gantt Chart
// Replace the entire <script> section in your HTML with this code

let isConnected = false;
let currentUser = null;
let allBoards = [];
let allUsers = [];
let currentFilter = 'ALL';
let currentFilteredBoards = [];

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

// Enhanced applyUserFilter to update Gantt data
function applyUserFilter() {
    const userSelect = document.getElementById('userFilter');
    const selectedUserId = userSelect.value;
    const selectedUserName = userSelect.options[userSelect.selectedIndex].textContent;
    
    console.log('Applying filter for user:', selectedUserId, selectedUserName);
    
    showLoading('boardsResult');
    document.getElementById('filterStatus').textContent = 'Filtering projects...';
    
    // Filter boards
    const filteredBoards = filterBoardsByUser(allBoards, selectedUserId);
    currentFilteredBoards = filteredBoards; // Store for Gantt chart
    
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
        
        // Enable Gantt chart and show section
        document.getElementById('showGanttBtn').disabled = false;
        document.getElementById('ganttSection').style.display = 'block';
        document.getElementById('ganttStatus').textContent = 
            'Ready to show timeline for ' + filteredBoards.length + ' projects';
            
        // If Gantt is currently visible, refresh it
        if (document.getElementById('hideGanttBtn').style.display !== 'none') {
            setTimeout(() => showGanttChart(), 500);
        }
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

// GANTT CHART FUNCTIONS

// Show Gantt chart
function showGanttChart() {
    console.log('Showing Gantt chart for', currentFilteredBoards.length, 'projects');
    
    if (currentFilteredBoards.length === 0) {
        document.getElementById('ganttContainer').innerHTML = 
            '<div class="status disconnected">❌ No projects to display. Please load projects first.</div>';
        return;
    }
    
    document.getElementById('ganttStatus').textContent = 'Loading project timelines...';
    
    // Get detailed project data with dates
    getProjectDatesAndShowGantt();
}

// Hide Gantt chart
function hideGanttChart() {
    document.getElementById('ganttContainer').innerHTML = '';
    document.getElementById('showGanttBtn').style.display = 'inline-block';
    document.getElementById('hideGanttBtn').style.display = 'none';
    document.getElementById('ganttStatus').textContent = 'Gantt chart hidden';
}

// Get project dates and show Gantt
async function getProjectDatesAndShowGantt() {
    showLoading('ganttContainer');
    
    try {
        // Get detailed board data with date columns
        const boardPromises = currentFilteredBoards.map(board => 
            fetch('/api/board/' + board.id).then(response => response.json())
        );
        
        const boardDetails = await Promise.all(boardPromises);
        
        // Process boards and extract date information
        const projectsWithDates = boardDetails.map((boardData, index) => {
            const board = boardData.board;
            const originalBoard = currentFilteredBoards[index];
            
            if (!board) {
                return {
                    ...originalBoard,
                    startDate: null,
                    endDate: null,
                    status: 'no-dates'
                };
            }
            
            // Extract dates from items with better logic
            let startDate = null;
            let endDate = null;
            let itemCount = 0;
            
            if (board.groups && board.groups.length > 0) {
                board.groups.forEach(group => {
                    if (group.items && group.items.length > 0) {
                        group.items.forEach(item => {
                            itemCount++;
                            if (item.column_values && item.column_values.length > 0) {
                                item.column_values.forEach(colVal => {
                                    if (colVal.type === 'date' && colVal.value && colVal.value !== '{}') {
                                        try {
                                            const dateValue = JSON.parse(colVal.value);
                                            if (dateValue.date) {
                                                const itemDate = new Date(dateValue.date);
                                                
                                                // Better date column detection
                                                const columnTitle = colVal.title.toLowerCase();
                                                if (columnTitle.includes('start') || columnTitle.includes('begin')) {
                                                    if (!startDate || itemDate < startDate) {
                                                        startDate = itemDate;
                                                    }
                                                } else if (columnTitle.includes('end') || 
                                                         columnTitle.includes('due') || 
                                                         columnTitle.includes('deadline') ||
                                                         columnTitle.includes('finish')) {
                                                    if (!endDate || itemDate > endDate) {
                                                        endDate = itemDate;
                                                    }
                                                } else {
                                                    // If no specific type, use as both start and end reference
                                                    if (!startDate || itemDate < startDate) {
                                                        startDate = itemDate;
                                                    }
                                                    if (!endDate || itemDate > endDate) {
                                                        endDate = itemDate;
                                                    }
                                                }
                                            }
                                        } catch (e) {
                                            console.log('Date parsing error for', colVal.title, ':', e.message);
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }
            
            // If we only have one date, estimate the other
            if (startDate && !endDate) {
                // Estimate project duration based on item count (rough heuristic)
                const estimatedDays = Math.max(7, itemCount * 2); // At least 1 week, 2 days per item
                endDate = new Date(startDate.getTime() + estimatedDays * 24 * 60 * 60 * 1000);
            } else if (endDate && !startDate) {
                // Work backwards from end date
                const estimatedDays = Math.max(7, itemCount * 2);
                startDate = new Date(endDate.getTime() - estimatedDays * 24 * 60 * 60 * 1000);
            }
            
            // Determine status
            let status = 'planned';
            const today = new Date();
            
            if (!startDate && !endDate) {
                status = 'no-dates';
            } else if (endDate && endDate < today) {
                status = 'completed';
            } else if (startDate && startDate <= today && (!endDate || endDate >= today)) {
                status = 'active';
            } else if (endDate && endDate < today) {
                status = 'delayed';
            }
            
            return {
                ...originalBoard,
                startDate: startDate,
                endDate: endDate,
                status: status,
                itemCount: itemCount,
                hasEstimatedDates: (startDate && !endDate) || (endDate && !startDate)
            };
        });
        
        renderGanttChart(projectsWithDates);
        
    } catch (error) {
        console.error('Error loading project dates:', error);
        document.getElementById('ganttContainer').innerHTML = 
            '<div class="status disconnected">❌ Error loading project dates: ' + error.message + '</div>';
    }
}

// Enhanced Gantt chart renderer
function renderGanttChart(projects) {
    console.log('Rendering Gantt chart for', projects.length, 'projects');
    
    // Calculate date range - wider range for better visibility
    const today = new Date();
    const startRange = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const endRange = new Date(today.getFullYear(), today.getMonth() + 12, 0);
    
    // Find actual project date range to adjust if needed
    const projectDates = projects
        .filter(p => p.startDate || p.endDate)
        .flatMap(p => [p.startDate, p.endDate].filter(Boolean));
    
    if (projectDates.length > 0) {
        const minProjectDate = new Date(Math.min(...projectDates));
        const maxProjectDate = new Date(Math.max(...projectDates));
        
        // Extend range if projects go beyond our default range
        if (minProjectDate < startRange) {
            startRange.setMonth(minProjectDate.getMonth() - 1);
            startRange.setFullYear(minProjectDate.getFullYear());
        }
        if (maxProjectDate > endRange) {
            endRange.setMonth(maxProjectDate.getMonth() + 1);
            endRange.setFullYear(maxProjectDate.getFullYear());
        }
    }
    
    // Generate month headers
    const months = [];
    let currentMonth = new Date(startRange);
    while (currentMonth <= endRange) {
        months.push({
            name: currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            date: new Date(currentMonth),
            daysInMonth: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
        });
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    let html = '<div class="gantt-container">';
    
    // Header
    html += '<div class="gantt-header">';
    html += '<div class="gantt-header-left">Project Details</div>';
    html += '<div class="gantt-header-right">';
    months.forEach(month => {
        html += '<div class="gantt-month">' + month.name + '</div>';
    });
    html += '</div>';
    html += '</div>';
    
    // Project rows
    projects.forEach(project => {
        html += '<div class="gantt-row">';
        html += '<div class="gantt-project">';
        html += '<div class="gantt-project-name">📋 ' + project.name + '</div>';
        html += '<div class="gantt-project-info">';
        html += 'Items: ' + (project.itemCount || 0) + ' | ';
        html += 'Type: ' + project.board_kind;
        if (project.hasEstimatedDates) {
            html += ' | ⚠️ Estimated dates';
        }
        html += '</div>';
        
        // Show date info or editing controls
        if (project.status === 'no-dates') {
            html += '<div style="margin-top: 8px;">';
            html += '<input type="date" class="date-input" id="start-' + project.id + '" placeholder="Start">';
            html += '<input type="date" class="date-input" id="end-' + project.id + '" placeholder="End" style="margin-left: 4px;">';
            html += '<button class="edit-dates-btn" onclick="updateProjectDates(\'' + project.id + '\')">Set Dates</button>';
            html += '</div>';
        } else {
            html += '<div style="margin-top: 4px; font-size: 11px; color: #666;">';
            if (project.startDate) {
                html += 'Start: ' + project.startDate.toLocaleDateString();
            }
            if (project.endDate) {
                if (project.startDate) html += ' | ';
                html += 'End: ' + project.endDate.toLocaleDateString();
            }
            html += '</div>';
        }
        
        html += '</div>';
        
        html += '<div class="gantt-timeline">';
        
        if (project.status === 'no-dates') {
            html += '<div class="gantt-no-dates">📅 No dates set - add dates to see timeline</div>';
        } else {
            // Calculate bar position and width
            const totalTimelineWidth = months.length * 100; // Each month column is roughly 100px
            const totalDays = (endRange - startRange) / (1000 * 60 * 60 * 24);
            
            if (project.startDate && project.endDate) {
                const startOffset = Math.max(0, (project.startDate - startRange) / (1000 * 60 * 60 * 24));
                const duration = (project.endDate - project.startDate) / (1000 * 60 * 60 * 24);
                
                const leftPercent = (startOffset / totalDays) * 100;
                const widthPercent = Math.min(100 - leftPercent, (duration / totalDays) * 100);
                
                const barTitle = project.startDate.toLocaleDateString() + ' → ' + project.endDate.toLocaleDateString() + 
                    (project.hasEstimatedDates ? ' (estimated)' : '');
                
                html += '<div class="gantt-bar status-' + project.status + '" ';
                html += 'style="left: ' + Math.max(0, leftPercent) + '%; width: ' + Math.max(2, widthPercent) + '%;" ';
                html += 'title="' + barTitle + '">';
                
                // Truncate project name for display
                const displayName = project.name.length > 15 ? 
                    project.name.substring(0, 15) + '...' : project.name;
                html += displayName;
                
                html += '</div>';
            }
        }
        
        html += '</div>';
        html += '</div>';
    });
    
    html += '</div>';
    
    // Enhanced legend with stats
    const stats = {
        noDates: projects.filter(p => p.status === 'no-dates').length,
        planned: projects.filter(p => p.status === 'planned').length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        delayed: projects.filter(p => p.status === 'delayed').length
    };
    
    html += '<div class="gantt-legend">';
    html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #f59e0b;"></div>No Dates (' + stats.noDates + ')</div>';
    html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #3b82f6;"></div>Planned (' + stats.planned + ')</div>';
    html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #10b981;"></div>Active (' + stats.active + ')</div>';
    html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #64748b;"></div>Completed (' + stats.completed + ')</div>';
    html += '<div class="gantt-legend-item"><div class="gantt-legend-color" style="background: #ef4444;"></div>Delayed (' + stats.delayed + ')</div>';
    html += '</div>';
    
    // Add refresh button
    html += '<div style="margin-top: 15px; text-align: center;">';
    html += '<button class="gantt-btn" onclick="showGanttChart()">🔄 Refresh Timeline</button>';
    html += '</div>';
    
    document.getElementById('ganttContainer').innerHTML = html;
    document.getElementById('showGanttBtn').style.display = 'none';
    document.getElementById('hideGanttBtn').style.display = 'inline-block';
    document.getElementById('ganttStatus').textContent = 
        'Timeline: ' + projects.length + ' projects (' + stats.noDates + ' need dates, ' + 
        (stats.active + stats.planned) + ' upcoming, ' + stats.completed + ' done)';
}

// Update project dates function (enhanced)
function updateProjectDates(projectId) {
    const startInput = document.getElementById('start-' + projectId);
    const endInput = document.getElementById('end-' + projectId);
    
    const startDate = startInput.value;
    const endDate = endInput.value;
    
    if (!startDate || !endDate) {
        alert('Please enter both start and end dates');
        return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        alert('End date must be after start date');
        return;
    }
    
    // Calculate project duration for user feedback
    const duration = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    
    const confirmMessage = `Set project dates?\n\n` +
        `Project: ${currentFilteredBoards.find(b => b.id === projectId)?.name || 'Unknown'}\n` +
        `Start: ${new Date(startDate).toLocaleDateString()}\n` +
        `End: ${new Date(endDate).toLocaleDateString()}\n` +
        `Duration: ${duration} days\n\n` +
        `Note: This will create date columns in Monday.com if they don't exist.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Here you would normally update the dates in Monday.com
    // For now, show a status and refresh the Gantt chart
    document.getElementById('ganttStatus').textContent = 'Updating project dates...';
    
    // Simulate the update (in real implementation, you'd call Monday.com API)
    setTimeout(() => {
        alert('✅ Project dates updated successfully!\n\n' +
              'Note: In a full implementation, this would update the Monday.com board with date columns.');
        
        // Refresh the Gantt chart to show the changes
        showGanttChart();
    }, 1000);
}

// END GANTT CHART FUNCTIONS

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
    
console.log('Complete script loaded successfully - all functions including Gantt chart should work');