// Joppy Content Script for HTML Selection Processing
// Based on Joplin Web Clipper reference implementation

(function() {
  'use strict';

  // Prevent multiple execution
  if (window.joppyContentScript) return;
  window.joppyContentScript = true;

  console.log('Joppy: Content script loaded');

  // Load Turndown.js if not already available
  let turndownService = null;

  function initializeTurndown() {
    if (typeof TurndownService !== 'undefined') {
      console.log('Joppy: TurndownService is available, creating instance...');
      
      // Use standard configuration that's proven to work
      turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      });
      
      console.log('Joppy: Basic Turndown service created successfully');
      
      // Test the service with a simple list
      try {
        const testHtml = '<ul><li>Test item 1</li><li>Test item 2</li></ul>';
        const testResult = turndownService.turndown(testHtml);
        console.log('Joppy: Test conversion successful:', testResult);
        console.log('Joppy: Test conversion (escaped):', JSON.stringify(testResult));
      } catch (error) {
        console.error('Joppy: Test conversion failed:', error);
      }

      // Add only essential custom rules that we know work
      turndownService.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: function (content) {
          return '~~' + content + '~~';
        }
      });

      console.log('Joppy: Turndown service initialized with standard configuration');
      return true;
    } else {
      console.log('Joppy: TurndownService not available');
      return false;
    }
  }

  // Utility functions
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function pageTitle() {
    const titleElements = document.getElementsByTagName('title');
    if (titleElements.length) return titleElements[0].text.trim();
    return document.title.trim();
  }

  // Pre-process document to mark hidden elements and prepare lists
  function preProcessDocument(element) {
    const childNodes = element.childNodes;

    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i];
      if (node.nodeType !== 1) continue; // Only process element nodes

      const nodeName = node.nodeName.toLowerCase();
      const computedStyle = window.getComputedStyle(node);

      let isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
      
      // Hide script, style, and other unwanted elements
      if (['script', 'noscript', 'style', 'select', 'option', 'button'].indexOf(nodeName) >= 0) {
        isVisible = false;
      }

      // Process form inputs
      if (['input', 'textarea'].indexOf(nodeName) >= 0) {
        isVisible = !!node.value;
        if (nodeName === 'input' && node.getAttribute('type') !== 'text') isVisible = false;
        if (isVisible) node.setAttribute('data-joppy-value', node.value);
      }

      if (!isVisible) {
        node.classList.add('joppy-hidden');
      } else {
        preProcessDocument(node);
      }
    }
  }

  // Clean up element by removing hidden children and processing content
  function cleanUpElement(element) {
    const childNodes = element.childNodes;
    const hiddenNodes = [];

    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      const isHidden = node && node.classList && node.classList.contains('joppy-hidden');

      if (isHidden) {
        hiddenNodes.push(node);
      } else {
        // Replace form inputs with their values
        if (node.getAttribute && node.getAttribute('data-joppy-value')) {
          const div = document.createElement('div');
          div.innerText = node.getAttribute('data-joppy-value');
          node.parentNode.insertBefore(div, node.nextSibling);
          element.removeChild(node);
        }

        if (node.nodeType === 1) { // Element node
          cleanUpElement(node);
        }
      }
    }

    // Remove hidden nodes
    for (const hiddenNode of hiddenNodes) {
      if (hiddenNode.parentNode) {
        hiddenNode.parentNode.removeChild(hiddenNode);
      }
    }
  }

  // Preserve code block styling
  function hardcodePreStyles(element) {
    const preElements = element.getElementsByTagName('pre');
    
    for (const preElement of preElements) {
      const fontFamily = getComputedStyle(preElement).getPropertyValue('font-family');
      const fontFamilyArray = fontFamily.split(',').map(f => f.toLowerCase().trim());
      if (fontFamilyArray.indexOf('monospace') >= 0) {
        preElement.style.fontFamily = fontFamily;
      }
    }
  }

  // Main function to get selected HTML
  function getSelectedHtml() {
    console.log('Joppy: Getting selected HTML...');
    
    const selection = window.getSelection();
    
    if (selection.rangeCount === 0) {
      console.log('Joppy: No selection found');
      return null;
    }

    try {
      // Create container for selected content
      const container = document.createElement('div');
      
      // Process all selection ranges (for multi-selection support)
      for (let i = 0; i < selection.rangeCount; i++) {
        try {
          const range = selection.getRangeAt(i);
          const clonedContent = range.cloneContents();
          container.appendChild(clonedContent);
        } catch (error) {
          console.warn(`Joppy: Error processing range ${i + 1}:`, error);
          // Continue with other ranges
        }
      }

      console.log('Joppy: Raw HTML length:', container.innerHTML.length);

      // Fix orphaned list items by wrapping them in appropriate containers
      try {
        fixOrphanedListItems(container);
        console.log('Joppy: Fixed orphaned list items');
      } catch (error) {
        console.warn('Joppy: Orphan fix error:', error.message);
        // Continue without the fix - the content will still work
      }

      console.log('Joppy: Processed HTML length:', container.innerHTML.length);

      const result = {
        html: container.innerHTML,
        text: container.textContent || container.innerText || '',
        title: pageTitle(),
        url: window.location.href
      };
      
      return result;
      
    } catch (error) {
      console.error('Joppy: Selection processing error:', error.message);
      
      // Fallback to simple text selection
      try {
        const selectedText = selection.toString().trim();
        if (selectedText) {
          console.log('Joppy: Using text fallback');
          return {
            html: selectedText,
            text: selectedText,
            title: pageTitle(),
            url: window.location.href
          };
        }
      } catch (fallbackError) {
        console.error('Joppy: Fallback failed:', fallbackError.message);
      }
      
      return null;
    }
  }

  // Fix orphaned list items by wrapping them in appropriate containers
  function fixOrphanedListItems(container) {
    console.log('Joppy: Processing container for orphaned list items...');
    
    try {
      // Don't process if this container is already a proper list container
      const containerTagName = container.tagName ? container.tagName.toLowerCase() : '';
      if (containerTagName === 'ul' || containerTagName === 'ol') {
        console.log('Joppy: Container is already a proper list, skipping...');
        return;
      }
      
      // Find all direct child li elements (orphaned ones) - be more careful
      const directChildren = Array.from(container.children || []);
      const orphanedItems = directChildren.filter(child => 
        child.tagName && child.tagName.toLowerCase() === 'li'
      );
      
      if (orphanedItems.length > 0) {
        console.log('Joppy: Found', orphanedItems.length, 'orphaned list items, wrapping them...');
        
        // Create a wrapper and clone the orphaned items instead of moving them
        const wrapper = document.createElement('ul');
        
        // Clone each orphaned item to avoid parent node issues
        for (const item of orphanedItems) {
          try {
            const clonedItem = item.cloneNode(true);
            wrapper.appendChild(clonedItem);
          } catch (error) {
            console.warn('Joppy: Error cloning list item:', error);
          }
        }
        
        if (wrapper.children.length > 0) {
          console.log('Joppy: Created ul wrapper with', wrapper.children.length, 'items');
          
          // Remove original orphaned items first
          for (const item of orphanedItems) {
            try {
              if (item.parentNode === container) {
                container.removeChild(item);
              }
            } catch (error) {
              console.warn('Joppy: Error removing orphaned item:', error);
            }
          }
          
          // Add the wrapper
          container.appendChild(wrapper);
        }
      }
      
      // Handle remaining children recursively, but be more careful
      const remainingChildren = Array.from(container.children || []);
      for (const child of remainingChildren) {
        if (child.nodeType === 1 && child.tagName) { // Element node with valid tag
          const childTagName = child.tagName.toLowerCase();
          // Don't recurse into proper list containers
          if (childTagName !== 'ul' && childTagName !== 'ol') {
            try {
              fixOrphanedListItems(child);
            } catch (error) {
              console.warn('Joppy: Error processing child element:', error);
            }
          }
        }
      }
      
      console.log('Joppy: Finished fixing orphaned list items');
      
    } catch (error) {
      console.error('Joppy: Error in fixOrphanedListItems:', error);
      // Don't throw - just log and continue
    }
  }

  // Convert HTML to markdown using Turndown.js or fallback
  function htmlToMarkdown(html) {
    console.log('Joppy: Converting HTML to markdown...');
    
    if (turndownService) {
      try {
        const markdown = turndownService.turndown(html);
        console.log('Joppy: Turndown successful, length:', markdown.length);
        return markdown;
      } catch (error) {
        console.error('Joppy: Turndown error:', error.message);
        console.warn('Joppy: Using fallback conversion');
      }
    }

    // Fallback conversion
    const fallbackResult = htmlToMarkdownFallback(html);
    console.log('Joppy: Fallback conversion complete, length:', fallbackResult.length);
    return fallbackResult;
  }

  // Fallback HTML to Markdown conversion with enhanced list support
  function htmlToMarkdownFallback(html) {
    console.log('Joppy: Using fallback conversion for:', html);
    
    // Create a temporary element to work with
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Process lists first to maintain structure
    processListsInFallback(temp);

    // Simple HTML to Markdown conversion
    let markdown = temp.innerHTML;

    // Convert basic elements
    markdown = markdown.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (match, level, content) => {
      const hashes = '#'.repeat(parseInt(level));
      return `${hashes} ${content.replace(/<[^>]*>/g, '')}\n\n`;
    });

    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<br[^>]*\/?>/gi, '\n');
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');
    
    // Clean up extra whitespace and normalize list formatting
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .split('\n') // Process line by line
      .map(line => {
        // For list items, normalize the whitespace while preserving proper nesting
        if (line.match(/^\s*[-*+]\s/) || line.match(/^\s*\d+\.\s/)) {
          // Extract the list marker and content
          const match = line.match(/^(\s*)([-*+]|\d+\.)\s*(.*)$/);
          if (match) {
            const [, indent, marker, content] = match;
            // Calculate proper indentation (2 spaces per level)
            // Count the indentation level based on actual spaces, but ensure proper increments
            const indentLevel = Math.floor(indent.length / 2);
            const normalizedIndent = '  '.repeat(indentLevel);
            return `${normalizedIndent}${marker} ${content.trim()}`;
          }
        }
        return line.trim();
      })
      .filter(line => line.length > 0) // Remove empty lines
      .join('\n')
      .replace(/\n\n+/g, '\n\n'); // Restore paragraph breaks
    
    markdown = markdown.trim();

    console.log('Joppy: Fallback final result:', markdown);
    return markdown;
  }

  // Process lists in the fallback conversion - FIXED VERSION
  function processListsInFallback(element, depth = 0) {
    console.log('Joppy: Processing lists in fallback, depth:', depth);
    
    // Find all direct list children (not nested ones)
    const directLists = Array.from(element.children).filter(child => 
      child.tagName && ['ul', 'ol'].includes(child.tagName.toLowerCase())
    );
    
    console.log('Joppy: Found direct lists:', directLists.length);
    
    // Process each direct list
    for (const list of directLists) {
      const processedMarkdown = processListElement(list, depth);
      
      // Replace the list with processed markdown
      if (processedMarkdown) {
        const textNode = document.createTextNode('\n' + processedMarkdown.trim() + '\n');
        list.parentNode.replaceChild(textNode, list);
      }
    }
    
    // Recursively process other elements that might contain lists
    const otherElements = Array.from(element.children).filter(child => 
      child.tagName && !['ul', 'ol'].includes(child.tagName.toLowerCase()) && child.nodeType === 1
    );
    
    for (const child of otherElements) {
      processListsInFallback(child, depth);
    }
  }

  // Process a single list element and its nested children
  function processListElement(list, depth = 0) {
    const isOrdered = list.tagName.toLowerCase() === 'ol';
    const items = Array.from(list.children).filter(item => 
      item.tagName && item.tagName.toLowerCase() === 'li'
    );
    
    let listMarkdown = '';
    const indent = '  '.repeat(depth);
    const start = parseInt(list.getAttribute('start')) || 1;
    
    console.log(`Joppy: Processing ${isOrdered ? 'ordered' : 'unordered'} list with ${items.length} items at depth ${depth}`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Find nested lists within this item
      const nestedLists = Array.from(item.children).filter(child =>
        child.tagName && ['ul', 'ol'].includes(child.tagName.toLowerCase())
      );
      
      // Get the text content of this item (excluding nested lists)
      const itemClone = item.cloneNode(true);
      
      // Remove nested lists from the clone to get just the item's own text
      const nestedListsInClone = itemClone.querySelectorAll('ul, ol');
      for (const nestedList of nestedListsInClone) {
        nestedList.remove();
      }
      
      const content = itemClone.textContent.trim();
      
      // Determine if this item has actual content
      const hasContent = content.length > 0;
      
      if (hasContent) {
        // Add the main item content
        if (isOrdered) {
          const number = start + i;
          listMarkdown += `${indent}${number}. ${content}\n`;
        } else {
          listMarkdown += `${indent}- ${content}\n`;
        }
        
        // Process nested lists with increased depth
        for (const nestedList of nestedLists) {
          const nestedMarkdown = processListElement(nestedList, depth + 1);
          if (nestedMarkdown) {
            listMarkdown += nestedMarkdown;
          }
        }
      } else if (nestedLists.length > 0) {
        // Empty parent item with nested lists - process nested lists at the same depth as the parent
        // This handles the case where <li><ul><li>child</li></ul></li> becomes "- child" instead of "  - child"
        for (const nestedList of nestedLists) {
          const nestedMarkdown = processListElement(nestedList, depth);
          if (nestedMarkdown) {
            listMarkdown += nestedMarkdown;
          }
        }
      }
    }
    
    return listMarkdown;
  }

  // Load Turndown.js dynamically
  function loadTurndown() {
    return new Promise((resolve) => {
      console.log('Joppy: Loading Turndown.js...');
      
      if (initializeTurndown()) {
        console.log('Joppy: Turndown already available');
        resolve(true);
        return;
      }

      // Inject Turndown.js script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('turndown.min.js');
      script.onload = () => {
        console.log('Joppy: Turndown.js script loaded successfully');
        const success = initializeTurndown();
        console.log('Joppy: Turndown initialization result:', success);
        resolve(success);
      };
      script.onerror = () => {
        console.error('Joppy: Failed to load Turndown.js script');
        resolve(false);
      };
      
      document.head.appendChild(script);
    });
  }

  // Message listener for background script communication
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Joppy: Received message:', request.action);

    if (request.action === 'getSelectedHtml') {
      console.log('Joppy: Processing selection...');
      
      // Load Turndown.js first, then process selection
      loadTurndown().then((turndownLoaded) => {
        console.log('Joppy: Turndown loaded:', turndownLoaded);
        
        try {
          const selectionData = getSelectedHtml();
          
          if (!selectionData || !selectionData.html.trim()) {
            console.log('Joppy: No HTML selection, using text fallback');
            
            // Fallback to simple text selection
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText) {
              sendResponse({
                success: true,
                data: {
                  markdown: selectedText,
                  html: selectedText,
                  text: selectedText,
                  title: pageTitle(),
                  url: window.location.href
                }
              });
            } else {
              sendResponse({
                success: false,
                error: 'No selection found'
              });
            }
            return;
          }

          console.log('Joppy: Got HTML selection, length:', selectionData.html.length);
          
          // Convert HTML to markdown
          const markdown = htmlToMarkdown(selectionData.html);
          console.log('Joppy: Markdown conversion done, length:', markdown.length);

          const responseData = {
            success: true,
            data: {
              markdown: markdown,
              html: selectionData.html,
              text: selectionData.text,
              title: selectionData.title,
              url: selectionData.url
            }
          };
          
          console.log('Joppy: Sending response to background script');
          sendResponse(responseData);

        } catch (error) {
          console.error('Joppy: Processing error:', error.message);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      });

      // Return true to indicate async response
      return true;
    }
  });

  console.log('Joppy: Content script ready');

})(); 