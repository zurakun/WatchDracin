// ============================
// CONFIGURATION
// ============================
const BASE_URL = "https://restxdb.onrender.com/api";

// ============================
// HELPER FUNCTIONS (MINIMAL ADDITION)
// ============================
/**
 * Validasi dan normalisasi bookId untuk detail API
 * @param {any} id - ID dari API response
 * @returns {string|null} - ID yang dinormalisasi atau null jika tidak valid
 */
function normalizeBookId(id) {
  if (id == null || id === undefined) return null;
  
  // Convert to string dan trim
  const strId = String(id).trim();
  
  // Cek jika kosong atau invalid
  if (!strId || 
      strId === "null" || 
      strId === "undefined" || 
      strId === "0" ||
      strId.length === 0) {
    return null;
  }
  
  // Cek jika hanya whitespace
  if (!strId.replace(/\s/g, '').length) return null;
  
  // Pastikan ID tidak mengandung karakter berbahaya untuk URL
  // tetapi tetap biarkan karakter yang valid untuk encodeURIComponent
  return strId;
}

/**
 * Ekstrak ID terbaik dari item dengan prioritas
 * @param {object} item - Item drama dari API
 * @returns {string|null} - ID terbaik atau null
 */
function getBestBookId(item) {
  if (!item || typeof item !== 'object') return null;
  
  // Prioritas field ID (sesuai kemungkinan detail API)
  const idFields = [
    'bookId',      // Prioritas utama
    'book_id',     // Variasi snake_case
    'id',          // Umum
    '_id',         // MongoDB style
    'contentId',   // Alternatif
    'dramaId',     // Alternatif
    'bookID'       // Variasi kapital
  ];
  
  // Coba setiap field
  for (const field of idFields) {
    if (item[field] !== undefined && item[field] !== null) {
      const normalizedId = normalizeBookId(item[field]);
      if (normalizedId) {
        console.log(`Found ID in field "${field}": ${item[field]} → ${normalizedId}`);
        return normalizedId;
      }
    }
  }
  
  return null;
}

/**
 * Validasi apakah bookId bisa digunakan untuk detail page
 * @param {string} bookId - ID yang akan divalidasi
 * @returns {boolean} - true jika valid
 */
function isValidBookId(bookId) {
  if (!bookId) return false;
  
  // Validasi dasar
  const strId = String(bookId).trim();
  
  // Tidak boleh kosong
  if (!strId || strId === "null" || strId === "undefined") return false;
  
  // Harus memiliki panjang minimum (biasanya ID minimal 1 digit)
  if (strId.length < 1) return false;
  
  // Untuk numeric ID, harus > 0
  const numId = Number(strId);
  if (!isNaN(numId) && numId <= 0) return false;
  
  return true;
}

// ============================
// QUERY PARAMETERS
// ============================
const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get("q");

// ============================
// DOM ELEMENTS
// ============================
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearch");
const searchSuggestions = document.getElementById("searchSuggestions");
const loadingElement = document.getElementById("loading");
const searchResults = document.getElementById("searchResults");
const resultsTitle = document.getElementById("resultsTitle");
const noResults = document.getElementById("noResults");
const similarResults = document.getElementById("similarResults");
const backButton = document.getElementById("backButton");

// ============================
// STATE VARIABLES
// ============================
let searchTimeout = null;
let currentSearch = "";

// ============================
// INITIALIZATION
// ============================
document.addEventListener("DOMContentLoaded", initSearch);

function initSearch() {
  setupEventListeners();

  if (!searchInput) {
    console.error("Search input element not found!");
    return;
  }

  // Set focus on search input
  searchInput.focus();

  // Handle back button
  if (backButton) {
    backButton.addEventListener("click", () => {
      window.history.back();
    });
  }

  // Check for initial search query
  if (initialQuery) {
    const query = decodeURIComponent(initialQuery).trim();
    searchInput.value = query;
    currentSearch = query;
    
    if (clearSearchBtn) {
      clearSearchBtn.style.display = "flex";
    }
    
    performSearch(query);
  } else {
    // Load similar dramas if no search query
    loadSimilarDramas();
  }
}

// ============================
// EVENT LISTENERS
// ============================
function setupEventListeners() {
  // Search input events
  if (searchInput) {
    searchInput.addEventListener("input", handleSearchInput);
    searchInput.addEventListener("keydown", handleKeyDown);
    searchInput.addEventListener("focus", showSuggestions);
  }

  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", clearSearch);
  }

  // Close suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (
      searchSuggestions &&
      !searchSuggestions.contains(e.target) &&
      e.target !== searchInput
    ) {
      hideSuggestions();
    }
  });
}

