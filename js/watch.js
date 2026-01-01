const BASE_URL = "https://restxdb.onrender.com/api";

const params = new URLSearchParams(window.location.search);
const bookId = params.get("bookId");
const episode = params.get("episode");

const video = document.getElementById("video");
const statusText = document.getElementById("status");
const episodeNav = document.getElementById("episode-navigation");
const loadingDiv = document.getElementById("loading");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const episodeTitle = document.getElementById("episode-title");
const episodeNumber = document.getElementById("episode-number");
const backToList = document.getElementById("back-to-list");

// Data untuk navigasi
let chapters = [];
let currentEpisodeIndex = -1;
let totalEpisodes = 0;

// ====== PERBAIKAN 1: Fungsi helper untuk konsistensi index ======
/**
 * Normalisasi episode index (0-based untuk array)
 * @param {any} episodeParam - Episode dari URL (?episode=)
 * @returns {number} - Index 0-based untuk array chapters
 */
function getEpisodeIndex(episodeParam) {
  // Pastikan episode dari URL adalah 1-based untuk user
  const episodeNumber = parseInt(episodeParam) || 1;
  // Return index 0-based untuk array
  return Math.max(0, episodeNumber - 1);
}

/**
 * Dapatkan nomor episode untuk display (1-based untuk UI)
 * @param {object} chapter - Chapter object
 * @param {number} arrayIndex - Index 0-based di array
 * @returns {number} - Nomor episode 1-based untuk UI
 */
function getDisplayEpisodeNumber(chapter, arrayIndex) {
  // Prioritas: chapter.chapterIndex jika valid, jika tidak arrayIndex + 1
  if (chapter && chapter.chapterIndex != null) {
    const idx = parseInt(chapter.chapterIndex);
    // Cek jika chapterIndex 0-based (umumnya API 0-based)
    if (idx >= 0) {
      // Biasanya chapterIndex 0-based untuk episode 1
      return idx + 1;
    }
  }
  return arrayIndex + 1;
}

// ====== PERBAIKAN 2: Bersihkan UI yang tidak perlu ======
function cleanupUnusedUI() {
  // Hapus elemen dengan background merah yang tidak berguna
  const unwantedElements = document.querySelectorAll(
    '[style*="background: red"]',
    '[style*="background-color: red"]',
    '.red-circle',
    '.episode-indicator:empty'
  );
  
  unwantedElements.forEach(el => {
    // Cek jika elemen tidak memiliki event listener penting
    if (!el.onclick && el.children.length === 0) {
      console.log('Menghapus elemen UI yang tidak berguna:', el);
      el.remove();
    } else if (el.style) {
      // Jika punya fungsi, sembunyikan saja atau nonaktifkan style yang mengganggu
      el.style.display = 'none';
    }
  });
  
  // Pastikan episode info jelas
  const episodeInfo = document.querySelector('.episode-info');
  if (episodeInfo) {
    episodeInfo.style.background = 'transparent';
    episodeInfo.style.borderRadius = '0';
    episodeInfo.style.padding = '0';
    episodeInfo.style.margin = '0';
  }
}

// ====== PERBAIKAN 3: Fungsi untuk mengambil daftar episode ======
async function fetchChapters() {
  try {
    const response = await fetch(`${BASE_URL}/chapters/${bookId}?lang=in`);
    const data = await response.json();
    
    if (Array.isArray(data.data)) {
      chapters = data.data;
    } else if (Array.isArray(data.data?.list)) {
      chapters = data.data.list;
    } else if (data.data && typeof data.data === 'object') {
      const possibleArrayKeys = Object.keys(data.data).filter(key => Array.isArray(data.data[key]));
      if (possibleArrayKeys.length > 0) {
        chapters = data.data[possibleArrayKeys[0]];
      }
    }
    
    totalEpisodes = chapters.length;
    
    // Debug log untuk struktur chapters
    console.log('Chapters loaded:', {
      count: chapters.length,
      firstFew: chapters.slice(0, 3).map((ch, i) => ({
        arrayIndex: i,
        chapterIndex: ch.chapterIndex,
        title: ch.title || ch.chapterTitle,
        episode: ch.episode
      }))
    });
    
    return chapters;
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return [];
  }
}

