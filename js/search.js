const BASE_URL = "https://restxdb.onrender.com/api";

// Parse query parameter dari URL
const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get('q');

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const searchSuggestions = document.getElementById('searchSuggestions');
const loadingElement = document.getElementById('loading');
const searchResults = document.getElementById('searchResults');
const resultsTitle = document.getElementById('resultsTitle');
const noResults = document.getElementById('noResults');
const similarResults = document.getElementById('similarResults');

// State
let searchTimeout = null;
let currentSearch = '';
let similarDramas = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  initSearch();
});

// Setup all event listeners
function setupEventListeners() {
  // Search input events
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', showSuggestions);
    searchInput.addEventListener('keydown', handleKeyDown);
  }
  
  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', clearSearch);
  }
  
  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (searchSuggestions && !searchSuggestions.contains(e.target) && e.target !== searchInput) {
      hideSuggestions();
    }
  });
}

// Initialize search functionality
function initSearch() {
  console.log("Initializing search...");
  
  // Set focus to search input
  if (searchInput) {
    searchInput.focus();
    
    // Jika ada query awal dari URL, isi input dan lakukan search
    if (initialQuery) {
      const decodedQuery = decodeURIComponent(initialQuery);
      searchInput.value = decodedQuery;
      currentSearch = decodedQuery;
      
      if (clearSearchBtn) {
        clearSearchBtn.style.display = 'flex';
      }
      
      performSearch(decodedQuery);
    } else {
      // Load similar/recommended dramas initially
      loadSimilarDramas();
    }
  }
  
  // Setup event listeners
  setupEventListeners();
}

// Handle search input
function handleSearchInput(e) {
  const query = e.target.value.trim();
  currentSearch = query;
  
  // Show/hide clear button
  if (clearSearchBtn) {
    clearSearchBtn.style.display = query ? 'flex' : 'none';
  }
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // If query is empty, clear results and show similar
  if (!query) {
    clearSearchResults();
    loadSimilarDramas();
    return;
  }
  
  // If query is too short, just show suggestions
  if (query.length < 2) {
    if (searchSuggestions) {
      searchSuggestions.innerHTML = '';
    }
    return;
  }
  
  // Debounce search
  searchTimeout = setTimeout(() => {
    // Show suggestions
    fetchSuggestions(query);
    
    // Perform search
    performSearch(query);
  }, 300);
}

