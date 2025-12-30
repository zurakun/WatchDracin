const BASE_URL = "https://restxdb.onrender.com/api";

// Fungsi untuk mengambil data dengan error handling
async function fetchData(url) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    return null;
  }
}

// Fungsi untuk mengekstrak list dari berbagai struktur data
function extractList(data) {
  if (!data) return [];
  
  // Coba berbagai kemungkinan struktur
  if (Array.isArray(data.data?.list)) {
    return data.data.list;
  } else if (Array.isArray(data.list)) {
    return data.list;
  } else if (Array.isArray(data.data)) {
    return data.data;
  } else if (Array.isArray(data)) {
    return data;
  } else if (data.data && typeof data.data === 'object') {
    // Cari properti array di dalam data
    const arrayKeys = Object.keys(data.data).filter(key => Array.isArray(data.data[key]));
    if (arrayKeys.length > 0) {
      return data.data[arrayKeys[0]];
    }
  }
  
  return [];
}

// Fungsi untuk mengekstrak judul dari item
function extractTitle(item) {
  return item.title || item.name || item.bookName || item.dramaName || "Judul Tidak Diketahui";
}

// Fungsi untuk mengekstrak cover dari item
function extractCover(item) {
  return item.cover || item.image || item.poster || item.thumbnail || "https://via.placeholder.com/120x170?text=No+Image";
}

// Fungsi untuk mengekstrak bookId dari item
function extractBookId(item) {
  return item.bookId || item.id || item.dramaId || "0";
}

function renderDrama(list, elementId) {
  if (!Array.isArray(list)) {
    console.error("Data bukan array:", list);
    const container = document.getElementById(elementId);
    if (container) {
      container.innerHTML = "<p>Gagal memuat data.</p>";
    }
    return;
  }

  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`Container dengan id "${elementId}" tidak ditemukan`);
    return;
  }

  container.innerHTML = "";

  // Jika list kosong
  if (list.length === 0) {
    container.innerHTML = "<p>Tidak ada data tersedia.</p>";
    return;
  }

  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    
    // Gunakan fungsi extract untuk mendapatkan data yang konsisten
    const title = extractTitle(item);
    const cover = extractCover(item);
    const bookId = extractBookId(item);

    card.innerHTML = `
      <img src="${cover}" alt="${title}" onerror="this.src='https://via.placeholder.com/120x170?text=No+Image'">
      <p>${title}</p>
    `;

    card.onclick = () => {
      if (bookId && bookId !== "0") {
        location.href = `detail.html?bookId=${bookId}`;
      } else {
        console.error("BookId tidak valid untuk item:", item);
        alert("Tidak dapat membuka detail. ID tidak valid.");
      }
    };

    container.appendChild(card);
  });
}

// Fungsi untuk memuat semua data
async function loadAllData() {
  // 🔥 Rekomendasi
  console.log("=== Loading Rekomendasi ===");
  const foryouData = await fetchData(`${BASE_URL}/foryou/1?lang=in`);
  if (foryouData) {
    const foryouList = extractList(foryouData);
    renderDrama(foryouList, "foryou");
  } else {
    document.getElementById("foryou").innerHTML = "<p>Gagal memuat rekomendasi.</p>";
  }

  // 🆕 Rilis Terbaru
  console.log("=== Loading Rilis Terbaru ===");
  const newData = await fetchData(`${BASE_URL}/new/1?lang=in&pageSize=10`);
  if (newData) {
    const newList = extractList(newData);
    renderDrama(newList, "new");
  } else {
    document.getElementById("new").innerHTML = "<p>Gagal memuat rilis terbaru.</p>";
  }

  // ⭐ Ranking
  console.log("=== Loading Ranking ===");
  const rankData = await fetchData(`${BASE_URL}/rank/1?lang=in`);
  if (rankData) {
    const rankList = extractList(rankData);
    renderDrama(rankList, "rank");
  } else {
    document.getElementById("rank").innerHTML = "<p>Gagal memuat ranking.</p>";
  }
}

// Fungsi untuk handle search form
function setupSearchForm() {
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInputHome');
  
  if (searchForm && searchInput) {
    // Handle form submission
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      
      if (query) {
        // Redirect ke halaman search dengan query
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      }
    });
    
    // Focus pada input saat halaman dimuat
    searchInput.focus();
  }
}

// Tambahkan fallback jika API down
async function loadWithFallback() {
  try {
    await loadAllData();
  } catch (error) {
    console.error("Error loading data:", error);
    
    // Tampilkan pesan error di semua section
    const sections = ["foryou", "new", "rank"];
    sections.forEach(sectionId => {
      const container = document.getElementById(sectionId);
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #aaa;">
            <p>Gagal memuat data</p>
            <button onclick="loadAllData()" style="padding: 8px 16px; background: #e50914; color: white; border: none; border-radius: 4px; margin-top: 10px;">
              Coba Lagi
            </button>
          </div>
        `;
      }
    });
  }
}

// Jalankan saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  console.log("Starting home.js...");
  setupSearchForm(); // Setup form search
  loadWithFallback();
});

// Tambahkan retry function ke global scope
window.retryLoadData = loadAllData;