// ====== PERBAIKAN 4: setupNavigation dengan logika konsisten ======
function setupNavigation() {
  // Cari index episode saat ini dengan konsistensi
  currentEpisodeIndex = getEpisodeIndex(episode);
  
  // Validasi index
  if (currentEpisodeIndex < 0 || currentEpisodeIndex >= chapters.length) {
    currentEpisodeIndex = 0; // Default ke episode 1
    console.warn(`Episode ${episode} tidak valid, menggunakan episode 1`);
  }
  
  if (chapters.length > 0 && currentEpisodeIndex >= 0 && currentEpisodeIndex < chapters.length) {
    const currentChapter = chapters[currentEpisodeIndex];
    
    // Gunakan fungsi helper untuk konsistensi
    const displayEpisodeNum = getDisplayEpisodeNumber(currentChapter, currentEpisodeIndex);
    
    // PERBAIKAN: Hapus kata "Episode" ganda dari judul jika ada
    let titleText = currentChapter.title || currentChapter.chapterTitle || '';
    if (titleText && titleText.includes('Episode')) {
      // Hapus duplikasi "Episode X" jika sudah ada di UI
      titleText = titleText.replace(/Episode\s*\d+/i, '').trim();
      if (titleText === '') {
        titleText = `Episode ${displayEpisodeNum}`;
      } else {
        titleText = `${titleText} (Episode ${displayEpisodeNum})`;
      }
    } else {
      titleText = titleText || `Episode ${displayEpisodeNum}`;
    }
    
    // Update UI dengan konsistensi penuh
    episodeTitle.textContent = titleText;
    episodeNumber.textContent = `Episode ${displayEpisodeNum} dari ${totalEpisodes}`;
    
    // Debug log
    console.log(`Episode Debug:`, {
      urlEpisode: episode,
      arrayIndex: currentEpisodeIndex,
      chapterIndex: currentChapter.chapterIndex,
      displayEpisode: displayEpisodeNum,
      totalEpisodes: totalEpisodes,
      finalTitle: titleText
    });
    
    // Setup tombol previous
    if (currentEpisodeIndex > 0) {
      prevBtn.disabled = false;
      prevBtn.onclick = goToPreviousEpisode;
      prevBtn.title = `Episode ${getDisplayEpisodeNumber(chapters[currentEpisodeIndex - 1], currentEpisodeIndex - 1)}`;
    } else {
      prevBtn.disabled = true;
      prevBtn.onclick = null;
      prevBtn.title = "Tidak ada episode sebelumnya";
    }
    
    // Setup tombol next
    if (currentEpisodeIndex < chapters.length - 1) {
      nextBtn.disabled = false;
      nextBtn.onclick = goToNextEpisode;
      nextBtn.title = `Episode ${getDisplayEpisodeNumber(chapters[currentEpisodeIndex + 1], currentEpisodeIndex + 1)}`;
    } else {
      nextBtn.disabled = true;
      nextBtn.onclick = null;
      nextBtn.title = "Ini episode terakhir";
    }
    
    // Setup link kembali
    backToList.href = `detail.html?bookId=${bookId}`;
    backToList.title = `Kembali ke daftar ${totalEpisodes} episode`;
    
    // Tampilkan navigasi
    episodeNav.style.display = 'block';
    loadingDiv.style.display = 'none';
    
    // PERBAIKAN: Tambah visual feedback untuk episode aktif
    highlightActiveEpisode();
    
  } else {
    loadingDiv.innerHTML = chapters.length === 0 
      ? "Tidak ada episode tersedia" 
      : `Episode tidak ditemukan. Total: ${totalEpisodes}`;
  }
}

