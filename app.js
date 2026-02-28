let songs = [];
let filteredSongs = [];
let currentLanguage = "all";
let currentView = "home"; // "home" or "favorites"
let currentModalSong = null;
let modalFontSize = 18;

/* ===== INIT ===== */
// Load saved theme
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
  document.querySelector('.theme-toggle').textContent = '☀️';
}

let splashDone = false;
let dataDone = false;

function dismissSplash() {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 600);
  }
}

function tryDismissSplash() {
  if (splashDone && dataDone) dismissSplash();
}

// Minimum splash display time (1.8s for animations to play)
setTimeout(() => { splashDone = true; tryDismissSplash(); }, 1800);

fetch("songs.json")
  .then(res => res.json())
  .then(data => {
    songs = data;
    filteredSongs = songs;
    renderSongs();
    renderAlphabet();
    updateSongCount(songs.length);
    dataDone = true;
    tryDismissSplash();
  });

/* ===== SEARCH ===== */
document.getElementById("searchInput").addEventListener("input", e => {
  const value = e.target.value.toLowerCase();

  filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(value) ||
    song.number.toString().includes(value) ||
    song.lyrics.toLowerCase().includes(value)
  );

  applyLanguageFilter();
});

/* ===== LANGUAGE FILTER ===== */
function setFilter(type, btn) {
  currentLanguage = type;

  document.querySelectorAll(".filters button")
    .forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const searchValue = document.getElementById("searchInput").value.toLowerCase();

  if (searchValue) {
    filteredSongs = songs.filter(song =>
      song.title.toLowerCase().includes(searchValue) ||
      song.number.toString().includes(searchValue) ||
      song.lyrics.toLowerCase().includes(searchValue)
    );
  } else {
    filteredSongs = songs;
  }

  if (type !== "all") {
    filteredSongs = filteredSongs.filter(song => song.language === type);
  }

  renderSongs(filteredSongs);
  renderAlphabet();
  updateSongCount(filteredSongs.length);
}

function applyLanguageFilter() {
  let temp = filteredSongs;

  if (currentLanguage !== "all") {
    temp = filteredSongs.filter(song => song.language === currentLanguage);
  }

  renderSongs(temp);
  updateSongCount(temp.length);
}

