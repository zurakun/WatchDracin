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

// Fungsi untuk mengambil daftar episode
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
    return chapters;
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return [];
  }
}

// Fungsi untuk setup navigasi
function setupNavigation() {
  // Cari index episode saat ini
  currentEpisodeIndex = chapters.findIndex((ch, index) => {
    const chapterIdx = ch.chapterIndex ?? (index + 1);
    return chapterIdx == episode;
  });
  
  if (currentEpisodeIndex === -1 && episode) {
    currentEpisodeIndex = parseInt(episode) - 1;
  }
  
  if (chapters.length > 0 && currentEpisodeIndex >= 0 && currentEpisodeIndex < chapters.length) {
    const currentChapter = chapters[currentEpisodeIndex];
    episodeTitle.textContent = currentChapter.title || currentChapter.chapterTitle || `Episode ${currentEpisodeIndex + 1}`;
    episodeNumber.textContent = `Episode ${currentEpisodeIndex + 1} dari ${totalEpisodes}`;
    
    // Setup tombol previous
    if (currentEpisodeIndex > 0) {
      prevBtn.disabled = false;
      prevBtn.onclick = goToPreviousEpisode;
    } else {
      prevBtn.disabled = true;
      prevBtn.onclick = null;
    }
    
    // Setup tombol next
    if (currentEpisodeIndex < chapters.length - 1) {
      nextBtn.disabled = false;
      nextBtn.onclick = goToNextEpisode;
    } else {
      nextBtn.disabled = true;
      nextBtn.onclick = null;
    }
    
    // Setup link kembali
    backToList.href = `detail.html?bookId=${bookId}`;
    
    // Tampilkan navigasi
    episodeNav.style.display = 'block';
    loadingDiv.style.display = 'none';
  } else {
    loadingDiv.innerHTML = chapters.length === 0 
      ? "Tidak ada episode tersedia" 
      : `Episode tidak ditemukan. Total: ${totalEpisodes}`;
  }
}

// Fungsi untuk pindah ke episode sebelumnya
function goToPreviousEpisode() {
  if (currentEpisodeIndex > 0) {
    const prevIndex = currentEpisodeIndex - 1;
    const prevChapter = chapters[prevIndex];
    const prevEpisodeNum = prevChapter.chapterIndex ?? (prevIndex + 1);
    window.location.href = `watch.html?bookId=${bookId}&episode=${prevEpisodeNum}`;
  }
}

// Fungsi untuk pindah ke episode berikutnya
function goToNextEpisode() {
  if (currentEpisodeIndex < chapters.length - 1) {
    const nextIndex = currentEpisodeIndex + 1;
    const nextChapter = chapters[nextIndex];
    const nextEpisodeNum = nextChapter.chapterIndex ?? (nextIndex + 1);
    window.location.href = `watch.html?bookId=${bookId}&episode=${nextEpisodeNum}`;
  }
}

// Fungsi untuk auto next episode (dipanggil saat video selesai)
function autoNextEpisode() {
  if (currentEpisodeIndex < chapters.length - 1) {
    // Tampilkan notifikasi
    showNotification("Memutar episode berikutnya...");
    
    // Tunggu sebentar lalu pindah ke next episode
    setTimeout(() => {
      goToNextEpisode();
    }, 2000); // Delay 2 detik untuk memberi waktu lihat notifikasi
  } else {
    // Jika ini episode terakhir, tampilkan notifikasi
    showNotification("Ini adalah episode terakhir");
  }
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message) {
  // Hapus notifikasi sebelumnya jika ada
  const existingNotification = document.querySelector('.auto-next-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Buat elemen notifikasi
  const notification = document.createElement('div');
  notification.className = 'auto-next-notification';
  notification.innerHTML = `
    <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                background: rgba(229, 9, 20, 0.9); color: white; padding: 10px 20px; 
                border-radius: 5px; z-index: 1000; font-size: 14px; font-weight: bold;">
      ${message}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Hapus notifikasi setelah 3 detik
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Fungsi utama untuk load video dan navigasi
async function initPlayer() {
  if (!bookId || episode === null) {
    statusText.textContent = "Video tidak ditemukan.";
    loadingDiv.style.display = 'none';
    return;
  }
  
  try {
    // Ambil daftar episode terlebih dahulu
    await fetchChapters();
    
    // Setup navigasi
    setupNavigation();
    
    // Load video
    await loadVideo();
    
  } catch (error) {
    console.error("Init error:", error);
    statusText.textContent = "Gagal memuat video.";
    loadingDiv.style.display = 'none';
  }
}

// Fungsi untuk load video
async function loadVideo() {
  statusText.textContent = "Memuat video...";
  statusText.style.display = "block";
  
  try {
    const response = await fetch(`${BASE_URL}/watch/player?lang=in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bookId: bookId,
        chapterIndex: Number(episode),
        lang: "in"
      })
    });
    
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
      throw "URL video tidak ditemukan";
    }
    
    // Deteksi tipe video
    if (url.includes('.m3u8') || url.includes('m3u8?')) {
      // HLS stream
      if (typeof Hls === 'undefined') {
        loadScript('https://cdn.jsdelivr.net/npm/hls.js@latest', () => {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(e => console.log("Autoplay blocked:", e));
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.load();
          }
        });
      }
    } else {
      // Direct video
      video.src = url;
      video.load();
    }
    
    // Setup event listeners untuk video
    setupVideoEvents();
    
  } catch (error) {
    console.error("Load video error:", error);
    statusText.textContent = "Gagal memuat video.";
    throw error;
  }
}

