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

  const formatted = parseLyrics(song);

  document.getElementById("modalLyrics").innerHTML = formatted;
  document.getElementById("modalLyrics").style.fontSize = modalFontSize + "px";
  document.getElementById("songModal").style.display = "block";
  document.body.classList.add("modal-open");
  document.body.style.overflow = "hidden";

  updateModalFavIcon();
}

/* ===== LYRICS PARSER ===== */

/**
 * Detect if a section text represents a chorus/refrain label.
 * Returns the label text to strip, or null.
 */
function detectChorusLabel(text) {
  // English: Chorus, Refrain, CHORUS
  const engMatch = text.match(/^(Chorus\s*:?|Refrain\s*:?\s*\w*|CHORUS\s*:?)\s*/i);
  if (engMatch) return engMatch[0];
  // Telugu: పల్లవి :, పల్లవి:
  const telMatch = text.match(/^(పల్లవి\s*:?\s*)/);
  if (telMatch) return telMatch[0];
  return null;
}

/**
 * Detect if a section starts with a numbered verse prefix like "1. ", "2. "
 * Returns the number, or null.
 */
function detectVerseNumber(text) {
  const match = text.match(/^(\d+)\.\s/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Style a single line of lyrics text with markers.
 */
function styleLine(line) {
  let text = line;
  // Style #అ.ప. marker with distinct color
  text = text.replace(/#అ\.ప\.\s*:?\s*/g, '<span class="pallavi-marker">#అ.ప. : </span>');
  // Style ||number|| as repeat count (×N)
  text = text.replace(/\|\|(\d+)\|\|/g, '<span class="repeat-ref">×$1</span>');
  // Style ||word|| references as repeat markers
  text = text.replace(/\|\|([^|]+)\|\|/g, '<span class="repeat-ref"> $1</span>');
  // Style inline repeat indicators like (2), (3), -2, -3 at end of line or standalone
  text = text.replace(/\((\d+)\)/g, '<span class="repeat-count">×$1</span>');
  return `<p>${text}</p>`;
}

/**
 * Main lyrics parser — transforms raw lyrics string into styled HTML.
 */
function parseLyrics(song) {
  const isEnglish = song.language === "English";

  // Normalize line endings
  const normalized = song.lyrics.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split by ~ into raw sections
  const rawSections = normalized.split("~").map(s => s.trim()).filter(s => s);

  // Build structured sections with type info
  let sections = [];
  let verseCounter = 0;

  rawSections.forEach((sectionText, sectionIndex) => {
    const lines = sectionText.split("\n").filter(l => l.trim()).map(l => l.trim());
    if (lines.length === 0) return;

    // Determine section type
    let type = "verse"; // default
    let label = "";
    let stripFirstLinePrefix = null;

    // Rule 1: First section is always pallavi/chorus
    if (sectionIndex === 0) {
      type = "pallavi";
    }

    // Rule 2: Contains #అ.ప. → pallavi
    if (lines.some(l => l.includes("#అ.ప."))) {
      type = "pallavi";
    }

    // Rule 3: Starts with Chorus/Refrain label (English songs)
    const chorusLabel = detectChorusLabel(lines[0]);
    if (chorusLabel) {
      type = "pallavi";
      // Strip the label from the first line since CSS ::before handles it
      stripFirstLinePrefix = chorusLabel;
    }

    // Rule 4: Numbered verse prefix like "1. ", "2. "
    const verseNum = detectVerseNumber(lines[0]);
    if (verseNum && sectionIndex > 0 && !chorusLabel) {
      type = "verse";
      label = `Verse ${verseNum}`;
    }

    // Auto-increment verse counter for unlabeled verses
    if (type === "verse") {
      if (!label) {
        verseCounter++;
        label = `Verse ${verseCounter}`;
      } else {
        // Sync counter with explicit number
        const num = parseInt(label.replace("Verse ", ""));
        if (num > verseCounter) verseCounter = num;
      }
    }

    // Process lines — strip chorus label from first line if needed
    let processedLines = [...lines];
    if (stripFirstLinePrefix) {
      processedLines[0] = processedLines[0].substring(stripFirstLinePrefix.length).trim();
      // If stripping made the line empty, remove it
      if (!processedLines[0]) processedLines.shift();
    }

    // For sections with ||word|| sub-boundaries, split into sub-groups
    if (rawSections.length === 1) {
      // No ~ separator at all — use ||word|| grouping
      let subGroups = [];
      let currentGroup = [];
      let isFirstGroup = true;

      processedLines.forEach(line => {
        // Start a new group when a numbered verse line appears
        const lineVerseNum = detectVerseNumber(line);
        if (lineVerseNum && currentGroup.length > 0) {
          subGroups.push({ lines: [...currentGroup], type: isFirstGroup ? "pallavi" : "verse" });
          isFirstGroup = false;
          currentGroup = [];
        }

        currentGroup.push(line);

        // End the group when ||word|| appears at end of line
        if (/\|\|[^|]+\|\|\s*$/.test(line)) {
          subGroups.push({ lines: [...currentGroup], type: isFirstGroup ? "pallavi" : "verse" });
          isFirstGroup = false;
          currentGroup = [];
        }
      });
      if (currentGroup.length > 0) {
        subGroups.push({ lines: currentGroup, type: isFirstGroup ? "pallavi" : "verse" });
      }

      // If no sub-grouping happened (only 1 group), show as single pallavi
      if (subGroups.length <= 1) {
        sections.push({ type: "pallavi", lines: processedLines, label: "" });
      } else {
        let subVerseCounter = 0;
        subGroups.forEach(sg => {
          if (sg.type === "verse") {
            subVerseCounter++;
            sections.push({ type: "verse", lines: sg.lines, label: `Verse ${subVerseCounter}` });
          } else {
            sections.push({ type: "pallavi", lines: sg.lines, label: "" });
          }
        });
      }
      return; // Already handled — skip adding to sections below
    }

    sections.push({ type, lines: processedLines, label });
  });

  // Render sections to HTML
  const html = sections.map(section => {
    const linesHtml = section.lines.map(styleLine).join("");
    if (!linesHtml) return "";

    if (section.type === "pallavi") {
      const cls = isEnglish ? "pallavi pallavi-en" : "pallavi";
      return `<div class="${cls}">${linesHtml}</div>`;
    } else {
      return `<div class="stanza"><div class="stanza-num">${section.label}</div>${linesHtml}</div>`;
    }
  }).filter(s => s).join("");

  return html;
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