/* ===== RENDER SONGS ===== */
function renderSongs(list = filteredSongs) {
  const container = document.getElementById("songList");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${currentView === 'favorites' ? '💔' : '🔍'}</div>
        <h3>${currentView === 'favorites' ? 'No Favorite Songs' : 'No Songs Found'}</h3>
        <p>${currentView === 'favorites' ? 'Click ♡ to add favorite songs' : 'Try searching with different keywords'}</p>
      </div>`;
    return;
  }

  list.forEach(song => {
    const card = document.createElement("div");
    card.className = "song-card";
    card.innerHTML = `
      <div class="song-number">${song.number}</div>
      <div class="song-info">
        <div class="song-title">${song.title}</div>
        <div class="song-lang">${song.language === 'Telugu' ? 'తెలుగు' : 'English'}</div>
      </div>
      <span class="song-arrow">›</span>
    `;
    card.onclick = () => openModal(song);
    container.appendChild(card);
  });
}

/* ===== SONG COUNT ===== */
function updateSongCount(count) {
  const el = document.getElementById("songCount");
  if (currentView === 'favorites') {
    el.textContent = `❤️ ${count} Favorite Songs`;
  } else {
    el.textContent = `🎵 ${count} Songs`;
  }
}

/* ===== MODAL ===== */
function openModal(song) {
  currentModalSong = song;
  modalFontSize = parseInt(localStorage.getItem("lyricsFontSize")) || 18;

  document.getElementById("modalTitle").innerText = `${song.number}. ${song.title}`;

  // Normalize line endings
  const normalized = song.lyrics.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Smart stanza grouping: lines ending with ||word|| mark end of a charanam
  const allLines = normalized.split("\n").filter(l => l.trim());
  let groups = [];
  let currentGroup = [];

  allLines.forEach(line => {
    currentGroup.push(line.trim());
    // If line ends with ||something||, this group is complete
    if (/\|\|[^|]+\|\|\s*$/.test(line.trim())) {
      groups.push([...currentGroup]);
      currentGroup = [];
    }
  });
  // Any remaining lines form a group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Fallback: if only 1 group (no ||word|| markers found), split every 4 lines
  if (groups.length === 1 && allLines.length > 4) {
    groups = [];
    for (let i = 0; i < allLines.length; i += 4) {
      groups.push(allLines.slice(i, i + 4).map(l => l.trim()));
    }
  }

  const isEnglish = song.language === "English";
  let verseNum = 0;
  const formatted = groups.map((group, index) => {
    // First group is always pallavi/chorus; groups containing #అ.ప. are also pallavi
    const isPallavi = index === 0 || group.some(l => l.includes("#అ.ప."));

    if (!isPallavi) verseNum++;

    const linesHtml = group.map(line => {
      let text = line;
      // Style #అ.ప. marker with distinct color
      text = text.replace(/#అ\.ప\.\s*:?\s*/g, '<span class="pallavi-marker">#అ.ప. : </span>');
      // Style ||word|| references as repeat markers
      text = text.replace(/\|\|(\d+)\|\|/g, '<span class="repeat-ref">×$1</span>');
      text = text.replace(/\|\|([^|]+)\|\|/g, '<span class="repeat-ref"> $1</span>');
      return `<p>${text}</p>`;
    }).join("");

    if (!linesHtml) return "";

    if (isPallavi) {
      const pallaviClass = isEnglish ? 'pallavi pallavi-en' : 'pallavi';
      return `<div class="${pallaviClass}">${linesHtml}</div>`;
    } else {
      const label = `Verse ${verseNum}`;
      return `<div class="stanza"><div class="stanza-num">${label}</div>${linesHtml}</div>`;
    }
  }).filter(s => s).join("");

  document.getElementById("modalLyrics").innerHTML = formatted;
  document.getElementById("modalLyrics").style.fontSize = modalFontSize + "px";
  document.getElementById("songModal").style.display = "block";
  document.body.classList.add("modal-open");
  document.body.style.overflow = "hidden";

  updateModalFavIcon();
}

function closeModal() {
  document.getElementById("songModal").style.display = "none";
  document.body.classList.remove("modal-open");
  document.body.style.overflow = "";
  currentModalSong = null;
}

function changeFontModal(size) {
  modalFontSize += size;
  modalFontSize = Math.max(12, Math.min(32, modalFontSize));
  document.getElementById("modalLyrics").style.fontSize = modalFontSize + "px";
  localStorage.setItem("lyricsFontSize", modalFontSize);
}

function toggleFavModal() {
  if (!currentModalSong) return;
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  if (favorites.includes(currentModalSong.number)) {
    favorites = favorites.filter(n => n !== currentModalSong.number);
  } else {
    favorites.push(currentModalSong.number);
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  updateModalFavIcon();
}

function updateModalFavIcon() {
  const btn = document.getElementById("modalFavBtn");
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  if (currentModalSong && favorites.includes(currentModalSong.number)) {
    btn.textContent = "❤️";
    btn.classList.add("active");
  } else {
    btn.textContent = "♡";
    btn.classList.remove("active");
  }
}

/* ===== ALPHABET FILTER ===== */
function renderAlphabet() {
  const container = document.getElementById("alphabetContainer");
  if (!container) return;
  container.innerHTML = "";

  const englishLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const teluguLetters = [
    "అ", "ఆ", "ఇ", "ఈ", "ఉ", "ఊ", "ఋ", "ఎ", "ఏ", "ఐ",
    "ఒ", "ఓ", "క", "ఖ", "గ", "ఘ", "చ", "జ", "ట", "డ",
    "త", "ద", "న", "ప", "బ", "మ", "య", "ర", "ల", "వ",
    "శ", "స", "హ"
  ];

  let lettersToRender = [];

  if (currentLanguage === "English") {
    lettersToRender = englishLetters;
  } else if (currentLanguage === "Telugu") {
    lettersToRender = teluguLetters;
  } else {
    lettersToRender = [...teluguLetters, ...englishLetters];
  }

  lettersToRender.forEach(letter => {
    const btn = document.createElement("button");
    btn.innerText = letter;

    btn.onclick = () => {
      let list = songs.filter(song =>
        song.title.trim().startsWith(letter)
      );

      if (currentLanguage !== "all") {
        list = list.filter(song => song.language === currentLanguage);
      }

      renderSongs(list);
      updateSongCount(list.length);
    };

    container.appendChild(btn);
  });
}

/* ===== THEME ===== */
function toggleTheme() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.querySelector('.theme-toggle').textContent = isDark ? '☀️' : '🌙';
}

/* ===== BOTTOM NAV: HOME & FAVORITES ===== */
function showHome() {
  currentView = "home";
  updateNavActive(0);
  filteredSongs = songs;
  currentLanguage = "all";

  document.querySelectorAll(".filters button").forEach((b, i) => {
    b.classList.toggle("active", i === 0);
  });
  document.getElementById("searchInput").value = "";

  renderSongs();
  renderAlphabet();
  updateSongCount(songs.length);
  document.getElementById("alphabetContainer").style.display = "flex";
}

function showFavorites() {
  currentView = "favorites";
  updateNavActive(1);
  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  const favSongs = songs.filter(s => favorites.includes(s.number));
  renderSongs(favSongs);
  updateSongCount(favSongs.length);
  document.getElementById("alphabetContainer").style.display = "none";
}

function updateNavActive(index) {
  document.querySelectorAll(".nav-item").forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });
}

// Modal closes only via Back button — no swipe or backdrop dismiss