// ============================
// SEARCH INPUT HANDLING
// ============================
function handleSearchInput(e) {
  const query = e.target.value.trim();
  currentSearch = query;

  // Show/hide clear button
  if (clearSearchBtn) {
    clearSearchBtn.style.display = query ? "flex" : "none";
  }

  // Clear previous timeout
  clearTimeout(searchTimeout);

  if (!query) {
    clearSearchResults();
    loadSimilarDramas();
    hideSuggestions();
    return;
  }

  // Only search if query has at least 2 characters
  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  // Debounce search
  searchTimeout = setTimeout(() => {
    fetchSuggestions(query);
    performSearch(query);
  }, 300);
}

function handleKeyDown(e) {
  if (e.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) {
      hideSuggestions();
      performSearch(query);
      // Update URL without reloading
      const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
      window.history.pushState({}, '', newUrl);
    }
  }
  
  if (e.key === "Escape") {
    hideSuggestions();
  }
}

// ============================
// SEARCH SUGGESTIONS
// ============================
async function fetchSuggestions(query) {
  if (!query || query.length < 2) return;

  try {
    const response = await fetch(
      `${BASE_URL}/suggest/${encodeURIComponent(query)}?lang=in`
    );
    
    if (!response.ok) {
      searchSuggestions.innerHTML = "";
      return;
    }
    
    const data = await response.json();
    displaySuggestions(data.data || [], query);
  } catch (error) {
    console.error("Fetch suggestions error:", error);
    searchSuggestions.innerHTML = "";
  }
}

function displaySuggestions(items, query) {
  if (!searchSuggestions || !items || items.length === 0) {
    hideSuggestions();
    return;
  }

  searchSuggestions.innerHTML = "";
  
  // Limit to 5 suggestions
  items.slice(0, 5).forEach((item) => {
    let text = "";
    
    // Handle different item structures
    if (typeof item === "string") {
      text = item;
    } else if (item.title) {
      text = item.title;
    } else if (item.name) {
      text = item.name;
    } else if (item.text) {
      text = item.text;
    } else {
      return; // Skip invalid items
    }

    const suggestionItem = document.createElement("div");
    suggestionItem.className = "suggestion-item";
    suggestionItem.innerHTML = `
      <span class="material-symbols-outlined">search</span>
      ${highlightMatch(text, query)}
    `;
    
    suggestionItem.onclick = () => {
      searchInput.value = text;
      hideSuggestions();
      performSearch(text);
      // Update URL
      const newUrl = `${window.location.pathname}?q=${encodeURIComponent(text)}`;
      window.history.pushState({}, '', newUrl);
    };
    
    searchSuggestions.appendChild(suggestionItem);
  });

  showSuggestions();
}

function highlightMatch(text, query) {
  if (!text || !query) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  return (
    text.substring(0, index) +
    `<strong style="color:#e50914">${text.substring(index, index + query.length)}</strong>` +
    text.substring(index + query.length)
  );
}