// Fungsi untuk setup semua event listener video
function setupVideoEvents() {
  // Hapus event listeners sebelumnya untuk menghindari duplikasi
  video.onloadeddata = null;
  video.onerror = null;
  video.onwaiting = null;
  video.onplaying = null;
  video.onended = null;
  
  // Event listener untuk video loaded
  video.addEventListener('loadeddata', () => {
    statusText.textContent = "▶️ Siap diputar";
    
    // Coba autoplay
    video.play().catch(e => {
      console.log("Autoplay blocked, waiting for user interaction");
      statusText.textContent = "Klik video untuk mulai memutar";
    });
    
    setTimeout(() => {
      statusText.style.display = "none";
    }, 2000);
  });
  
  // Event listener untuk video error
  video.addEventListener('error', (e) => {
    console.error("Video error:", e);
    statusText.textContent = "Error memutar video. Format tidak didukung.";
  });
  
  // Event listener untuk buffering
  video.addEventListener('waiting', () => {
    statusText.textContent = "Buffering...";
    statusText.style.display = "block";
  });
  
  // Event listener untuk video playing
  video.addEventListener('playing', () => {
    statusText.style.display = "none";
  });
  
  // EVENT LISTENER UNTUK AUTO NEXT - SELALU AKTIF!
  video.addEventListener('ended', () => {
    console.log("Video ended, auto playing next episode...");
    autoNextEpisode();
  });
  
  // Tambahkan juga timeupdate untuk menampilkan waktu
  video.addEventListener('timeupdate', () => {
    // Simpan waktu terakhir yang ditonton
    if (video.currentTime > 10) {
      localStorage.setItem(`progress_${bookId}_${episode}`, video.currentTime);
    }
  });
}

// Fungsi untuk resume dari waktu terakhir
function resumeFromLastTime() {
  const savedTime = localStorage.getItem(`progress_${bookId}_${episode}`);
  if (savedTime && video.duration > 0) {
    const time = parseFloat(savedTime);
    if (time < video.duration * 0.9) {
      video.currentTime = time;
      showNotification(`Dilanjutkan dari ${formatTime(time)}`);
    }
  }
}

// Helper function untuk format waktu
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Fungsi untuk load script secara dinamis
function loadScript(src, callback) {
  const script = document.createElement('script');
  script.src = src;
  script.onload = callback;
  document.head.appendChild(script);
}

// Helper functions
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

// Tambahkan keyboard shortcut untuk navigasi episode
document.addEventListener('keydown', (e) => {
  // Left arrow key untuk previous episode
  if (e.key === 'ArrowLeft' && !prevBtn.disabled) {
    goToPreviousEpisode();
  }
  // Right arrow key untuk next episode
  if (e.key === 'ArrowRight' && !nextBtn.disabled) {
    goToNextEpisode();
  }
  // Space untuk pause/play
  if (e.key === ' ' && document.activeElement !== video) {
    e.preventDefault();
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }
});

// Jalankan player ketika halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  initPlayer();
});