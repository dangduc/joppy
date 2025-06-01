// Jest setup file for testing content script functions
// This sets up the DOM environment and mocks browser APIs

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

// Mock browser APIs that aren't available in Node.js
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock window.getSelection for selection tests
global.window.getSelection = jest.fn(() => ({
  rangeCount: 0,
  getRangeAt: jest.fn(),
  toString: jest.fn(() => '')
}));

// Helper function to create DOM elements for testing
global.createTestElement = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

// Helper to simulate selection ranges
global.createMockRange = (content) => ({
  cloneContents: jest.fn(() => {
    const fragment = document.createDocumentFragment();
    const div = document.createElement('div');
    div.innerHTML = content;
    while (div.firstChild) {
      fragment.appendChild(div.firstChild);
    }
    return fragment;
  })
});

// Helper to create test list structures
global.createTestList = (type, items, nested = false) => {
  const list = document.createElement(type);
  items.forEach((item, index) => {
    const li = document.createElement('li');
    if (typeof item === 'string') {
      li.textContent = item;
    } else {
      li.innerHTML = item.html || item.text || '';
      if (item.nested) {
        const nestedList = createTestList(item.nested.type, item.nested.items);
        li.appendChild(nestedList);
      }
    }
    list.appendChild(li);
  });
  return list;
}; 