// Default Joplin settings
let joplinSettings = {
  port: '41184',
  token: '',
  notebookId: 'Clips'
};

// Load settings from storage
chrome.storage.sync.get(['port', 'token', 'notebookId'], (result) => {
  if (result.port) joplinSettings.port = result.port;
  if (result.token) joplinSettings.token = result.token;
  if (result.notebookId) joplinSettings.notebookId = result.notebookId;
});

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clipToJoplin',
    title: 'Clip to Joplin',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'clipToJoplin' && info.selectionText) {
    try {
      await clipToJoplin(info.selectionText, tab.url, tab.title);
    } catch (error) {
      console.error('Error clipping to Joplin:', error);
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Joplin Clipper Error',
        message: error.message || 'Failed to clip to Joplin'
      });
    }
  }
});

// Function to create a note in Joplin
async function clipToJoplin(selectedText, pageUrl, pageTitle) {
  if (!joplinSettings.token) {
    throw new Error('Joplin API token not configured. Please set it in the extension options.');
  }

  const note_create_time = new Date().getTime();
  const noteBody = `${selectedText}`;

  const noteData = {
    title: selectedText,
    body: noteBody,
    parent_id: joplinSettings.notebookId || '',
    user_created_time: note_create_time,
    source: pageTitle,
    source_url: pageUrl,
  };

  const response = await fetch(`http://localhost:${joplinSettings.port}/notes?token=${joplinSettings.token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(noteData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Joplin API error: ${response.status} - ${errorText}`);
  }

  // Show success notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Clipped to Joplin!',
    message: `Successfully clipped "${selectedText.substring(0, 50)}..." to Joplin`
  });

  return response.json();
}

// Listen for settings updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.port) joplinSettings.port = changes.port.newValue;
    if (changes.token) joplinSettings.token = changes.token.newValue;
    if (changes.notebookId) joplinSettings.notebookId = changes.notebookId.newValue;
  }
});