// ============================
// PERFORM SEARCH (FIXED)
// ============================
async function performSearch(query) {
  if (!query || query.trim() === "") {
    clearSearchResults();
    loadSimilarDramas();
    return;
  }

  // Update UI state
  if (resultsTitle) {
    resultsTitle.textContent = `Hasil untuk "${query}"`;
  }
  
  if (loadingElement) {
    loadingElement.style.display = "block";
  }
  
  if (noResults) {
    noResults.style.display = "none";
  }
  
  if (searchResults) {
    searchResults.innerHTML = "";
    searchResults.style.display = "none";
  }

  try {
    console.log("Searching for:", query);
    const response = await fetch(
      `${BASE_URL}/search/${encodeURIComponent(query)}/1?lang=in`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Search response:", data);
    
    // Hide loading
    if (loadingElement) {
      loadingElement.style.display = "none";
    }

    // Extract results based on API structure
    let results = [];
    
    // Try different response structures
    if (Array.isArray(data.data)) {
      results = data.data;
    } else if (Array.isArray(data.data?.list)) {
      results = data.data.list;
    } else if (Array.isArray(data.list)) {
      results = data.list;
    } else if (Array.isArray(data)) {
      results = data;
    } else if (data.data && typeof data.data === 'object') {
      // If data.data is an object, look for any array inside it
      Object.keys(data.data).forEach(key => {
        if (Array.isArray(data.data[key])) {
          results = data.data[key];
        }
      });
    }

    console.log("Extracted results:", results);

    if (!results || results.length === 0) {
      showNoResults();
      return;
    }

    // =============================================
    // FIXED: Normalize and validate data dengan fungsi helper
    // =============================================
    const normalizedResults = results.map(item => {
      // Gunakan fungsi helper untuk mendapatkan ID terbaik
      const bookId = getBestBookId(item);
      
      // DEBUG: Log jika item memiliki field ID tapi tidak valid
      if (item.bookId || item.id || item._id) {
        console.log(`Item DEBUG:`, {
          title: item.title || item.name,
          rawBookId: item.bookId,
          rawId: item.id,
          raw_id: item._id,
          normalizedBookId: bookId
        });
      }
      
      return {
        ...item,
        bookId: bookId, // Bisa jadi null
        title: item.title || item.name || item.bookName || "Judul tidak tersedia",
        cover: item.cover || item.poster || item.image || "https://via.placeholder.com/150x200?text=No+Image"
      };
    })
    // Filter hanya item dengan bookId yang valid
    .filter(item => {
      const isValid = isValidBookId(item.bookId);
      if (!isValid) {
        console.warn(`Filtering out item (invalid bookId):`, {
          title: item.title,
          bookId: item.bookId
        });
      }
      return isValid;
    });

    console.log("Normalized results (after validation):", normalizedResults);

    if (normalizedResults.length === 0) {
      console.warn(`No valid results after bookId validation for query: "${query}"`);
      showNoResults();
      return;
    }

    displaySearchResults(normalizedResults);
    updateSimilarDramas(normalizedResults);

  } catch (error) {
    console.error("Search error:", error);
    
    if (loadingElement) {
      loadingElement.style.display = "none";
    }
    
    showNoResults();
  }
}

// ============================
// DISPLAY SEARCH RESULTS
// ============================
function displaySearchResults(results) {
  if (!searchResults) return;
  
  // Clear previous results
  searchResults.innerHTML = "";
  
  // Use drama-grid class for layout
  searchResults.className = "drama-grid";
  searchResults.style.display = "grid";
  
  results.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    
    // Add exclusive tag if available
    const exclusiveTag = item.exclusive || item.isExclusive 
      ? '<div class="exclusive-tag">EXCLUSIVE</div>' 
      : '';
    
    card.innerHTML = `
      ${exclusiveTag}
      <img src="${item.cover}" alt="${item.title}" 
           onerror="this.onerror=null; this.src='https://via.placeholder.com/150x200?text=No+Image'">
      <p>${item.title}</p>
    `;
    
    // =============================================
    // FIXED: Validasi bookId sebelum membuat card clickable
    // =============================================
    if (item.bookId && isValidBookId(item.bookId)) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        console.log("Navigating to detail for bookId:", item.bookId, "(type:", typeof item.bookId + ")");
        
        // Simpan data ke sessionStorage untuk fallback di detail page
        try {
          sessionStorage.setItem('selectedDrama', JSON.stringify({
            ...item,
            timestamp: Date.now()
          }));
          console.log("Saved to sessionStorage for backup");
        } catch (e) {
          console.warn("Failed to save to sessionStorage:", e);
        }
        
        // Redirect dengan bookId yang sudah divalidasi
        window.location.href = `detail.html?bookId=${encodeURIComponent(item.bookId)}`;
      });
    } else {
      // Non-clickable card jika bookId tidak valid
      console.warn(`Card not clickable - invalid bookId:`, {
        title: item.title,
        bookId: item.bookId
      });
      card.style.opacity = "0.6";
      card.style.cursor = "not-allowed";
      card.title = "Drama tidak tersedia (ID tidak valid)";
    }
    
    searchResults.appendChild(card);
  });
  
  // Hide similar results when we have search results
  if (similarResults) {
    similarResults.style.display = "none";
  }
}

// ============================
// NO RESULTS HANDLING
// ============================
function showNoResults() {
  if (searchResults) {
    searchResults.style.display = "none";
  }
  
  if (noResults) {
    noResults.style.display = "block";
    noResults.innerHTML = `
      <h3>Tidak ada hasil</h3>
      <p>Tidak ditemukan drama dengan kata kunci "${currentSearch}"</p>
    `;
  }
  
  // Show similar dramas when no results
  loadSimilarDramas();
}

function clearSearchResults() {
  if (searchResults) {
    searchResults.innerHTML = "";
    searchResults.style.display = "none";
  }
  
  if (noResults) {
    noResults.style.display = "none";
  }
  
  if (resultsTitle) {
    resultsTitle.textContent = "Hasil Pencarian";
  }
}

function clearSearch() {
  if (searchInput) {
    searchInput.value = "";
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.style.display = "none";
  }
  
  hideSuggestions();
  clearSearchResults();
  loadSimilarDramas();
  
  // Clear URL parameter
  window.history.pushState({}, '', window.location.pathname);
}

