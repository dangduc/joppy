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
  if (info.menuItemId === 'clipToJoplin') {
    console.log('Joppy: Context menu clicked, processing selection...');
    
    try {
      await processSelection(info, tab);
    } catch (error) {
      console.error('Joppy: Error processing selection:', error);
      // Fallback to plaintext if content script fails
      await clipToJoplinFallback(info.selectionText, tab.url, tab.title);
    }
  }
});

// Process the selection using content script
async function processSelection(info, tab) {
  try {
    // Inject content script and get processed HTML
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_script.js']
    });

    if (!results || results.length === 0) {
      console.warn('Joppy: Content script execution failed');
      await clipToJoplinFallback(info.selectionText, tab.url, tab.title);
      return;
    }

    // Send message to content script to process selection
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getSelectedHtml'
    });

    if (response && response.success && response.data) {
      console.log('Joppy: Got processed selection:', response.data);
      
      // Extract title from markdown/text content
      const title = generateNoteTitle(response.data.markdown || response.data.text, response.data.title);
      
      // Send to Joplin
      await clipToJoplin(
        response.data.markdown || response.data.text, 
        response.data.url || tab.url,
        title || response.data.title || tab.title
      );
    } else {
      console.warn('Joppy: Content script processing failed or returned invalid data:', response);
      await clipToJoplinFallback(info.selectionText, tab.url, tab.title);
    }

  } catch (error) {
    console.error('Joppy: Content script failed, falling back to plaintext:', error);
    await clipToJoplinFallback(info.selectionText, tab.url, tab.title);
  }
}

// Original clipToJoplin function (now used for successful processing)
async function clipToJoplin(selectedContent, pageUrl, pageTitle) {
  if (!joplinSettings.token) {
    throw new Error('Joplin API token not configured. Please set it in the extension options.');
  }

  const note_create_time = new Date().getTime();

  const noteData = {
    title: generateNoteTitle(selectedContent),
    body: selectedContent,
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
  const contentPreview = selectedContent.substring(0, 50).replace(/\n/g, ' ');
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Clipped to Joplin!',
    message: `Successfully clipped "${contentPreview}..." to Joplin`
  });

  return response.json();
}

// Fallback function for plaintext clipping
async function clipToJoplinFallback(selectedText, pageUrl, pageTitle) {
  if (!selectedText || !selectedText.trim()) {
    throw new Error('No text selected');
  }

  console.log('Joppy: Using fallback plaintext clipping');
  
  try {
    await clipToJoplin(selectedText, pageUrl, pageTitle);
  } catch (error) {
    console.error('Joppy: Fallback clipping failed:', error);
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Joppy Clipper Error',
      message: error.message || 'Failed to clip to Joplin'
    });
    throw error;
  }
}

// Generate a meaningful title from content
function generateNoteTitle(content, fallbackTitle = '') {
  if (!content || !content.trim()) {
    return fallbackTitle || 'Untitled Note';
  }
  
  // Get first line or first 50 characters
  const firstLine = content.split('\n')[0].trim();
  const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  
  // Remove markdown formatting for title
  const cleanTitle = title
    .replace(/^#+\s*/, '') // Remove markdown headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
    .trim();
    
  return cleanTitle || fallbackTitle || 'Untitled Note';
}

// Listen for settings updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.port) joplinSettings.port = changes.port.newValue;
    if (changes.token) joplinSettings.token = changes.token.newValue;
    if (changes.notebookId) joplinSettings.notebookId = changes.notebookId.newValue;
  }
});
