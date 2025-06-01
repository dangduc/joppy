// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['port', 'token', 'notebookId', 'notebookName'], (result) => {
    document.getElementById('port').value = result.port || '41184';
    document.getElementById('token').value = result.token || '';
    document.getElementById('notebookId').value = result.notebookId || '';
    
    // Display saved notebook name if available
    if (result.notebookName) {
      document.getElementById('selectedNotebookDisplay').value = result.notebookName;
    } else if (result.notebookId && result.token) {
      // If we have a notebook ID but no name, try to fetch the name
      fetchNotebookName(result.notebookId, result.port || '41184', result.token);
    }
  });
  
  // Add input event listener to notebookName field
  setupNotebookSearch();
});

// Fetch notebook name by ID
async function fetchNotebookName(notebookId, port, token) {
  try {
    const response = await fetch(`http://localhost:${port}/folders/${notebookId}?token=${token}`);
    
    if (response.ok) {
      const notebook = await response.json();
      if (notebook && notebook.title) {
        document.getElementById('selectedNotebookDisplay').value = notebook.title;
        
        // Update stored notebook name
        chrome.storage.sync.get(['notebookName'], (result) => {
          if (!result.notebookName) {
            chrome.storage.sync.set({ notebookName: notebook.title });
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch notebook name:', error);
  }
}

// Save settings
document.getElementById('save').addEventListener('click', () => {
  const notebookId = document.getElementById('notebookId').value;
  const selectedNotebookName = document.getElementById('selectedNotebookDisplay').value;
  
  const settings = {
    port: document.getElementById('port').value || '41184',
    token: document.getElementById('token').value,
    notebookId: notebookId
  };
  
  // Save notebook name if available
  if (selectedNotebookName) {
    settings.notebookName = selectedNotebookName;
  }
  
  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved successfully!', 'success');
  });
});

// Setup automatic notebook search
function setupNotebookSearch() {
  const notebookNameInput = document.getElementById('notebookName');
  let debounceTimer;
  
  notebookNameInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    
    const notebookName = notebookNameInput.value.trim();
    if (notebookName.length < 2) {
      const resultsContainer = document.getElementById('notebookResults');
      resultsContainer.innerHTML = '';
      resultsContainer.style.display = 'none';
      return;
    }
    
    // Show loading indicator
    notebookNameInput.classList.add('searching');
    
    // Debounce the search to avoid too many API calls during typing
    debounceTimer = setTimeout(() => {
      searchNotebook(notebookName);
    }, 500); // Wait 500ms after typing stops
  });
  
  // Add Enter key event listener for immediate search
  notebookNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const notebookName = notebookNameInput.value.trim();
      if (notebookName) {
        clearTimeout(debounceTimer); // Clear any pending debounced search
        searchNotebook(notebookName);
      }
    }
  });
}

// Search for notebooks
async function searchNotebook(notebookName) {
  const port = document.getElementById('port').value || '41184';
  const token = document.getElementById('token').value;
  const notebookNameInput = document.getElementById('notebookName');
  
  if (!token) {
    notebookNameInput.classList.remove('searching');
    showStatus('Please enter an API token first', 'error');
    return;
  }
  
  if (!notebookName) {
    notebookNameInput.classList.remove('searching');
    showStatus('Please enter a notebook name', 'error');
    return;
  }
  
  try {
    // Use the search endpoint to find notebooks by name
    const searchQuery = encodeURIComponent(notebookName);
    const searchUrl = `http://localhost:${port}/search?query=${searchQuery}&type=folder&token=${token}`;
    
    const response = await fetch(searchUrl);
    
    // Remove loading indicator
    notebookNameInput.classList.remove('searching');
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.items && result.items.length > 0) {
        displayNotebookResults(result.items);
        showStatus(`Found ${result.items.length} matching notebook(s)`, 'success');
      } else {
        showStatus('No notebooks found with that name', 'error');
      }
    } else {
      showStatus(`Search failed: ${response.status} ${response.statusText}`, 'error');
    }
  } catch (error) {
    // Remove loading indicator
    notebookNameInput.classList.remove('searching');
    showStatus(`Search failed: ${error.message}. Make sure Joplin is running and Web Clipper is enabled.`, 'error');
  }
}

// Display notebook search results
function displayNotebookResults(notebooks) {
  const resultsContainer = document.getElementById('notebookResults');
  resultsContainer.innerHTML = '';
  resultsContainer.style.display = 'block';
  
  notebooks.forEach(notebook => {
    const notebookItem = document.createElement('div');
    notebookItem.className = 'notebook-item';
    notebookItem.textContent = notebook.title;
    notebookItem.setAttribute('data-id', notebook.id);
    
    notebookItem.addEventListener('click', () => {
      document.getElementById('notebookId').value = notebook.id;
      document.getElementById('selectedNotebookDisplay').value = notebook.title;
      document.getElementById('notebookName').value = '';
      resultsContainer.style.display = 'none';
      showStatus(`Selected notebook: ${notebook.title}`, 'success');
    });
    
    resultsContainer.appendChild(notebookItem);
  });
}

// Test connection
document.getElementById('test').addEventListener('click', async () => {
  const port = document.getElementById('port').value || '41184';
  const token = document.getElementById('token').value;
  
  if (!token) {
    showStatus('Please enter an API token first', 'error');
    return;
  }
  
  try {
    const response = await fetch(`http://localhost:${port}/ping?token=${token}`);
    
    if (response.ok) {
      const result = await response.text();
      if (result === 'JoplinClipperServer') {
        showStatus('Connection successful! Joplin is running.', 'success');
        
        // Try to fetch notebooks
        const notebooksResponse = await fetch(`http://localhost:${port}/folders?token=${token}`);
        if (notebooksResponse.ok) {
          const notebooks = await notebooksResponse.json();
          if (notebooks.items && notebooks.items.length > 0) {
            showStatus(`Connection successful! Found ${notebooks.items.length} notebook(s).`, 'success');
          }
        }
      } else {
        showStatus('Unexpected response from Joplin', 'error');
      }
    } else {
      showStatus(`Connection failed: ${response.status} ${response.statusText}`, 'error');
    }
  } catch (error) {
    showStatus(`Connection failed: ${error.message}. Make sure Joplin is running and Web Clipper is enabled.`, 'error');
  }
});

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = type;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 5000);
}