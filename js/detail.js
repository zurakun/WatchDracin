const BASE_URL = "https://restxdb.onrender.com/api";

// === PERBAIKAN 1: Normalisasi ID dari berbagai sumber ===
// Ambil bookId dari URL dengan berbagai parameter yang mungkin
const urlParams = new URLSearchParams(window.location.search);
let bookId = urlParams.get('bookId') || 
             urlParams.get('id') || 
             urlParams.get('contentId') || 
             urlParams.get('dramaId');

// === PERBAIKAN 2: Coba dari sessionStorage jika URL kosong ===
if (!bookId) {
    console.log("bookId tidak ditemukan di URL, mencoba dari sessionStorage...");
    const savedDrama = sessionStorage.getItem('selectedDrama');
    if (savedDrama) {
        try {
            const dramaData = JSON.parse(savedDrama);
            // Cari ID dari berbagai field
            bookId = dramaData.bookId || dramaData.id || dramaData._id || 
                     dramaData.contentId || dramaData.dramaId;
            console.log("bookId dari sessionStorage:", bookId);
            
            // Simpan ke URL tanpa reload
            if (bookId && !window.location.search.includes(bookId)) {
                const newUrl = `${window.location.pathname}?bookId=${bookId}`;
                window.history.replaceState(null, '', newUrl);
                console.log("URL diperbarui dengan bookId:", bookId);
            }
        } catch (e) {
            console.error("Error parsing sessionStorage:", e);
        }
    }
}

// === PERBAIKAN 3: Tambah debug log untuk ID ===
console.log("=== ID DEBUG ===");
console.log("URL Search Params:", Object.fromEntries(urlParams.entries()));
console.log("Final bookId:", bookId);

// DOM Elements
const dramaDetails = document.getElementById('drama-details');
const episodeList = document.getElementById('episode-list');
const loadingDiv = document.getElementById('loading');

// Variable global
let firstEpisodeNumber = 1;
let currentEpisodes = [];
let currentPage = 1;
const episodesPerPage = 50;

// Debug: cek apakah elemen ditemukan
console.log("Element check:", {
  dramaDetails: !!dramaDetails,
  episodeList: !!episodeList,
  loadingDiv: !!loadingDiv,
  bookId: bookId
});

// Coba berbagai kemungkinan endpoint dengan berbagai format ID
const ENDPOINTS = bookId ? [
  `book/${bookId}?lang=in`,
  `detail/${bookId}?lang=in`,
  `info/${bookId}?lang=in`,
  `drama/${bookId}?lang=in`,
  // Tambahan: endpoint dengan format berbeda
  `book?id=${bookId}&lang=in`,
  `detail?id=${bookId}&lang=in`,
  `info?id=${bookId}&lang=in`
] : [];

async function tryEndpoints(endpoints) {
  for (const endpoint of endpoints) {
    try {
      console.log(`Mencoba endpoint: ${endpoint}`);
      const response = await fetch(`${BASE_URL}/${endpoint}`);
      if (!response.ok) {
        console.log(`Endpoint ${endpoint} gagal: ${response.status}`);
        continue;
      }
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.log(`Endpoint ${endpoint} mengembalikan response kosong`);
        continue;
      }
      try {
        const data = JSON.parse(text);
        console.log(`Endpoint ${endpoint} berhasil`);
        return data;
      } catch (jsonError) {
        console.log(`Endpoint ${endpoint} bukan JSON`);
        continue;
      }
    } catch (error) {
      console.log(`Error pada endpoint ${endpoint}:`, error.message);
      continue;
    }
  }
  return null;
}

