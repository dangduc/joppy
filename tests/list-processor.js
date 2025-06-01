// Extracted list processing functions for unit testing
// This module contains the core logic from content_script.js without browser dependencies

/**
 * Fix orphaned list items by wrapping them in appropriate containers
 * Extracted from content_script.js for testing
 */
function fixOrphanedListItems(container) {
  console.log('Processing container for orphaned list items...');
  
  try {
    // Don't process if this container is already a proper list container
    const containerTagName = container.tagName ? container.tagName.toLowerCase() : '';
    if (containerTagName === 'ul' || containerTagName === 'ol') {
      console.log('Container is already a proper list, skipping...');
      return;
    }
    
    // Find all direct child li elements (orphaned ones)
    const directChildren = Array.from(container.children || []);
    const orphanedItems = directChildren.filter(child => 
      child.tagName && child.tagName.toLowerCase() === 'li'
    );
    
    if (orphanedItems.length > 0) {
      console.log('Found', orphanedItems.length, 'orphaned list items, wrapping them...');
      
      // Create a wrapper and clone the orphaned items instead of moving them
      const wrapper = document.createElement('ul');
      
      // Clone each orphaned item to avoid parent node issues
      for (const item of orphanedItems) {
        try {
          const clonedItem = item.cloneNode(true);
          wrapper.appendChild(clonedItem);
        } catch (error) {
          console.warn('Error cloning list item:', error);
        }
      }
      
      if (wrapper.children.length > 0) {
        console.log('Created ul wrapper with', wrapper.children.length, 'items');
        
        // Remove original orphaned items first
        for (const item of orphanedItems) {
          try {
            if (item.parentNode === container) {
              container.removeChild(item);
            }
          } catch (error) {
            console.warn('Error removing orphaned item:', error);
          }
        }
        
        // Add the wrapper
        container.appendChild(wrapper);
      }
    }
    
    // Handle remaining children recursively
    const remainingChildren = Array.from(container.children || []);
    for (const child of remainingChildren) {
      if (child.nodeType === 1 && child.tagName) { // Element node with valid tag
        const childTagName = child.tagName.toLowerCase();
        // Don't recurse into proper list containers
        if (childTagName !== 'ul' && childTagName !== 'ol') {
          try {
            fixOrphanedListItems(child);
          } catch (error) {
            console.warn('Error processing child element:', error);
          }
        }
      }
    }
    
    console.log('Finished fixing orphaned list items');
    
  } catch (error) {
    console.error('Error in fixOrphanedListItems:', error);
    // Don't throw - just log and continue
  }
}

/**
 * Basic HTML to markdown conversion focusing on lists
 * Simplified version for testing
 */
function htmlToMarkdownFallback(html) {
  console.log('Starting fallback HTML to markdown conversion...');
  
  try {
    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    
    // Apply basic formatting conversions first, before processing lists
    let htmlContent = container.innerHTML;
    htmlContent = htmlContent
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<i>(.*?)<\/i>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');
    
    // Update container with formatted content
    container.innerHTML = htmlContent;
    
    // Process lists in the container
    processListsInFallback(container);
    
    // Get the processed content
    let markdown = container.innerHTML;
    
    // Apply remaining conversions
    markdown = markdown
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/g, (match, level, text) => {
        return '#'.repeat(parseInt(level)) + ' ' + text + '\n\n';
      });
    
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
    
    console.log('Fallback conversion complete');
    return markdown;
    
  } catch (error) {
    console.error('Error in fallback conversion:', error);
    return html; // Return original if conversion fails
  }
}

/**
 * Process lists in the fallback conversion - FIXED VERSION
 */
function processListsInFallback(element, depth = 0) {
  console.log('Processing lists in fallback, depth:', depth);
  
  // Find all direct list children (not nested ones)
  const directLists = Array.from(element.children).filter(child => 
    child.tagName && ['ul', 'ol'].includes(child.tagName.toLowerCase())
  );
  
  console.log('Found direct lists:', directLists.length);
  
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

/**
 * Process a single list element and its nested children
 */
function processListElement(list, depth = 0) {
  const isOrdered = list.tagName.toLowerCase() === 'ol';
  const items = Array.from(list.children).filter(item => 
    item.tagName && item.tagName.toLowerCase() === 'li'
  );
  
  let listMarkdown = '';
  const indent = '  '.repeat(depth);
  const start = parseInt(list.getAttribute('start')) || 1;
  
  console.log(`Processing ${isOrdered ? 'ordered' : 'unordered'} list with ${items.length} items at depth ${depth}`);
  
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

/**
 * Simulate the selection processing that happens in getSelectedHtml
 */
function processSelection(htmlContent) {
  // Create container for selected content
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  
  // Fix orphaned list items
  fixOrphanedListItems(container);
  
  return {
    html: container.innerHTML,
    text: container.textContent || container.innerText || ''
  };
}

module.exports = {
  fixOrphanedListItems,
  htmlToMarkdownFallback,
  processListsInFallback,
  processSelection
}; 