// ====== PERBAIKAN 5: Fungsi untuk highlight episode aktif ======
function highlightActiveEpisode() {
  // Hapus highlight sebelumnya
  const activeElements = document.querySelectorAll('.active-episode');
  activeElements.forEach(el => {
    el.classList.remove('active-episode');
  });
  
  // Tambah style untuk episode aktif (bisa dikustomisasi di CSS)
  const episodeInfo = document.querySelector('.episode-info');
  if (episodeInfo) {
    episodeInfo.classList.add('active-episode');
    
    // Tambah style inline minimal jika tidak ada CSS
    if (!document.querySelector('#episode-active-style')) {
      const style = document.createElement('style');
      style.id = 'episode-active-style';
      style.textContent = `
        .active-episode {
          background: linear-gradient(135deg, rgba(229, 9, 20, 0.1), transparent) !important;
          border-left: 3px solid #e50914 !important;
          padding-left: 10px !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// ====== PERBAIKAN 6: Fungsi navigasi dengan konsistensi ======
function goToPreviousEpisode() {
  if (currentEpisodeIndex > 0) {
    const prevIndex = currentEpisodeIndex - 1;
    const prevChapter = chapters[prevIndex];
    const prevEpisodeNum = getDisplayEpisodeNumber(prevChapter, prevIndex);
    
    console.log(`Navigasi ke episode sebelumnya: index ${prevIndex} → episode ${prevEpisodeNum}`);
    
    // Simpan progress sebelum pindah
    saveCurrentProgress();
    
    window.location.href = `watch.html?bookId=${bookId}&episode=${prevEpisodeNum}`;
  }
}

function goToNextEpisode() {
  if (currentEpisodeIndex < chapters.length - 1) {
    const nextIndex = currentEpisodeIndex + 1;
    const nextChapter = chapters[nextIndex];
    const nextEpisodeNum = getDisplayEpisodeNumber(nextChapter, nextIndex);
    
    console.log(`Navigasi ke episode berikutnya: index ${nextIndex} → episode ${nextEpisodeNum}`);
    
    // Simpan progress sebelum pindah
    saveCurrentProgress();
    
    window.location.href = `watch.html?bookId=${bookId}&episode=${nextEpisodeNum}`;
  }
}

// ====== PERBAIKAN 7: Fungsi save progress ======
function saveCurrentProgress() {
  if (video && video.currentTime > 10) {
    const currentEpisodeNum = getDisplayEpisodeNumber(
      chapters[currentEpisodeIndex], 
      currentEpisodeIndex
    );
    localStorage.setItem(`progress_${bookId}_${currentEpisodeNum}`, video.currentTime);
    console.log(`Progress saved: ${bookId} episode ${currentEpisodeNum} at ${video.currentTime}s`);
  }
}

// ====== PERBAIKAN 8: Auto next episode dengan konsistensi ======
function autoNextEpisode() {
  if (currentEpisodeIndex < chapters.length - 1) {
    // Tampilkan notifikasi
    showNotification("Memutar episode berikutnya...");
    
    // Tunggu sebentar lalu pindah ke next episode
    setTimeout(() => {
      const nextIndex = currentEpisodeIndex + 1;
      const nextChapter = chapters[nextIndex];
      const nextEpisodeNum = getDisplayEpisodeNumber(nextChapter, nextIndex);
      
      console.log(`Auto-next: dari episode ${getDisplayEpisodeNumber(chapters[currentEpisodeIndex], currentEpisodeIndex)} ke ${nextEpisodeNum}`);
      
      // Simpan progress
      saveCurrentProgress();
      
      // Redirect ke episode berikutnya
      window.location.href = `watch.html?bookId=${bookId}&episode=${nextEpisodeNum}`;
    }, 2000);
  } else {
    showNotification("🎬 Ini adalah episode terakhir");
  }
}

// ====== PERBAIKAN 9: Fungsi show notification ======
function showNotification(message) {
  const existingNotification = document.querySelector('.auto-next-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = 'auto-next-notification';
  notification.innerHTML = `
    <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                background: rgba(229, 9, 20, 0.9); color: white; padding: 12px 24px; 
                border-radius: 8px; z-index: 1000; font-size: 14px; font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      ${message}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ====== PERBAIKAN 10: Fungsi initPlayer utama ======
async function initPlayer() {
  // Bersihkan UI dulu
  cleanupUnusedUI();
  
  if (!bookId) {
    statusText.textContent = "Drama tidak ditemukan.";
    loadingDiv.style.display = 'none';
    return;
  }
  
  if (!episode) {
    statusText.textContent = "Episode tidak ditentukan.";
    loadingDiv.style.display = 'none';
    return;
  }
  
  try {
    // Tampilkan loading
    loadingDiv.style.display = 'block';
    loadingDiv.textContent = "Memuat informasi episode...";
    
    // Ambil daftar episode terlebih dahulu
    await fetchChapters();
    
    if (chapters.length === 0) {
      loadingDiv.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <p>Tidak ada episode tersedia untuk drama ini.</p>
          <button onclick="window.location.href='detail.html?bookId=${bookId}'" 
                  style="background:#e50914;color:white;border:none;padding:10px 20px;border-radius:5px;margin-top:10px;cursor:pointer;">
            Kembali ke Detail Drama
          </button>
        </div>
      `;
      return;
    }
    
    // Setup navigasi
    setupNavigation();
    
    // Load video
    await loadVideo();
    
    // Resume dari waktu terakhir
    resumeFromLastTime();
    
  } catch (error) {
    console.error("Init error:", error);
    statusText.textContent = "Gagal memuat video atau episode.";
    loadingDiv.style.display = 'none';
    
    // Tampilkan error UI
    const errorHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
        <p>Gagal memuat video. Episode mungkin tidak tersedia.</p>
        <button onclick="window.location.reload()" 
                style="background:#555;color:white;border:none;padding:10px 20px;border-radius:5px;margin:5px;cursor:pointer;">
          Coba Lagi
        </button>
        <button onclick="window.location.href='detail.html?bookId=${bookId}'" 
                style="background:#e50914;color:white;border:none;padding:10px 20px;border-radius:5px;margin:5px;cursor:pointer;">
          Kembali ke Detail
        </button>
      </div>
    `;
    
    if (loadingDiv) {
      loadingDiv.innerHTML = errorHTML;
    }
  }
}

// ====== PERBAIKAN 11: Fungsi load video dengan episode konsisten ======
async function loadVideo() {
  statusText.textContent = "Memuat video...";
  statusText.style.display = "block";
  
  try {
    // Gunakan nomor episode yang konsisten untuk API
    const currentChapter = chapters[currentEpisodeIndex] || {};
    let apiEpisodeNum = currentChapter.chapterIndex;
    
    // Jika chapterIndex tidak ada, gunakan display episode number
    if (apiEpisodeNum == null) {
      apiEpisodeNum = getDisplayEpisodeNumber(currentChapter, currentEpisodeIndex);
    }
    
    console.log(`Loading video for bookId: ${bookId}, chapterIndex: ${apiEpisodeNum}`);
    
    const response = await fetch(`${BASE_URL}/watch/player?lang=in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bookId: bookId,
        chapterIndex: Number(apiEpisodeNum),
        lang: "in"
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const res = await response.json();
    
    let url = null;
    
    // Cek berbagai kemungkinan struktur data
    if (res.data?.url) {
      url = res.data.url;
    } else if (res.data?.playUrl) {
      url = res.data.playUrl;
    } else if (res.data?.videoUrl) {
      url = res.data.videoUrl;
    } else if (res.data?.sources && Array.isArray(res.data.sources) && res.data.sources.length > 0) {
      const firstSource = res.data.sources[0];
      if (firstSource.url) {
        url = firstSource.url;
      }
    } else if (res.url) {
      url = res.url;
    } else if (res.playUrl) {
      url = res.playUrl;
    } else if (res.videoUrl) {
      url = res.videoUrl;
    } else {
      // Cari properti yang mengandung URL
      const allProps = getAllProperties(res);
      const urlProps = allProps.filter(prop => 
        prop.toLowerCase().includes('url') || 
        prop.toLowerCase().includes('video') ||
        prop.toLowerCase().includes('src')
      );
      
      for (const prop of urlProps) {
        const value = getPropertyByPath(res, prop);
        if (value && typeof value === 'string' && value.startsWith('http')) {
          url = value;
          break;
        }
      }
    }
    
    if (!url) {
      throw "URL video tidak ditemukan dalam response API";
    }
    
    console.log(`Video URL found: ${url.substring(0, 100)}...`);
    
    // Deteksi tipe video dan setup player
    if (url.includes('.m3u8') || url.includes('m3u8?')) {
      // HLS stream
      if (typeof Hls === 'undefined') {
        // Load HLS.js jika belum dimuat
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }
      
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });
        
        hls.loadSource(url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS manifest parsed, ready to play");
          video.play().catch(e => {
            console.log("Autoplay blocked:", e);
            statusText.textContent = "Klik video untuk mulai memutar";
          });
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", data);
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("Network error, trying to recover");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("Media error, recovering");
                hls.recoverMediaError();
                break;
              default:
                console.error("Fatal HLS error, cannot recover");
                hls.destroy();
                break;
            }
          }
        });
        
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = url;
        video.load();
        video.play().catch(e => {
          console.log("Autoplay blocked:", e);
          statusText.textContent = "Klik video untuk mulai memutar";
        });
      } else {
        throw "Browser tidak mendukung format video HLS";
      }
    } else {
      // Direct video (MP4, etc)
      video.src = url;
      video.load();
      
      video.play().catch(e => {
        console.log("Autoplay blocked:", e);
        statusText.textContent = "Klik video untuk mulai memutar";
      });
    }
    
    // Setup event listeners untuk video
    setupVideoEvents();
    
  } catch (error) {
    console.error("Load video error:", error);
    statusText.textContent = "Gagal memuat video: " + error;
    throw error;
  }
}

// ====== PERBAIKAN 12: Setup video events ======
function setupVideoEvents() {
  // Hapus event listeners sebelumnya
  const videoClone = video.cloneNode();
  video.parentNode.replaceChild(videoClone, video);
  Object.assign(video, videoClone);
  
  // Event listener untuk video loaded
  video.addEventListener('loadeddata', () => {
    statusText.textContent = "▶️ Video siap diputar";
    statusText.style.color = "#4CAF50";
    
    setTimeout(() => {
      statusText.style.display = "none";
    }, 2000);
  });
  
  // Event listener untuk video error
  video.addEventListener('error', (e) => {
    console.error("Video player error:", e);
    statusText.textContent = "❌ Error memutar video";
    statusText.style.color = "#e50914";
    statusText.style.display = "block";
  });
  
  // Event listener untuk buffering
  video.addEventListener('waiting', () => {
    statusText.textContent = "⏳ Buffering...";
    statusText.style.color = "#FF9800";
    statusText.style.display = "block";
  });
  
  // Event listener untuk video playing
  video.addEventListener('playing', () => {
    statusText.style.display = "none";
    console.log(`Video playing: Episode ${getDisplayEpisodeNumber(chapters[currentEpisodeIndex], currentEpisodeIndex)}`);
  });
  
  // EVENT LISTENER UNTUK AUTO NEXT
  video.addEventListener('ended', () => {
    console.log(`Video ended: Episode ${getDisplayEpisodeNumber(chapters[currentEpisodeIndex], currentEpisodeIndex)}`);
    autoNextEpisode();
  });
  
  // Simpan progress
  video.addEventListener('timeupdate', () => {
    if (video.currentTime > 10 && video.duration > 0) {
      const progressPercent = (video.currentTime / video.duration * 100).toFixed(1);
      const currentEpisodeNum = getDisplayEpisodeNumber(chapters[currentEpisodeIndex], currentEpisodeIndex);
      localStorage.setItem(`progress_${bookId}_${currentEpisodeNum}`, video.currentTime);
      localStorage.setItem(`progress_${bookId}_${currentEpisodeNum}_percent`, progressPercent);
      
      // Update title dengan progress (opsional)
      if (progressPercent > 10 && progressPercent < 90) {
        document.title = `(${progressPercent}%) ${episodeTitle.textContent} - WatchDracin`;
      }
    }
  });
  
  // Resume play saat tab aktif kembali
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused && video.currentTime > 0) {
      video.play().catch(e => console.log("Resume play blocked:", e));
    }
  });
}

// ====== PERBAIKAN 13: Resume dari waktu terakhir ======
function resumeFromLastTime() {
  if (!video) return;
  
  const currentEpisodeNum = getDisplayEpisodeNumber(chapters[currentEpisodeIndex], currentEpisodeIndex);
  const savedTime = localStorage.getItem(`progress_${bookId}_${currentEpisodeNum}`);
  
  if (savedTime && !isNaN(parseFloat(savedTime))) {
    const time = parseFloat(savedTime);
    
    // Tunggu sampai video bisa diakses
    const checkReady = setInterval(() => {
      if (video.readyState > 0 && video.duration > 0) {
        clearInterval(checkReady);
        
        // Hanya resume jika belum selesai (>90%)
        if (time < video.duration * 0.9) {
          video.currentTime = time;
          
          const savedPercent = localStorage.getItem(`progress_${bookId}_${currentEpisodeNum}_percent`);
          if (savedPercent) {
            console.log(`Resuming from ${savedPercent}% (${time.toFixed(0)}s)`);
            showNotification(`Dilanjutkan dari ${savedPercent}%`);
          }
        }
      }
    }, 100);
    
    // Timeout setelah 5 detik
    setTimeout(() => clearInterval(checkReady), 5000);
  }
}

// ====== HELPER FUNCTIONS (tetap sama) ======
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getAllProperties(obj, prefix = '', result = []) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const path = prefix ? `${prefix}.${key}` : key;
        result.push(path);
        getAllProperties(obj[key], path, result);
      }
    }
  }
  return result;
}

function getPropertyByPath(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// ====== PERBAIKAN 14: Keyboard shortcuts ======
document.addEventListener('keydown', (e) => {
  // Hindari conflict dengan input elements
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  switch(e.key) {
    case 'ArrowLeft':
      if (!prevBtn.disabled) {
        e.preventDefault();
        goToPreviousEpisode();
      }
      break;
      
    case 'ArrowRight':
      if (!nextBtn.disabled) {
        e.preventDefault();
        goToNextEpisode();
      }
      break;
      
    case ' ':
      if (document.activeElement !== video) {
        e.preventDefault();
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      }
      break;
      
    case 'f':
    case 'F':
      // Toggle fullscreen
      e.preventDefault();
      if (!document.fullscreenElement) {
        video.requestFullscreen().catch(err => {
          console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
      break;
      
    case 'm':
    case 'M':
      // Toggle mute
      e.preventDefault();
      video.muted = !video.muted;
      showNotification(video.muted ? "🔇 Muted" : "🔊 Unmuted");
      break;
  }
});

// ====== PERBAIKAN 15: Initialize player ======
document.addEventListener('DOMContentLoaded', () => {
  console.log(`Watch page loaded: bookId=${bookId}, episode=${episode}`);
  
  // Cek requirement dasar
  if (!bookId) {
    alert("Drama tidak ditemukan. Kembali ke halaman pencarian.");
    window.location.href = "index.html";
    return;
  }
  
  // Start player
  initPlayer();
  
  // Tambah style untuk UI yang lebih baik
  if (!document.querySelector('#watch-page-styles')) {
    const style = document.createElement('style');
    style.id = 'watch-page-styles';
    style.textContent = `
      .episode-navigation {
        transition: all 0.3s ease;
      }
      
      .nav-button:not(:disabled):hover {
        background: #ff3333 !important;
        transform: translateY(-1px);
      }
      
      .nav-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .episode-title {
        font-weight: bold;
        font-size: 1.2em;
        margin-bottom: 5px;
      }
      
      .episode-number {
        color: #666;
        font-size: 0.9em;
      }
      
      .back-to-list {
        color: #e50914;
        text-decoration: none;
        font-weight: bold;
      }
      
      .back-to-list:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }
});

// ====== PERBAIKAN 16: Handle browser back/forward ======
window.addEventListener('popstate', () => {
  // Reload page jika URL berubah (untuk update episode)
  const newParams = new URLSearchParams(window.location.search);
  const newBookId = newParams.get("bookId");
  const newEpisode = newParams.get("episode");
  
  if (newBookId !== bookId || newEpisode !== episode) {
    window.location.reload();
  }
});