async function loadDramaDetails() {
  try {
    if (!bookId) {
      // Coba sekali lagi dari sessionStorage sebelum error
      const savedDrama = sessionStorage.getItem('selectedDrama');
      if (savedDrama) {
        try {
          const dramaData = JSON.parse(savedDrama);
          bookId = dramaData.bookId || dramaData.id || dramaData._id || 
                   dramaData.contentId || dramaData.dramaId;
          console.log("Retry bookId dari sessionStorage:", bookId);
        } catch (e) {
          // Ignore error
        }
      }
      
      if (!bookId) {
        throw new Error("Book ID tidak ditemukan di URL atau sessionStorage");
      }
    }
    
    console.log("Memulai loadDramaDetails untuk bookId:", bookId, "(tipe:", typeof bookId + ")");
    
    // Tampilkan loading
    showLoading();
    
    const detailData = await tryEndpoints(ENDPOINTS);
    let drama = null;

    // GANTI: Bagian fallback yang diperbaiki
    if (!detailData) {
      console.log("Semua endpoint gagal, mencoba fallback...");
      try {
        const fallbackRes = await fetch(`${BASE_URL}/foryou/1?lang=in`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          console.log("Fallback data structure:", fallbackData);
          
          // Cari drama dengan berbagai kemungkinan field ID
          let dramas = [];
          if (fallbackData.data && Array.isArray(fallbackData.data.list)) {
            dramas = fallbackData.data.list;
          } else if (fallbackData.data && Array.isArray(fallbackData.data)) {
            dramas = fallbackData.data;
          } else if (Array.isArray(fallbackData.list)) {
            dramas = fallbackData.list;
          } else if (Array.isArray(fallbackData)) {
            dramas = fallbackData;
          }
          
          console.log("Dramas from fallback:", dramas.length);
          
          // === PERBAIKAN 4: Normalisasi ID di pencarian fallback ===
          drama = dramas.find(d => {
            if (!d) return false;
            
            // Coba match dengan berbagai field ID
            const idFields = ['bookId', 'id', '_id', 'book_id', 'bookID', 'contentId', 'dramaId'];
            for (const field of idFields) {
              if (d[field] && d[field].toString() === bookId.toString()) {
                console.log(`Found drama dengan field ${field}: ${d[field]} (matching ${bookId})`);
                return true;
              }
            }
            
            // Coba match dengan judul dari sessionStorage (last resort)
            const savedDrama = sessionStorage.getItem('selectedDrama');
            if (savedDrama) {
              try {
                const savedData = JSON.parse(savedDrama);
                if (savedData.title && d.title && 
                    savedData.title.trim().toLowerCase() === d.title.trim().toLowerCase()) {
                  console.log(`Found drama dengan judul match: ${d.title}`);
                  return true;
                }
              } catch (e) {
                // Ignore
              }
            }
            
            return false;
          });
          
          if (drama) {
            console.log("Drama ditemukan dari fallback:", drama);
            displayDramaDetails(drama, []);
            return;
          }
        }
      } catch (fallbackError) {
        console.log("Fallback juga gagal:", fallbackError.message);
      }
      throw new Error("Tidak dapat menemukan data drama.");
    }

    // GANTI: Ekstrak data drama yang diperbaiki
    console.log("Detail data received:", detailData);

    // Coba lebih banyak struktur data yang mungkin
    if (detailData && typeof detailData === 'object') {
      // Prioritaskan data yang memiliki bookId yang cocok
      const findDramaInArray = (arr) => {
        if (!Array.isArray(arr)) return null;
        return arr.find(d => {
          if (!d) return false;
          // Match dengan berbagai field ID
          return (d.bookId && d.bookId.toString() === bookId.toString()) ||
                 (d.id && d.id.toString() === bookId.toString()) ||
                 (d._id && d._id.toString() === bookId.toString()) ||
                 (d.contentId && d.contentId.toString() === bookId.toString()) ||
                 (d.dramaId && d.dramaId.toString() === bookId.toString());
        }) || arr[0];
      };

      if (detailData.data) {
        if (Array.isArray(detailData.data)) {
          drama = findDramaInArray(detailData.data);
        } else if (detailData.data.book && Array.isArray(detailData.data.book)) {
          drama = findDramaInArray(detailData.data.book);
        } else if (detailData.data.drama && Array.isArray(detailData.data.drama)) {
          drama = findDramaInArray(detailData.data.drama);
        } else if (detailData.data.list && Array.isArray(detailData.data.list)) {
          drama = findDramaInArray(detailData.data.list);
        } else if (typeof detailData.data === 'object') {
          // Cek apakah object ini memiliki field yang menandakan itu drama
          const obj = detailData.data;
          if (obj.title || obj.name || obj.bookName || obj.cover || obj.image) {
            drama = obj;
          } else if (obj.book) {
            drama = obj.book;
          } else if (obj.drama) {
            drama = obj.drama;
          }
        }
      } else if (detailData.list && Array.isArray(detailData.list)) {
        drama = findDramaInArray(detailData.list);
      } else if (Array.isArray(detailData)) {
        drama = findDramaInArray(detailData);
      } else if (detailData.book && typeof detailData.book === 'object') {
        drama = detailData.book;
      } else if (detailData.drama && typeof detailData.drama === 'object') {
        drama = detailData.drama;
      } else {
        // Coba cek apakah object langsung merupakan drama
        if (detailData.title || detailData.name || detailData.bookName) {
          drama = detailData;
        }
      }
    }

    if (!drama) {
      console.error("Drama object tidak ditemukan. Struktur data:", detailData);
      throw new Error("Format data tidak dikenali");
    }

    console.log("Drama ditemukan:", drama);
    
    // === PERBAIKAN 5: Simpan drama ke sessionStorage untuk backup ===
    try {
      sessionStorage.setItem('selectedDrama', JSON.stringify({
        ...drama,
        normalizedId: bookId,
        timestamp: Date.now()
      }));
      console.log("Drama disimpan ke sessionStorage");
    } catch (storageError) {
      console.log("Gagal menyimpan ke sessionStorage:", storageError);
    }
    
    // Load episodes
    await loadEpisodes(drama);

  } catch (error) {
    console.error("Error loading drama details:", error);
    
    // === PERBAIKAN 6: Coba tampilkan data dari sessionStorage jika ada ===
    try {
      const savedDrama = sessionStorage.getItem('selectedDrama');
      if (savedDrama) {
        const dramaData = JSON.parse(savedDrama);
        console.log("Mencoba tampilkan drama dari sessionStorage:", dramaData);
        displayDramaDetails(dramaData, []);
        return;
      }
    } catch (fallbackError) {
      console.log("Fallback sessionStorage juga gagal:", fallbackError);
    }
    
    showError(error.message);
  }
}