// Handle keyboard events
function handleKeyDown(e) {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (query) {
      hideSuggestions();
      performSearch(query);
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

// Fetch search suggestions
async function fetchSuggestions(query) {
  try {
    const response = await fetch(`${BASE_URL}/suggest/${encodeURIComponent(query)}?lang=in`);
    if (!response.ok) throw new Error('Failed to fetch suggestions');
    
    const data = await response.json();
    const suggestions = data.data || [];
    
    displaySuggestions(suggestions, query);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    if (searchSuggestions) {
      searchSuggestions.innerHTML = '';
    }
  }
}

// Display suggestions
function displaySuggestions(suggestions, query) {
  if (!searchSuggestions) return;
  
  if (suggestions.length === 0) {
    searchSuggestions.innerHTML = '';
    return;
  }
  
  searchSuggestions.innerHTML = '';
  
  // Show top 5 suggestions
  suggestions.slice(0, 5).forEach(suggestion => {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    
    const suggestionText = typeof suggestion === 'string' ? suggestion : suggestion.title || suggestion.text || suggestion;
    
    // Highlight matching text
    const highlightedText = highlightMatch(suggestionText, query);
    
    suggestionItem.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:18px; margin-right:10px; color:#666;">search</span>
      ${highlightedText}
    `;
    
    suggestionItem.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = suggestionText;
      }
      hideSuggestions();
      performSearch(suggestionText);
    });
    
    suggestionItem.addEventListener('mouseenter', () => {
      suggestionItem.classList.add('highlight');
    });
    
    suggestionItem.addEventListener('mouseleave', () => {
      suggestionItem.classList.remove('highlight');
    });
    
    searchSuggestions.appendChild(suggestionItem);
  });
  
  showSuggestions();
}

// Highlight matching text in suggestions
function highlightMatch(text, query) {
  if (!text || !query) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);
  
  return `${before}<strong style="color:#e50914;">${match}</strong>${after}`;
}

// Perform search
async function performSearch(query) {
  if (!query.trim()) return;
  
  // Update UI
  currentSearch = query;
  if (resultsTitle) {
    resultsTitle.textContent = `Hasil untuk "${query}"`;
  }
  
  if (loadingElement) {
    loadingElement.style.display = 'block';
  }
  
  if (noResults) {
    noResults.style.display = 'none';
  }
  
  if (searchResults) {
    searchResults.innerHTML = '';
  }
  
  try {
    // Fetch search results
    const response = await fetch(`${BASE_URL}/search/${encodeURIComponent(query)}/1?lang=in`);
    if (!response.ok) throw new Error('Failed to search');
    
    const data = await response.json();
    console.log("Search API response:", data);
    
    // Handle different response structures
    let results = [];
    if (Array.isArray(data.data?.list)) {
      results = data.data.list;
    } else if (Array.isArray(data.data)) {
      results = data.data;
    } else if (Array.isArray(data.list)) {
      results = data.list;
    } else if (Array.isArray(data)) {
      results = data;
    }
    
    // Hide loading
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    
    // Display results
    displaySearchResults(results);
    
    // Update similar dramas based on search
    updateSimilarDramas(results, query);
    
  } catch (error) {
    console.error('Error performing search:', error);
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    showNoResults();
  }
}

// Display search results
function displaySearchResults(results) {
  if (!searchResults) return;
  
  searchResults.innerHTML = '';
  
  if (!results || results.length === 0) {
    showNoResults();
    return;
  }
  
  // Create result cards
  results.forEach(item => {
    // Debug log untuk melihat struktur item
    console.log("Item structure:", item);
    
    const card = createDramaCard(item);
    if (card) {
      searchResults.appendChild(card);
    }
  });
  
  // Show results
  searchResults.style.display = 'grid';
}

// Create drama card element - IMPROVED VERSION
function createDramaCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  
  // Extract title from various possible structures
  let title = 'Judul tidak tersedia';
  
  // Coba berbagai kemungkinan properti untuk judul
  if (item) {
    if (item.title) {
      title = item.title;
    } else if (item.name) {
      title = item.name;
    } else if (item.text) {
      title = item.text;
    } else if (item.bookName) {
      title = item.bookName;
    } else if (item.originalTitle) {
      title = item.originalTitle;
    } else if (item.dramaName) {
      title = item.dramaName;
    }
  }
  
  // Extract image URL from various possible structures
  let imageUrl = 'https://via.placeholder.com/150x200?text=No+Image';
  
  if (item) {
    if (item.cover) {
      imageUrl = item.cover;
    } else if (item.image) {
      imageUrl = item.image;
    } else if (item.poster) {
      imageUrl = item.poster;
    } else if (item.thumbnail) {
      imageUrl = item.thumbnail;
    } else if (item.img) {
      imageUrl = item.img;
    }
  }
  
  // Extract bookId from various possible structures
  let bookId = '';
  
  if (item) {
    if (item.bookId) {
      bookId = item.bookId;
    } else if (item.id) {
      bookId = item.id;
    } else if (item._id) {
      bookId = item._id;
    } else if (item.dramaId) {
      bookId = item.dramaId;
    }
  }
  
  // Create card HTML
  card.innerHTML = `
    ${bookId ? '<div class="exclusive-tag" style="display: none;">Dramasox</div>' : ''}
    <img src="${imageUrl}" alt="${title}" 
         onerror="this.src='https://via.placeholder.com/150x200?text=No+Image'">
    <p>${title}</p>
  `;
  
  // Add click handler if we have a bookId
  if (bookId) {
    card.addEventListener('click', () => {
      window.location.href = `detail.html?bookId=${bookId}`;
    });
    
    // Style for clickable cards
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.3s ease';
    
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-5px)';
      card.style.boxShadow = '0 10px 20px rgba(229, 9, 20, 0.1)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });
  } else {
    // Style for non-clickable cards
    card.style.opacity = '0.7';
    card.style.cursor = 'not-allowed';
  }
  
  return card;
}

// Show no results message
function showNoResults() {
  if (searchResults) {
    searchResults.style.display = 'none';
  }
  if (noResults) {
    noResults.style.display = 'block';
  }
}

// Clear search results
function clearSearchResults() {
  if (searchResults) {
    searchResults.innerHTML = '';
    searchResults.style.display = 'none';
  }
  if (noResults) {
    noResults.style.display = 'none';
  }
  if (resultsTitle) {
    resultsTitle.textContent = 'Hasil Pencarian';
  }
}

// Clear search
function clearSearch() {
  if (searchInput) {
    searchInput.value = '';
  }
  currentSearch = '';
  
  if (clearSearchBtn) {
    clearSearchBtn.style.display = 'none';
  }
  
  hideSuggestions();
  clearSearchResults();
  
  // Reload similar dramas
  loadSimilarDramas();
}

// Show suggestions
function showSuggestions() {
  if (searchSuggestions) {
    searchSuggestions.classList.add('show');
  }
}

// Hide suggestions
function hideSuggestions() {
  if (searchSuggestions) {
    searchSuggestions.classList.remove('show');
  }
}

// Load similar/recommended dramas
async function loadSimilarDramas() {
  try {
    // Fetch recommended dramas
    const response = await fetch(`${BASE_URL}/foryou/1?lang=in`);
    if (!response.ok) throw new Error('Failed to load similar dramas');
    
    const data = await response.json();
    console.log("Similar dramas API response:", data);
    
    let dramas = [];
    if (Array.isArray(data.data?.list)) {
      dramas = data.data.list;
    } else if (Array.isArray(data.data)) {
      dramas = data.data;
    } else if (Array.isArray(data.list)) {
      dramas = data.list;
    } else if (Array.isArray(data)) {
      dramas = data;
    }
    
    displaySimilarDramas(dramas);
    
  } catch (error) {
    console.error('Error loading similar dramas:', error);
    if (similarResults) {
      similarResults.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">Tidak dapat memuat drama serupa.</p>';
    }
  }
}

// Update similar dramas based on search
async function updateSimilarDramas(searchResultsData, query) {
  try {
    // If we have search results, get recommendations based on first result
    if (searchResultsData && searchResultsData.length > 0) {
      const firstResult = searchResultsData[0];
      const genre = firstResult.genre || firstResult.category || '';
      
      if (genre) {
        // Try to fetch similar based on genre/category
        const response = await fetch(`${BASE_URL}/search/${encodeURIComponent(genre)}/1?lang=in`);
        if (response.ok) {
          const data = await response.json();
          let similar = [];
          
          if (Array.isArray(data.data?.list)) {
            similar = data.data.list;
          } else if (Array.isArray(data.data)) {
            similar = data.data;
          } else if (Array.isArray(data.list)) {
            similar = data.list;
          } else if (Array.isArray(data)) {
            similar = data;
          }
          
          // Filter out the current search results
          const filteredSimilar = similar.filter(item => 
            !searchResultsData.some(result => {
              const resultId = result.bookId || result.id || result._id;
              const itemId = item.bookId || item.id || item._id;
              return resultId === itemId;
            })
          );
          
          displaySimilarDramas(filteredSimilar.slice(0, 6));
          return;
        }
      }
    }
    
    // Fallback to trending dramas
    const response = await fetch(`${BASE_URL}/rank/1?lang=in`);
    if (!response.ok) throw new Error('Failed to load similar');
    
    const data = await response.json();
    let dramas = [];
    
    if (Array.isArray(data.data?.list)) {
      dramas = data.data.list;
    } else if (Array.isArray(data.data)) {
      dramas = data.data;
    } else if (Array.isArray(data.list)) {
      dramas = data.list;
    } else if (Array.isArray(data)) {
      dramas = data;
    }
    
    displaySimilarDramas(dramas.slice(0, 6));
    
  } catch (error) {
    console.error('Error updating similar dramas:', error);
    // Keep existing similar dramas
  }
}

// Display similar dramas
function displaySimilarDramas(dramas) {
  if (!similarResults) return;
  
  similarResults.innerHTML = '';
  
  if (!dramas || dramas.length === 0) {
    similarResults.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">Tidak ada drama serupa.</p>';
    return;
  }
  
  // Show section title for similar dramas
  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'similar-title';
  sectionTitle.innerHTML = `
    <span class="material-symbols-outlined">movie</span>
    Drama Serupa
  `;
  similarResults.appendChild(sectionTitle);
  
  // Create grid container
  const gridContainer = document.createElement('div');
  gridContainer.className = 'drama-grid';
  
  // Create cards for similar dramas
  dramas.slice(0, 8).forEach(item => {
    const card = createDramaCard(item);
    if (card) {
      gridContainer.appendChild(card);
    }
  });
  
  similarResults.appendChild(gridContainer);
}

// Handle image loading errors globally
document.addEventListener('DOMContentLoaded', () => {
  // Add global error handler for images
  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
      e.target.src = 'https://via.placeholder.com/150x200?text=No+Image';
    }
  }, true);
});