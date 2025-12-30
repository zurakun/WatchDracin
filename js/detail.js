const BASE_URL = "https://restxdb.onrender.com/api";

// Ambil bookId dari URL
const urlParams = new URLSearchParams(window.location.search);
const bookId = urlParams.get('bookId');

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

// Coba berbagai kemungkinan endpoint
const ENDPOINTS = [
  `book/${bookId}?lang=in`,
  `detail/${bookId}?lang=in`,
  `info/${bookId}?lang=in`,
  `drama/${bookId}?lang=in`
];

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
    if (!bookId) throw new Error("Book ID tidak ditemukan");
    
    console.log("Memulai loadDramaDetails untuk bookId:", bookId);
    
    // Tampilkan loading
    showLoading();
    
    const detailData = await tryEndpoints(ENDPOINTS);
    let drama = null;

    if (!detailData) {
      console.log("Semua endpoint gagal, mencoba fallback...");
      const fallbackRes = await fetch(`${BASE_URL}/foryou/1?lang=in`);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        console.log("Fallback data:", fallbackData);
        let dramas = fallbackData.data?.list || fallbackData.data || [];
        drama = dramas.find(d => d.bookId === bookId || d.id === bookId || d._id === bookId);
        if (drama) {
          console.log("Drama ditemukan dari fallback");
          displayDramaDetails(drama, []);
          return;
        }
      }
      throw new Error("Tidak dapat menemukan data drama.");
    }

    // Ekstrak data drama
    console.log("Detail data received:", detailData);
    
    if (detailData.data) {
      if (Array.isArray(detailData.data)) {
        drama = detailData.data[0];
      } else {
        drama = detailData.data;
      }
    } else if (detailData.list && Array.isArray(detailData.list)) {
      drama = detailData.list[0];
    } else if (Array.isArray(detailData)) {
      drama = detailData[0];
    } else {
      drama = detailData;
    }

    if (!drama) {
      console.error("Drama object tidak valid:", drama);
      throw new Error("Format data tidak dikenali");
    }

    console.log("Drama ditemukan:", drama);
    
    // Load episodes
    await loadEpisodes(drama);

  } catch (error) {
    console.error("Error loading drama details:", error);
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
    
    // Ambil chapters
    let chapters = [];
    const chapterEndpoints = [
      `chapters/${bookId}?lang=in`, 
      `episodes/${bookId}?lang=in`,
      `book/${bookId}/chapters?lang=in`,
      `drama/${bookId}/episodes?lang=in`
    ];
    
    for (const endpoint of chapterEndpoints) {
      try {
        console.log(`Mencoba endpoint episodes: ${endpoint}`);
        const res = await fetch(`${BASE_URL}/${endpoint}`);
        if (res.ok) {
          const cData = await res.json();
          console.log(`Data chapters dari ${endpoint}:`, cData);
          
          // Coba berbagai format data
          if (Array.isArray(cData.data)) {
            chapters = cData.data;
          } else if (Array.isArray(cData.data?.list)) {
            chapters = cData.data.list;
          } else if (Array.isArray(cData.list)) {
            chapters = cData.list;
          } else if (Array.isArray(cData)) {
            chapters = cData;
          } else if (cData.data && Array.isArray(cData.data.chapters)) {
            chapters = cData.data.chapters;
          }
          
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
  const num = chapter.chapterIndex || chapter.index || chapter.episodeIndex || chapter.episode || chapter.chapter || 1;
  return parseInt(num) || 1;
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
        <h3>⚠️ Gagal memuat drama</h3>
        <p>${message}</p>
        <button onclick="window.location.href='index.html'" 
                style="background:#e50914;color:white;border:none;padding:12px 25px;border-radius:5px;margin-top:20px;cursor:pointer;">
          🔍 Cari Drama
        </button>
      </div>
    `;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded, bookId:", bookId);
  
  if (bookId) {
    loadDramaDetails();
  } else {
    showError("ID Drama tidak ditemukan. Pastikan Anda mengakses dari halaman pencarian.");
  }
});