async function loadEpisodes(drama) {
  try {
    console.log("Memulai loadEpisodes...");
    
    // Tampilkan loading episodes
    if (episodeList) {
      episodeList.innerHTML = `
        <div class="episodes-loading">
          <div class="spinner"></div>
          <p>Memuat daftar episode...</p>
        </div>
      `;
    }
    
    // GANTI: Ambil chapters dengan ekstraksi yang diperbaiki
    let chapters = [];
    const chapterEndpoints = bookId ? [
      `chapters/${bookId}?lang=in`, 
      `episodes/${bookId}?lang=in`,
      `book/${bookId}/chapters?lang=in`,
      `drama/${bookId}/episodes?lang=in`,
      `book/${bookId}/episodes?lang=in`,
      // Tambahan: format query parameter
      `chapters?id=${bookId}&lang=in`,
      `episodes?id=${bookId}&lang=in`
    ] : [];

    // Juga coba dengan ID dari drama object jika berbeda
    const dramaId = drama.bookId || drama.id || drama._id || bookId;
    if (dramaId && dramaId !== bookId) {
      chapterEndpoints.push(
        `chapters/${dramaId}?lang=in`,
        `episodes/${dramaId}?lang=in`
      );
    }
    
    for (const endpoint of chapterEndpoints) {
      try {
        console.log(`Mencoba endpoint episodes: ${endpoint}`);
        const res = await fetch(`${BASE_URL}/${endpoint}`);
        if (res.ok) {
          const cData = await res.json();
          console.log(`Data chapters dari ${endpoint}:`, cData);
          
          // Fungsi helper untuk ekstraksi chapters dari berbagai struktur
          const extractChapters = (data) => {
            if (!data) return [];
            
            // Coba berbagai struktur
            if (Array.isArray(data)) {
              return data;
            }
            
            if (data.data) {
              if (Array.isArray(data.data)) {
                return data.data;
              } else if (data.data.list && Array.isArray(data.data.list)) {
                return data.data.list;
              } else if (data.data.chapters && Array.isArray(data.data.chapters)) {
                return data.data.chapters;
              } else if (data.data.episodes && Array.isArray(data.data.episodes)) {
                return data.data.episodes;
              } else if (typeof data.data === 'object') {
                // Coba flatten object
                const values = Object.values(data.data);
                if (values.length > 0 && Array.isArray(values[0])) {
                  return values[0];
                }
              }
            }
            
            if (data.list && Array.isArray(data.list)) {
              return data.list;
            }
            
            if (data.chapters && Array.isArray(data.chapters)) {
              return data.chapters;
            }
            
            if (data.episodes && Array.isArray(data.episodes)) {
              return data.episodes;
            }
            
            return [];
          };
          
          chapters = extractChapters(cData);
          
          if (chapters.length > 0) {
            console.log(`Ditemukan ${chapters.length} episodes dari ${endpoint}`);
            break;
          }
        }
      } catch (e) { 
        console.log(`Error pada endpoint ${endpoint}:`, e.message);
        continue; 
      }
    }

    // Coba dari data drama jika masih kosong
    if (chapters.length === 0) {
      console.log("Mencoba mengambil chapters dari data drama...");
      chapters = drama.chapters || drama.episodes || [];
    }

    console.log("Total chapters ditemukan:", chapters.length);
    
    // Simpan episodes
    currentEpisodes = chapters;
    
    // Tampilkan detail drama dengan episodes
    displayDramaDetails(drama, chapters);
    
  } catch (error) {
    console.error("Error loading episodes:", error);
    displayDramaDetails(drama, []);
  }
}

