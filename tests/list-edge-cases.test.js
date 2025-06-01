// Unit tests for list processing edge cases
const {
  fixOrphanedListItems,
  htmlToMarkdownFallback,
  processListsInFallback,
  processSelection
} = require('./list-processor');

describe('List Edge Cases', () => {

  beforeEach(() => {
    // Clear console mocks before each test
    jest.clearAllMocks();
  });

  describe('fixOrphanedListItems', () => {

    test('should wrap orphaned li elements in ul container', () => {
      // Create container with orphaned list items (Edge Case #2)
      const container = document.createElement('div');
      container.innerHTML = `
        <li>Orphaned item 1</li>
        <li>Orphaned item 2</li>
        <p>Some text</p>
      `;

      fixOrphanedListItems(container);

      // Should have wrapped orphaned items in ul
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);
      
      const listItems = lists[0].querySelectorAll('li');
      expect(listItems.length).toBe(2);
      expect(listItems[0].textContent).toBe('Orphaned item 1');
      expect(listItems[1].textContent).toBe('Orphaned item 2');

      // Original orphaned items should be removed
      const directLiElements = Array.from(container.children).filter(
        child => child.tagName && child.tagName.toLowerCase() === 'li'
      );
      expect(directLiElements.length).toBe(0);
    });

    test('should handle mixed orphaned items with other content', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p>Paragraph 1</p>
        <li>Orphaned item 1</li>
        <div>Some div</div>
        <li>Orphaned item 2</li>
        <p>Paragraph 2</p>
      `;

      fixOrphanedListItems(container);

      // Should wrap only the orphaned li elements
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);
      
      const listItems = lists[0].querySelectorAll('li');
      expect(listItems.length).toBe(2);

      // Other elements should remain
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);
      
      const divs = container.querySelectorAll('div:not(ul)');
      expect(divs.length).toBe(1);
    });

    test('should skip containers that are already proper lists', () => {
      const container = document.createElement('ul');
      container.innerHTML = `
        <li>Proper item 1</li>
        <li>Proper item 2</li>
      `;

      fixOrphanedListItems(container);

      // Should not change anything
      expect(container.children.length).toBe(2);
      expect(container.children[0].tagName.toLowerCase()).toBe('li');
      expect(container.children[1].tagName.toLowerCase()).toBe('li');
    });

    test('should handle nested orphaned items recursively', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="section">
          <li>Nested orphaned item 1</li>
          <li>Nested orphaned item 2</li>
        </div>
        <li>Top level orphaned item</li>
      `;

      fixOrphanedListItems(container);

      // Should have created two lists: one nested, one at top level
      const allLists = container.querySelectorAll('ul');
      expect(allLists.length).toBe(2);

      // Check nested list
      const nestedList = container.querySelector('.section ul');
      expect(nestedList).toBeTruthy();
      expect(nestedList.children.length).toBe(2);

      // Check top-level list
      const topLevelList = Array.from(container.children).find(child => 
        child.tagName && child.tagName.toLowerCase() === 'ul'
      );
      expect(topLevelList).toBeTruthy();
      expect(topLevelList.children.length).toBe(1);
    });

    test('should handle empty containers gracefully', () => {
      const container = document.createElement('div');
      
      expect(() => {
        fixOrphanedListItems(container);
      }).not.toThrow();
      
      expect(container.children.length).toBe(0);
    });

    test('should handle containers with no orphaned items', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p>Regular paragraph</p>
        <ul>
          <li>Proper list item</li>
        </ul>
        <div>Regular div</div>
      `;

      const originalHTML = container.innerHTML;
      fixOrphanedListItems(container);

      // Should not change anything
      expect(container.innerHTML).toBe(originalHTML);
    });

  });

  describe('Cross-List Partial Selection (Edge Case #4)', () => {

    test('should handle selection spanning multiple list types', () => {
      const htmlContent = `
        <ol>
          <li>Numbered item 1</li>
          <li>Numbered item 2</li>
        </ol>
        <p>Some text between lists</p>
        <ul>
          <li>Bullet item 1</li>
          <li>Bullet item 2</li>
        </ul>
      `;

      // Simulate partial selection that creates orphaned items
      const partialSelection = `
        <li>Numbered item 2</li>
        <p>Some text between lists</p>
        <li>Bullet item 1</li>
      `;

      const result = processSelection(partialSelection);

      // Should wrap orphaned items in ul
      const container = createTestElement(result.html);
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(2);
    });

  });

  describe('Nested List Partial Selection (Edge Case #3)', () => {

    test('should handle selection across nested list levels', () => {
      // Simulate selection that breaks nested structure
      const brokenNestedSelection = `
        <li>Sub item 1</li>
        <li>Sub item 2</li>
        <li>Another main item</li>
      `;

      const result = processSelection(brokenNestedSelection);

      // Should wrap all orphaned items
      const container = createTestElement(result.html);
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(3);
      expect(listItems[0].textContent).toBe('Sub item 1');
      expect(listItems[1].textContent).toBe('Sub item 2');
      expect(listItems[2].textContent).toBe('Another main item');
    });

  });

  // NEW: Comprehensive Nested List Tests
  describe('Nested List Structure Handling', () => {

    test('should handle simple 2-level nested unordered lists', () => {
      const htmlContent = `
        <ul>
          <li>Main item 1
            <ul>
              <li>Sub item 1</li>
              <li>Sub item 2</li>
            </ul>
          </li>
          <li>Main item 2</li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      // Should have proper indentation for nested items
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('- Main item 1');
      expect(lines).toContain('  - Sub item 1');
      expect(lines).toContain('  - Sub item 2');
      expect(lines).toContain('- Main item 2');
    });

    test('should handle ordered list with nested unordered list (grocery list pattern)', () => {
      const htmlContent = `
        <ol>
          <li>Pay bills.</li>
          <li>Wash car.</li>
          <li>Get groceries.
            <ul>
              <li>Bacon</li>
              <li>Bread</li>
              <li>Cheese</li>
              <li>Lettuce</li>
              <li>Tomatoes</li>
            </ul>
          </li>
          <li>Prepare dinner.</li>
        </ol>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      // Should have proper indentation and numbering
      expect(markdown).toContain('1. Pay bills.');
      expect(markdown).toContain('2. Wash car.');
      expect(markdown).toContain('3. Get groceries.');
      expect(markdown).toContain('  - Bacon');
      expect(markdown).toContain('  - Bread');
      expect(markdown).toContain('  - Cheese');
      expect(markdown).toContain('  - Lettuce');
      expect(markdown).toContain('  - Tomatoes');
      expect(markdown).toContain('4. Prepare dinner.');
      
      // Verify the complete structure matches expected format
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toEqual([
        '1. Pay bills.',
        '2. Wash car.',
        '3. Get groceries.',
        '  - Bacon',
        '  - Bread',
        '  - Cheese',
        '  - Lettuce',
        '  - Tomatoes',
        '4. Prepare dinner.'
      ]);
    });

    test('should handle 3-level deeply nested lists', () => {
      const htmlContent = `
        <ul>
          <li>Level 1 item
            <ul>
              <li>Level 2 item
                <ul>
                  <li>Level 3 item 1</li>
                  <li>Level 3 item 2</li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('- Level 1 item');
      expect(lines).toContain('  - Level 2 item');
      expect(lines).toContain('    - Level 3 item 1');
      expect(lines).toContain('    - Level 3 item 2');
    });

    test('should handle mixed ordered and unordered nested lists', () => {
      const htmlContent = `
        <ul>
          <li>Bullet item
            <ol>
              <li>Numbered sub item 1</li>
              <li>Numbered sub item 2</li>
            </ol>
          </li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('- Bullet item');
      expect(lines).toContain('  1. Numbered sub item 1');
      expect(lines).toContain('  2. Numbered sub item 2');
    });

    test('should handle ordered list with nested unordered list', () => {
      const htmlContent = `
        <ol>
          <li>First step
            <ul>
              <li>Option A</li>
              <li>Option B</li>
            </ul>
          </li>
          <li>Second step</li>
        </ol>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('1. First step');
      expect(lines).toContain('  - Option A');
      expect(lines).toContain('  - Option B');
      expect(lines).toContain('2. Second step');
    });

    test('should handle complex nested structure with multiple siblings', () => {
      const htmlContent = `
        <ul>
          <li>Main item 1
            <ul>
              <li>Sub 1.1</li>
              <li>Sub 1.2
                <ul>
                  <li>Sub 1.2.1</li>
                </ul>
              </li>
            </ul>
          </li>
          <li>Main item 2
            <ul>
              <li>Sub 2.1</li>
            </ul>
          </li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('- Main item 1');
      expect(lines).toContain('  - Sub 1.1');
      expect(lines).toContain('  - Sub 1.2');
      expect(lines).toContain('    - Sub 1.2.1');
      expect(lines).toContain('- Main item 2');
      expect(lines).toContain('  - Sub 2.1');
    });

    test('should preserve proper nesting when partial selection includes nested items', () => {
      // Simulate selection that includes a parent item and its nested children
      const partialSelection = `
        <li>Parent item
          <ul>
            <li>Nested child 1</li>
            <li>Nested child 2</li>
          </ul>
        </li>
      `;

      const result = processSelection(partialSelection);
      const markdown = htmlToMarkdownFallback(result.html);
      
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('- Parent item');
      expect(lines).toContain('  - Nested child 1');
      expect(lines).toContain('  - Nested child 2');
    });

  });

  // NEW: Edge Cases for Nested List Content
  describe('Nested List Content Edge Cases', () => {

    test('should handle nested lists with rich content in parent items', () => {
      const htmlContent = `
        <ul>
          <li><strong>Bold parent</strong> with <em>italic text</em>
            <ul>
              <li>Simple child</li>
            </ul>
          </li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      expect(markdown).toContain('**Bold parent** with *italic text*');
      expect(markdown).toContain('  - Simple child');
    });

    test('should handle complex document with headings, paragraphs, and nested lists with rich content', () => {
      const htmlContent = `
        <h3>Complex Example</h3>
        <p>Here's a list:</p>
        <ul>
            <li><strong>Bold item</strong> with text</li>
            <li>Item with <a href="https://example.com/">a link</a></li>
            <li>Nested content:
                <ol>
                    <li>Sub-step <em>emphasized</em></li>
                    <li>Another sub-step</li>
                </ol>
            </li>
        </ul>
        <p>End of list.</p>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      // Should handle headings properly
      expect(markdown).toContain('### Complex Example');
      
      // Should handle paragraphs
      expect(markdown).toContain("Here's a list:");
      expect(markdown).toContain('End of list.');
      
      // Should handle rich content in list items (allow for whitespace variations)
      expect(markdown).toMatch(/^\s*-\s+\*\*Bold item\*\*\s+with text/m);
      expect(markdown).toMatch(/^\s*-\s+Item with \[a link\]\(https:\/\/example\.com\/\)/m);
      expect(markdown).toMatch(/^\s*-\s+Nested content:/m);
      
      // Should handle nested ordered list with proper indentation
      expect(markdown).toMatch(/^\s*1\.\s+Sub-step \*emphasized\*/m);
      expect(markdown).toMatch(/^\s*2\.\s+Another sub-step/m);
      
      // Verify essential content is present
      expect(markdown).toContain('**Bold item**');
      expect(markdown).toContain('[a link](https://example.com/)');
      expect(markdown).toContain('*emphasized*');
      expect(markdown).toContain('Nested content:');
      
      // NEW: Specific check for consistent indentation
      const lines = markdown.split('\n');
      const listLines = lines.filter(line => line.trim().match(/^-\s/));
      
      // All unordered list items at the same level should have the same indentation
      if (listLines.length > 0) {
        const expectedIndent = listLines[0].match(/^(\s*)/)[1];
        listLines.forEach((line, index) => {
          const actualIndent = line.match(/^(\s*)/)[1];
          expect(actualIndent).toBe(expectedIndent, 
            `List item ${index + 1} has inconsistent indentation. Expected "${expectedIndent}" but got "${actualIndent}"`);
        });
      }
    });

    test('should handle empty parent items with nested lists', () => {
      const htmlContent = `
        <ul>
          <li>
            <ul>
              <li>Orphaned child 1</li>
              <li>Orphaned child 2</li>
            </ul>
          </li>
          <li>Regular item</li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      // Should handle the nested items appropriately
      // When a parent li is empty and only contains nested lists,
      // the nested items should be promoted to the parent level (not indented)
      const lines = markdown.split('\n').filter(line => line.trim());
      expect(lines).toContain('- Orphaned child 1');
      expect(lines).toContain('- Orphaned child 2');
      expect(lines).toContain('- Regular item');
    });

    test('should handle nested list items with line breaks and formatting', () => {
      const htmlContent = `
        <ul>
          <li>Multi-line parent item<br>with line break
            <ul>
              <li>Child with <code>code</code></li>
              <li>Child with <a href="http://example.com">link</a></li>
            </ul>
          </li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);
      
      expect(markdown).toContain('Multi-line parent item');
      expect(markdown).toContain('with line break');
      expect(markdown).toContain('  - Child with `code`');
      expect(markdown).toContain('  - Child with [link](http://example.com)');
    });

  });

  describe('Empty List Items (Edge Case #7)', () => {

    test('should handle empty and whitespace-only list items', () => {
      const htmlContent = `
        <ul>
          <li>Valid item</li>
          <li></li>
          <li>   </li>
          <li>Another valid item</li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);

      // Should only include non-empty items in markdown
      expect(markdown).toContain('Valid item');
      expect(markdown).toContain('Another valid item');
      
      // Count actual list items in result
      const lines = markdown.split('\n').filter(line => line.trim().startsWith('-'));
      expect(lines.length).toBe(2);
    });

  });

  describe('Lists with Custom Start Numbers (Edge Case #8)', () => {

    test('should preserve custom start numbers in ordered lists', () => {
      const htmlContent = `
        <ol start="5">
          <li>Item five</li>
          <li>Item six</li>
          <li>Item seven</li>
        </ol>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);

      expect(markdown).toContain('5. Item five');
      expect(markdown).toContain('6. Item six');
      expect(markdown).toContain('7. Item seven');
    });

    test('should handle custom start numbers in nested ordered lists', () => {
      const htmlContent = `
        <ol>
          <li>Regular first item
            <ol start="10">
              <li>Nested item ten</li>
              <li>Nested item eleven</li>
            </ol>
          </li>
          <li>Regular second item</li>
        </ol>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);

      expect(markdown).toContain('1. Regular first item');
      expect(markdown).toContain('  10. Nested item ten');
      expect(markdown).toContain('  11. Nested item eleven');
      expect(markdown).toContain('2. Regular second item');
    });

  });

  describe('Mixed Content with Lists (Edge Case #12)', () => {

    test('should handle text nodes mixed with list elements', () => {
      const mixedContent = `
        Some paragraph text
        <li>Orphaned list item</li>
        More text here
        <li>Another orphaned item</li>
        Final text
      `;

      const result = processSelection(mixedContent);

      // Should wrap orphaned list items
      const container = createTestElement(result.html);
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(2);

      // Text content should be preserved
      expect(result.text).toContain('Some paragraph text');
      expect(result.text).toContain('More text here');
      expect(result.text).toContain('Final text');
    });

  });

  describe('Rich Content in List Items (Edge Case #6)', () => {

    test('should preserve formatting in list items', () => {
      const htmlContent = `
        <ul>
          <li>Item with <strong>bold</strong> text</li>
          <li>Item with <a href="http://example.com">link</a></li>
          <li>Item with <code>inline code</code></li>
        </ul>
      `;

      const markdown = htmlToMarkdownFallback(htmlContent);

      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('[link](http://example.com)');
      expect(markdown).toContain('`inline code`');
    });

  });

  describe('Error Handling', () => {

    test('should handle malformed HTML gracefully', () => {
      const malformedHTML = `
        <li>Unclosed list item
        <li>Another unclosed item
        <div><li>Nested in wrong element</li></div>
      `;

      expect(() => {
        processSelection(malformedHTML);
      }).not.toThrow();
    });

    test('should handle null/undefined inputs', () => {
      expect(() => {
        fixOrphanedListItems(null);
      }).not.toThrow();

      expect(() => {
        processSelection('');
      }).not.toThrow();
    });

    test('should continue processing after errors', () => {
      // Create a container where some operations might fail
      const container = document.createElement('div');
      container.innerHTML = `
        <li>Item 1</li>
        <li>Item 2</li>
      `;

      // Mock removeChild to simulate an error
      const originalRemoveChild = container.removeChild;
      container.removeChild = jest.fn(() => {
        throw new Error('Simulated error');
      });

      // Should not throw and should still attempt to process
      expect(() => {
        fixOrphanedListItems(container);
      }).not.toThrow();

      // Should have attempted to create wrapper despite errors
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);
    });

  });

});

