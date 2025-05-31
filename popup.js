// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['port', 'token', 'notebookId'], (result) => {
    document.getElementById('port').value = result.port || '41184';
    document.getElementById('token').value = result.token || '';
    document.getElementById('notebookId').value = result.notebookId || '';
  });
});

// Save settings
document.getElementById('save').addEventListener('click', () => {
  const settings = {
    port: document.getElementById('port').value || '41184',
    token: document.getElementById('token').value,
    notebookId: document.getElementById('notebookId').value
  };
  
  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved successfully!', 'success');
  });
});

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