function displayDramaDetails(drama, chapters) {
  if (!dramaDetails) {
    console.error("dramaDetails element tidak ditemukan!");
    return;
  }

  console.log("Menampilkan detail drama dengan chapters:", chapters?.length || 0);
  
  const title = drama.title || drama.name || drama.bookName || "Judul tidak tersedia";
  const cover = drama.cover || drama.image || drama.poster || "https://via.placeholder.com/300x400?text=No+Image";
  
  // Sinopsis
  let synopsis = drama.synopsis || drama.description || drama.desc || 
                drama.introduction || drama.info || drama.summary || 
                "Sinopsis tidak tersedia";
  
  if (typeof synopsis === 'string') {
    synopsis = synopsis.replace(/\\n/g, '\n').replace(/<br\s*\/?>/gi, '\n').trim();
  }

  let genre = "Drama";
  if (drama.genre) {
    genre = Array.isArray(drama.genre) ? drama.genre.join(', ') : drama.genre;
  }

  dramaDetails.innerHTML = `
    <div class="drama-header">
      <img src="${cover}" alt="${title}" class="drama-poster" 
           onerror="this.src='https://via.placeholder.com/300x400?text=No+Image'">
      <div class="drama-info">
        <h1>${title}</h1>
        <div class="drama-genre">${genre}</div>
        <button class="play-button" id="play-first-btn">
          <span class="material-symbols-outlined">play_arrow</span> Mulai Drama
        </button>
      </div>
    </div>
    <div class="drama-synopsis">
      <h2>Sinopsis</h2>
      <div class="synopsis-content">${formatSynopsis(synopsis)}</div>
    </div>
  `;

  // Event listener untuk play button
  const playBtn = document.getElementById('play-first-btn');
  if (playBtn) {
    playBtn.addEventListener('click', playFirstEpisode);
  }
  
  // Tampilkan episode list
  if (chapters && chapters.length > 0) {
    console.log("Menampilkan episode list dengan", chapters.length, "episode");
    displayEpisodeList(chapters);
  } else {
    console.log("Tidak ada chapters, menampilkan pesan");
    displayNoEpisodes();
  }

  hideLoading();
}