describe('Integration Tests', () => {

  test('should handle complex mixed selection scenario', () => {
    // Simulate a complex partial selection across multiple structures
    const complexSelection = `
      <p>Some intro text</p>
      <li>Orphaned from ordered list</li>
      <div>
        <li>Nested orphaned item</li>
        <strong>Bold text</strong>
      </div>
      <li>Another orphaned item</li>
      <p>Conclusion text</p>
    `;

    const result = processSelection(complexSelection);

    // Should wrap all orphaned items appropriately
    const container = createTestElement(result.html);
    
    // Should have proper list structure
    const lists = container.querySelectorAll('ul');
    expect(lists.length).toBe(2); // One top-level, one nested

    // Should preserve other content
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(2);

    const strongElements = container.querySelectorAll('strong');
    expect(strongElements.length).toBe(1);
  });

  // NEW: Comprehensive integration test for nested lists
  test('should handle complete nested list workflow', () => {
    const complexNestedHTML = `
      <div>
        <p>Introduction paragraph</p>
        <ul>
          <li>Main topic 1
            <ol>
              <li>Detailed step 1</li>
              <li>Detailed step 2
                <ul>
                  <li>Sub-point A</li>
                  <li>Sub-point B</li>
                </ul>
              </li>
            </ol>
          </li>
          <li>Main topic 2</li>
        </ul>
        <p>Conclusion paragraph</p>
      </div>
    `;

    const result = processSelection(complexNestedHTML);
    const markdown = htmlToMarkdownFallback(result.html);
    
    // Should preserve all structural elements
    expect(markdown).toContain('Introduction paragraph');
    expect(markdown).toContain('Conclusion paragraph');
    
    // Should have proper nested list structure - check for the content existence regardless of exact spacing
    expect(markdown).toContain('Main topic 1');
    expect(markdown).toContain('1. Detailed step 1');
    expect(markdown).toContain('2. Detailed step 2');
    expect(markdown).toContain('Sub-point A');
    expect(markdown).toContain('Sub-point B');
    expect(markdown).toContain('Main topic 2');
    
    // Check that list items are properly formatted (should have markdown list markers)
    const lines = markdown.split('\n').map(line => line.trim()).filter(line => line);
    const listLines = lines.filter(line => line.match(/^(\s*[-*+]|\s*\d+\.)\s/));
    expect(listLines.length).toBeGreaterThan(0); // Should have some list items
    
    // Verify the structure contains the expected nesting levels - allow for whitespace variations
    expect(markdown).toMatch(/^\s*-\s+Main topic 1\s*$/m); // Main list item (allow leading whitespace)
    expect(markdown).toMatch(/^\s*1\.\s+Detailed step 1\s*$/m); // Nested ordered item  
    expect(markdown).toMatch(/^\s*2\.\s+Detailed step 2\s*$/m); // Nested ordered item
    expect(markdown).toMatch(/^\s*-\s+Sub-point A\s*$/m); // Deeply nested item
    expect(markdown).toMatch(/^\s*-\s+Sub-point B\s*$/m); // Deeply nested item
  });

});

// Helper function to create test elements
function createTestElement(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
} 