// ============================
// SIMILAR DRAMAS
// ============================
async function loadSimilarDramas() {
  try {
    console.log("Loading similar dramas...");
    const response = await fetch(`${BASE_URL}/foryou/1?lang=in`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Similar dramas response:", data);
    
    // Extract dramas from response
    let dramas = [];
    
    if (Array.isArray(data.data)) {
      dramas = data.data;
    } else if (Array.isArray(data.data?.list)) {
      dramas = data.data.list;
    } else if (Array.isArray(data.list)) {
      dramas = data.list;
    } else if (Array.isArray(data)) {
      dramas = data;
    }
    
    if (dramas.length > 0) {
      displaySimilarDramas(dramas);
    } else {
      displaySimilarDramas([]);
    }
    
  } catch (error) {
    console.error("Error loading similar dramas:", error);
    if (similarResults) {
      similarResults.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          Gagal memuat rekomendasi
        </div>
      `;
    }
  }
}

function updateSimilarDramas(searchData) {
  // If we have search results, hide similar dramas
  if (searchData && searchData.length > 0) {
    if (similarResults) {
      similarResults.style.display = "none";
    }
  } else {
    // Otherwise show similar dramas
    loadSimilarDramas();
  }
}

function displaySimilarDramas(dramas) {
  if (!similarResults) return;
  
  // Clear previous content
  similarResults.innerHTML = "";
  similarResults.style.display = "block";
  
  // Set the class for grid layout
  similarResults.className = "drama-grid";
  
  // Limit to 6 items
  const limitedDramas = dramas.slice(0, 6);
  
  if (limitedDramas.length === 0) {
    similarResults.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
        Tidak ada drama yang tersedia
      </div>
    `;
    return;
  }
  
  limitedDramas.forEach(item => {
    // =============================================
    // FIXED: Gunakan fungsi helper untuk normalisasi
    // =============================================
    const bookId = getBestBookId(item);
    const title = item.title || item.name || item.bookName || "Judul tidak tersedia";
    const cover = item.cover || item.poster || item.image || "https://via.placeholder.com/150x200?text=No+Image";
    
    const card = document.createElement("div");
    card.className = "card";
    
    // Add exclusive tag if available
    const exclusiveTag = item.exclusive || item.isExclusive 
      ? '<div class="exclusive-tag">EXCLUSIVE</div>' 
      : '';
    
    card.innerHTML = `
      ${exclusiveTag}
      <img src="${cover}" alt="${title}"
           onerror="this.onerror=null; this.src='https://via.placeholder.com/150x200?text=No+Image'">
      <p>${title}</p>
    `;
    
    // =============================================
    // FIXED: Validasi bookId sebelum membuat card clickable
    // =============================================
    if (bookId && isValidBookId(bookId)) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        // Simpan data ke sessionStorage
        try {
          const normalizedItem = {
            ...item,
            bookId: bookId,
            title: title,
            cover: cover,
            timestamp: Date.now()
          };
          sessionStorage.setItem('selectedDrama', JSON.stringify(normalizedItem));
          console.log("Saved similar drama to sessionStorage");
        } catch (e) {
          console.warn("Failed to save similar drama to sessionStorage:", e);
        }
        
        window.location.href = `detail.html?bookId=${encodeURIComponent(bookId)}`;
      });
    } else {
      // Non-clickable card jika bookId tidak valid
      card.style.opacity = "0.6";
      card.style.cursor = "not-allowed";
      card.title = "Drama tidak tersedia (ID tidak valid)";
    }
    
    similarResults.appendChild(card);
  });
}

// ============================
// SUGGESTIONS VISIBILITY
// ============================
function showSuggestions() {
  if (searchSuggestions && searchSuggestions.children.length > 0) {
    searchSuggestions.classList.add("show");
  }
}

function hideSuggestions() {
  if (searchSuggestions) {
    searchSuggestions.classList.remove("show");
  }
}

// ============================
// ERROR HANDLING UTILITIES
// ============================
function handleApiError(error) {
  console.error("API Error:", error);
  
  if (loadingElement) {
    loadingElement.style.display = "none";
  }
  
  showNoResults();
}

// Handle browser back/forward navigation
window.addEventListener('popstate', function(event) {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q");
  
  if (query) {
    searchInput.value = decodeURIComponent(query);
    currentSearch = query;
    if (clearSearchBtn) clearSearchBtn.style.display = "flex";
    performSearch(query);
  } else {
    searchInput.value = "";
    currentSearch = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";
    clearSearchResults();
    loadSimilarDramas();
  }
});