function formatSynopsis(text) {
  if (!text || text === "Sinopsis tidak tersedia") {
    return '<p class="no-synopsis">Sinopsis tidak tersedia</p>';
  }
  
  const paragraphs = text.split('\n').filter(p => p.trim() !== '');
  
  if (paragraphs.length === 0) {
    return '<p class="no-synopsis">Sinopsis tidak tersedia</p>';
  }
  
  return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
}

function displayEpisodeList(chapters) {
  if (!episodeList) {
    console.error("episodeList element tidak ditemukan!");
    return;
  }
  
  console.log("Displaying episode list with", chapters.length, "chapters");
  
  // Sort episodes secara numerik
  const sorted = [...chapters].sort((a, b) => {
    const aIdx = extractEpisodeNumber(a);
    const bIdx = extractEpisodeNumber(b);
    return aIdx - bIdx;
  });

  console.log("Sorted episodes:", sorted.length);

  // Set first episode number
  if (sorted.length > 0) {
    const firstChapter = sorted[0];
    firstEpisodeNumber = extractEpisodeNumber(firstChapter);
    console.log("First episode number:", firstEpisodeNumber);
  }

  // Hitung total halaman
  const totalPages = Math.ceil(sorted.length / episodesPerPage);
  const startIndex = (currentPage - 1) * episodesPerPage;
  const endIndex = Math.min(startIndex + episodesPerPage, sorted.length);
  const currentPageEpisodes = sorted.slice(startIndex, endIndex);

  console.log("Current page episodes:", currentPageEpisodes.length, "on page", currentPage, "of", totalPages);

  // Buat HTML untuk episode grid
  let episodesHTML = `
    <div class="episode-header">
      <h2>Daftar Episode</h2>
      <div class="episode-count">${sorted.length} Episode</div>
    </div>
    <div class="episode-grid-clean">
  `;

  currentPageEpisodes.forEach((ch, i) => {
    const num = extractEpisodeNumber(ch);
    const title = ch.title || ch.chapterTitle || ch.episodeTitle || `Episode ${num}`;
    
    episodesHTML += `
      <div class="episode-item-clean" data-episode="${num}" title="${title}">
        <div class="episode-number-clean">${num}</div>
      </div>
    `;
  });

  episodesHTML += '</div>';

  // Buat pagination jika lebih dari 1 halaman
  if (totalPages > 1) {
    episodesHTML += createPagination(totalPages);
  }

  episodeList.innerHTML = episodesHTML;
  console.log("Episode list HTML set");

  // Event listeners untuk episode items
  const episodeItems = document.querySelectorAll('.episode-item-clean');
  console.log("Episode items found:", episodeItems.length);
  
  episodeItems.forEach(item => {
    item.addEventListener('click', function() {
      const episodeNum = this.getAttribute('data-episode');
      console.log("Episode clicked:", episodeNum);
      playEpisode(episodeNum);
    });
  });

  // Event listeners untuk pagination
  document.querySelectorAll('.page-btn').forEach(btn => {
    if (!btn.classList.contains('disabled') && !btn.classList.contains('active')) {
      btn.addEventListener('click', function() {
        const pageNum = parseInt(this.getAttribute('data-page'));
        if (pageNum) {
          currentPage = pageNum;
          console.log("Changing to page:", pageNum);
          displayEpisodeList(sorted);
          
          setTimeout(() => {
            episodeList.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      });
    }
  });
}

function extractEpisodeNumber(chapter) {
  if (!chapter || typeof chapter !== 'object') return 1;
  
  // Coba berbagai field yang mungkin
  const possibleFields = [
    'chapterIndex', 'index', 'episodeIndex', 'episode', 
    'chapter', 'episodeNumber', 'number', 'no', 'num'
  ];
  
  for (const field of possibleFields) {
    if (chapter[field] !== undefined && chapter[field] !== null) {
      const value = chapter[field];
      
      // Jika berupa string, coba ekstrak angka
      if (typeof value === 'string') {
        const match = value.match(/(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
      
      // Jika sudah angka
      const num = parseInt(value, 10);
      if (!isNaN(num)) return num;
    }
  }
  
  // Coba dari title
  if (chapter.title) {
    const match = chapter.title.match(/(?:Episode|Episode|Eps|Ep\.?)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  
  return 1;
}

function displayNoEpisodes() {
  if (!episodeList) return;
  
  episodeList.innerHTML = `
    <div class="episode-header">
      <h2>Daftar Episode</h2>
    </div>
    <div class="no-episodes">
      <p>Klik "Mulai Drama" untuk melihat/menonton drama</p>
      <p style="color: #888; font-size: 14px; margin-top: 10px;">
        Episode akan tersedia saat memulai pemutaran
      </p>
    </div>
  `;
}

function createPagination(totalPages) {
  let paginationHTML = '<div class="episode-pagination">';
  
  // Tombol Previous
  if (currentPage > 1) {
    paginationHTML += `<button class="page-btn" data-page="${currentPage - 1}">←</button>`;
  } else {
    paginationHTML += `<button class="page-btn disabled">←</button>`;
  }
  
  // Tampilkan 5 halaman di sekitar current page
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    if (i === currentPage) {
      paginationHTML += `<button class="page-btn active" data-page="${i}">${i}</button>`;
    } else {
      paginationHTML += `<button class="page-btn" data-page="${i}">${i}</button>`;
    }
  }
  
  // Tombol Next
  if (currentPage < totalPages) {
    paginationHTML += `<button class="page-btn" data-page="${currentPage + 1}">→</button>`;
  } else {
    paginationHTML += `<button class="page-btn disabled">→</button>`;
  }
  
  paginationHTML += '</div>';
  return paginationHTML;
}

function playFirstEpisode() {
  console.log("Playing first episode:", firstEpisodeNumber);
  window.location.href = `watch.html?bookId=${bookId}&episode=${firstEpisodeNumber}`;
}

function playEpisode(num) {
  console.log("Playing episode:", num);
  window.location.href = `watch.html?bookId=${bookId}&episode=${num}`;
}

function showLoading() {
  if (loadingDiv) {
    loadingDiv.style.display = 'block';
    loadingDiv.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div class="spinner"></div>
        <p>Memuat detail drama...</p>
        <p style="font-size:12px;color:#666;margin-top:10px;">ID: ${bookId}</p>
      </div>
    `;
  }
  if (dramaDetails) dramaDetails.style.display = 'none';
  if (episodeList) episodeList.style.display = 'none';
}

function hideLoading() {
  if (loadingDiv) loadingDiv.style.display = 'none';
  if (dramaDetails) dramaDetails.style.display = 'block';
  if (episodeList) episodeList.style.display = 'block';
}

function showError(message) {
  if (loadingDiv) {
    loadingDiv.style.display = 'block';
    loadingDiv.innerHTML = `
      <div style="text-align:center;padding:40px;color:#aaa">
        <h3>Gagal memuat drama</h3>
        <p>${message}</p>
        <button onclick="window.location.href='index.html'" 
                style="background:#e50914;color:white;border:none;padding:12px 25px;border-radius:5px;margin-top:20px;cursor:pointer;">
          Cari Drama
        </button>
        <button onclick="window.location.reload()" 
                style="background:#555;color:white;border:none;padding:12px 25px;border-radius:5px;margin-top:10px;cursor:pointer;margin-left:10px;">
          Coba Lagi
        </button>
      </div>
    `;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded, bookId:", bookId);
  
  // === PERBAIKAN 7: Cek sessionStorage untuk data drama ===
  const savedDrama = sessionStorage.getItem('selectedDrama');
  if (savedDrama) {
    try {
      const dramaData = JSON.parse(savedDrama);
      console.log("Drama tersimpan di sessionStorage:", {
        title: dramaData.title || dramaData.name,
        id: dramaData.bookId || dramaData.id
      });
    } catch (e) {
      console.log("Tidak ada data drama di sessionStorage");
    }
  }
  
  if (bookId) {
    loadDramaDetails();
  } else {
    showError("ID Drama tidak ditemukan. Pastikan Anda mengakses dari halaman pencarian.");
  }
});
