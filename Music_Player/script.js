/* ============================================================
   RHYTHMIX v2.0 — Multi-Playlist Music Player
   Features: Upload, Named Playlists, CRUD, Controls,
             Search, Filter, Dark/Light, Keyboard Shortcuts
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // STATE
    // ============================================================
    let state = {
        allTracks: [],          // Master library: [{id, title, artist, genre, duration, fileName}]
        playlists: [],          // Named playlists: [{id, name, trackIds:[]}]
        currentPlaylistId: 'all', // 'all' or a playlist id
        currentTrackId: null,   // currently loaded track id
        isPlaying: false,
        isShuffle: false,
        repeatMode: 'none',     // 'none' | 'all' | 'one'
        volume: 0.7,
    };

    // Blob URLs are session-only (browser security) — rebuilt on upload
    const blobURLs = {};

    // Context menu target
    let contextTrackId = null;

    // Rename modal mode
    let renameMode = null; // 'create' | 'rename'
    let renameTargetId = null;

    // ============================================================
    // DOM REFS
    // ============================================================
    const audio             = document.getElementById('audio-player');
    const playBtn           = document.getElementById('play-btn');
    const playIcon          = document.getElementById('play-icon');
    const prevBtn           = document.getElementById('prev-btn');
    const nextBtn           = document.getElementById('next-btn');
    const shuffleBtn        = document.getElementById('shuffle-btn');
    const repeatBtn         = document.getElementById('repeat-btn');
    const muteBtn           = document.getElementById('mute-btn');
    const volumeIcon        = document.getElementById('volume-icon');
    const volumeSlider      = document.getElementById('volume-slider');
    const volumePct         = document.getElementById('volume-pct');
    const progressFill      = document.getElementById('progress-fill');
    const progressThumb     = document.getElementById('progress-thumb');
    const progressWrapper   = document.getElementById('progress-wrapper');
    const currentTimeEl     = document.getElementById('current-time');
    const totalTimeEl       = document.getElementById('total-time');
    const trackTitle        = document.getElementById('track-title');
    const trackArtist       = document.getElementById('track-artist');
    const albumArt          = document.getElementById('album-art');
    const albumIcon         = document.getElementById('album-icon');
    const genreBadge        = document.getElementById('genre-badge');
    const visualizer        = document.getElementById('visualizer');
    const playlistEl        = document.getElementById('playlist');
    const trackCount        = document.getElementById('track-count');
    const fileInput         = document.getElementById('file-input');
    const uploadBtn         = document.getElementById('upload-btn');
    const searchInput       = document.getElementById('search-input');
    const filterTabs        = document.querySelectorAll('.filter-tab');
    const themeToggle       = document.getElementById('theme-toggle');
    const themeIcon         = document.getElementById('theme-icon');
    const playlistsListEl   = document.getElementById('playlists-list');
    const newPlaylistBtn    = document.getElementById('new-playlist-btn');
    const currentPlTitle    = document.getElementById('current-playlist-title');
    const sidebarOptionsBtn = document.getElementById('sidebar-options-btn');
    const allCountEl        = document.getElementById('all-count');

    // Modals
    const modalOverlay      = document.getElementById('modal-overlay');
    const modalTrackName    = document.getElementById('modal-track-name');
    const modalPlaylistList = document.getElementById('modal-playlist-list');
    const modalClose        = document.getElementById('modal-close');
    const modalNewPlBtn     = document.getElementById('modal-new-playlist-btn');
    const renameOverlay     = document.getElementById('rename-overlay');
    const renameModalTitle  = document.getElementById('rename-modal-title');
    const renameInput       = document.getElementById('rename-input');
    const renameClose       = document.getElementById('rename-close');
    const renameConfirm     = document.getElementById('rename-confirm');

    // Context Menus
    const contextMenu       = document.getElementById('context-menu');
    const ctxAddToPlaylist  = document.getElementById('ctx-add-to-playlist');
    const ctxRemoveFromPl   = document.getElementById('ctx-remove-from-playlist');
    const ctxDeleteTrack    = document.getElementById('ctx-delete-track');
    const plOptionsMenu     = document.getElementById('pl-options-menu');
    const ctxRenamePlaylist = document.getElementById('ctx-rename-playlist');
    const ctxDeletePlaylist = document.getElementById('ctx-delete-playlist');

    // Filter state
    let currentGenreFilter = 'all';

    // Progress drag state
    let isDragging = false;

    // ============================================================
    // INIT — Load from localStorage
    // ============================================================
    function init() {
        const saved = localStorage.getItem('rhythmix-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                state.allTracks  = parsed.allTracks  || [];
                state.playlists  = parsed.playlists  || [];
                state.volume     = parsed.volume     ?? 0.7;
            } catch(e) {}
        }

        const savedTheme = localStorage.getItem('rhythmix-theme') || 'dark';
        setTheme(savedTheme);

        volumeSlider.value = state.volume;
        audio.volume = state.volume;
        updateVolumeIcon(state.volume);
        volumePct.textContent = Math.round(state.volume * 100) + '%';

        renderPlaylistsPanel();
        renderTrackList();
    }

    // ============================================================
    // SAVE STATE
    // ============================================================
    function saveState() {
        localStorage.setItem('rhythmix-state', JSON.stringify({
            allTracks: state.allTracks,
            playlists: state.playlists,
            volume: state.volume,
        }));
    }

    // ============================================================
    // THEME
    // ============================================================
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('rhythmix-theme', theme);
        themeIcon.className = theme === 'dark' ? 'ph ph-moon' : 'ph ph-sun';
    }

    // ============================================================
    // FILE UPLOAD
    // ============================================================
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            if (!file.type.startsWith('audio/')) return;

            const id = 'track-' + Date.now() + '-' + Math.random().toString(36).substr(2,6);
            const blobURL = URL.createObjectURL(file);
            blobURLs[id] = blobURL;

            // Parse "Artist - Title" from filename
            const nameNoExt = file.name.replace(/\.[^.]+$/, '');
            let title = nameNoExt;
            let artist = 'Unknown Artist';
            if (nameNoExt.includes(' - ')) {
                const parts = nameNoExt.split(' - ');
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }

            const track = { id, title, artist, genre: 'all', duration: 0, fileName: file.name };
            state.allTracks.push(track);

            // Get duration async
            const tmp = new Audio(blobURL);
            tmp.addEventListener('loadedmetadata', () => {
                const t = state.allTracks.find(t => t.id === id);
                if (t) { t.duration = tmp.duration; saveState(); renderTrackList(); }
            });
        });

        saveState();
        renderPlaylistsPanel();
        renderTrackList();

        // Auto-load first track if nothing loaded
        if (!state.currentTrackId && state.allTracks.length > 0) {
            loadTrack(state.allTracks[0].id);
        }

        fileInput.value = '';
    });

    // ============================================================
    // RENDER: LEFT PANEL — Playlists
    // ============================================================
    function renderPlaylistsPanel() {
        allCountEl.textContent = state.allTracks.length;

        // Set active on "All Tracks"
        const allEntry = document.getElementById('pl-entry-all');
        allEntry.classList.toggle('active', state.currentPlaylistId === 'all');
        allEntry.onclick = () => switchPlaylist('all');

        // Remove old named playlist entries (keep pl-entry-all)
        const existing = playlistsListEl.querySelectorAll('.pl-entry:not(#pl-entry-all)');
        existing.forEach(el => el.remove());

        state.playlists.forEach(pl => {
            const li = document.createElement('li');
            li.className = `pl-entry ${state.currentPlaylistId === pl.id ? 'active' : ''}`;
            li.dataset.id = pl.id;
            li.innerHTML = `
                <i class="ph ph-playlist"></i>
                <span class="pl-entry-name">${escapeHTML(pl.name)}</span>
                <span class="pl-entry-count">${pl.trackIds.length}</span>
            `;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.pl-options-trigger')) return;
                switchPlaylist(pl.id);
            });
            // Right-click for options
            li.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showPlOptionsMenu(pl.id, e.clientX, e.clientY);
            });
            playlistsListEl.appendChild(li);
        });
    }

    // ============================================================
    // SWITCH PLAYLIST
    // ============================================================
    function switchPlaylist(id) {
        state.currentPlaylistId = id;

        if (id === 'all') {
            currentPlTitle.textContent = 'All Tracks';
            sidebarOptionsBtn.style.display = 'none';
        } else {
            const pl = state.playlists.find(p => p.id === id);
            currentPlTitle.textContent = pl ? pl.name : 'Playlist';
            sidebarOptionsBtn.style.display = 'flex';
        }

        renderPlaylistsPanel();
        renderTrackList();
    }

    // ============================================================
    // RENDER: MIDDLE PANEL — Track List
    // ============================================================
    function renderTrackList() {
        const query = searchInput.value.toLowerCase().trim();

        // Get source tracks for current view
        let sourceTracks = [];
        if (state.currentPlaylistId === 'all') {
            sourceTracks = [...state.allTracks];
        } else {
            const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
            if (pl) {
                sourceTracks = pl.trackIds
                    .map(id => state.allTracks.find(t => t.id === id))
                    .filter(Boolean);
            }
        }

        // Apply genre filter
        let filtered = sourceTracks.filter(track => {
            const matchGenre  = currentGenreFilter === 'all' || track.genre === currentGenreFilter;
            const matchSearch = !query || track.title.toLowerCase().includes(query) || track.artist.toLowerCase().includes(query);
            return matchGenre && matchSearch;
        });

        playlistEl.innerHTML = '';

        if (filtered.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'playlist-empty';
            empty.innerHTML = `
                <i class="ph ph-music-note"></i>
                <p>${state.allTracks.length === 0 ? 'No tracks yet.' : 'No results found.'}</p>
                <p>${state.allTracks.length === 0 ? 'Upload music to get started!' : 'Try adjusting your search or filter.'}</p>
            `;
            playlistEl.appendChild(empty);
        } else {
            filtered.forEach((track, idx) => {
                const isActive = track.id === state.currentTrackId;
                const li = document.createElement('li');
                li.className = `playlist-item ${isActive ? 'active' : ''}`;
                li.dataset.id = track.id;
                li.innerHTML = `
                    <span class="track-num">${isActive ? '<i class="ph ph-waveform"></i>' : idx + 1}</span>
                    <div class="pl-track-info">
                        <div class="pl-title">${escapeHTML(track.title)}</div>
                        <div class="pl-artist">${escapeHTML(track.artist)}</div>
                    </div>
                    <span class="pl-duration">${formatTime(track.duration)}</span>
                    <button class="pl-more" data-id="${track.id}" aria-label="More options" title="Options">
                        <i class="ph ph-dots-three-vertical"></i>
                    </button>
                `;

                li.addEventListener('click', (e) => {
                    if (e.target.closest('.pl-more')) return;
                    loadTrack(track.id);
                    playAudio();
                });

                li.querySelector('.pl-more').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    showTrackContextMenu(track.id, rect.right + 4, rect.top);
                });

                li.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showTrackContextMenu(track.id, e.clientX, e.clientY);
                });

                playlistEl.appendChild(li);
            });
        }

        trackCount.textContent = `${filtered.length} track${filtered.length !== 1 ? 's' : ''}`;
    }

    // ============================================================
    // SEARCH & FILTER
    // ============================================================
    searchInput.addEventListener('input', renderTrackList);

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentGenreFilter = tab.dataset.filter;
            renderTrackList();
        });
    });

    // ============================================================
    // LOAD TRACK
    // ============================================================
    function loadTrack(trackId) {
        const track = state.allTracks.find(t => t.id === trackId);
        if (!track) return;

        state.currentTrackId = trackId;
        trackTitle.textContent = track.title;
        trackArtist.textContent = track.artist;

        if (blobURLs[trackId]) {
            audio.src = blobURLs[trackId];
            audio.load();
        } else {
            trackArtist.textContent = '⚠️ Re-upload file to play';
        }

        // Genre badge
        if (track.genre && track.genre !== 'all') {
            genreBadge.textContent = track.genre;
            genreBadge.style.display = 'inline-block';
        } else {
            genreBadge.style.display = 'none';
        }

        albumIcon.style.display = 'block';
        renderTrackList();
        saveState();
    }

    // ============================================================
    // GET CURRENT QUEUE (tracks in current view, in order)
    // ============================================================
    function getCurrentQueue() {
        if (state.currentPlaylistId === 'all') return [...state.allTracks];
        const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
        if (!pl) return [];
        return pl.trackIds.map(id => state.allTracks.find(t => t.id === id)).filter(Boolean);
    }

    // ============================================================
    // PLAY / PAUSE
    // ============================================================
    function playAudio() {
        if (!state.currentTrackId) {
            const queue = getCurrentQueue();
            if (queue.length > 0) loadTrack(queue[0].id);
            else return;
        }
        audio.play().then(() => {
            state.isPlaying = true;
            playIcon.textContent = '⏸';
            albumArt.classList.add('spinning');
            visualizer.classList.add('active');
        }).catch(err => console.warn('Playback error:', err));
    }

    function pauseAudio() {
        audio.pause();
        state.isPlaying = false;
        playIcon.textContent = '▶';
        albumArt.classList.remove('spinning');
        visualizer.classList.remove('active');
    }

    playBtn.addEventListener('click', () => {
        state.isPlaying ? pauseAudio() : playAudio();
    });

    // ============================================================
    // SKIP NEXT / PREV
    // ============================================================
    nextBtn.addEventListener('click', skipNext);
    prevBtn.addEventListener('click', () => {
        if (audio.currentTime > 3) { audio.currentTime = 0; return; }
        skipPrev();
    });

    function skipNext() {
        const queue = getCurrentQueue();
        if (!queue.length) return;
        let newTrack;
        if (state.isShuffle) {
            const others = queue.filter(t => t.id !== state.currentTrackId);
            newTrack = others.length ? others[Math.floor(Math.random() * others.length)] : queue[0];
        } else {
            const idx = queue.findIndex(t => t.id === state.currentTrackId);
            newTrack = queue[(idx + 1) % queue.length];
        }
        loadTrack(newTrack.id);
        if (state.isPlaying) playAudio();
    }

    function skipPrev() {
        const queue = getCurrentQueue();
        if (!queue.length) return;
        const idx = queue.findIndex(t => t.id === state.currentTrackId);
        const newIdx = idx <= 0 ? queue.length - 1 : idx - 1;
        loadTrack(queue[newIdx].id);
        if (state.isPlaying) playAudio();
    }

    audio.addEventListener('ended', () => {
        if (state.repeatMode === 'one') {
            audio.currentTime = 0; playAudio();
        } else if (state.repeatMode === 'all') {
            skipNext();
        } else {
            const queue = getCurrentQueue();
            const idx = queue.findIndex(t => t.id === state.currentTrackId);
            if (idx < queue.length - 1) skipNext();
            else { pauseAudio(); audio.currentTime = 0; updateProgress(0, audio.duration || 0); }
        }
    });

    // ============================================================
    // SHUFFLE & REPEAT
    // ============================================================
    shuffleBtn.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        shuffleBtn.classList.toggle('active', state.isShuffle);
    });

    repeatBtn.addEventListener('click', () => {
        const modes = ['none','all','one'];
        state.repeatMode = modes[(modes.indexOf(state.repeatMode) + 1) % 3];
        const icon = repeatBtn.querySelector('i');
        if (state.repeatMode === 'none') {
            repeatBtn.classList.remove('active');
            icon.className = 'ph ph-repeat';
            repeatBtn.title = 'Repeat';
        } else if (state.repeatMode === 'all') {
            repeatBtn.classList.add('active');
            icon.className = 'ph ph-repeat';
            repeatBtn.title = 'Repeat All';
        } else {
            repeatBtn.classList.add('active');
            icon.className = 'ph ph-repeat-once';
            repeatBtn.title = 'Repeat One';
        }
    });

    // ============================================================
    // VOLUME
    // ============================================================
    volumeSlider.addEventListener('input', () => {
        const v = parseFloat(volumeSlider.value);
        audio.volume = v;
        state.volume = v;
        audio.muted = (v === 0);
        updateVolumeIcon(v);
        volumePct.textContent = Math.round(v * 100) + '%';
        saveState();
    });

    muteBtn.addEventListener('click', () => {
        audio.muted = !audio.muted;
        updateVolumeIcon(audio.muted ? 0 : audio.volume);
    });

    function updateVolumeIcon(v) {
        if (audio.muted || v === 0) volumeIcon.className = 'ph ph-speaker-x';
        else if (v < 0.4)           volumeIcon.className = 'ph ph-speaker-low';
        else                        volumeIcon.className = 'ph ph-speaker-high';
    }

    // ============================================================
    // PROGRESS BAR
    // ============================================================
    audio.addEventListener('timeupdate', () => { if (!isDragging) updateProgress(audio.currentTime, audio.duration); });
    audio.addEventListener('loadedmetadata', () => {
        updateProgress(0, audio.duration);
        totalTimeEl.textContent = formatTime(audio.duration);
        // Update duration in allTracks
        if (state.currentTrackId) {
            const t = state.allTracks.find(t => t.id === state.currentTrackId);
            if (t && !t.duration) { t.duration = audio.duration; saveState(); }
        }
    });

    progressWrapper.addEventListener('click', seekTo);
    progressWrapper.addEventListener('mousedown', (e) => { isDragging = true; seekTo(e); });
    document.addEventListener('mousemove', (e) => { if (isDragging) seekTo(e); });
    document.addEventListener('mouseup', () => { isDragging = false; });

    function seekTo(e) {
        const bar = document.getElementById('progress-bar');
        const rect = bar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const pct = x / rect.width;
        if (audio.duration) { audio.currentTime = pct * audio.duration; updateProgress(audio.currentTime, audio.duration); }
    }

    function updateProgress(current, total) {
        const pct = total ? (current / total) * 100 : 0;
        progressFill.style.width = pct + '%';
        progressThumb.style.left = pct + '%';
        currentTimeEl.textContent = formatTime(current);
        if (total) totalTimeEl.textContent = formatTime(total);
    }

    // ============================================================
    // CREATE PLAYLIST
    // ============================================================
    newPlaylistBtn.addEventListener('click', () => openRenameModal('create', null));
    modalNewPlBtn.addEventListener('click', () => {
        closeModal();
        openRenameModal('create-and-add', contextTrackId);
    });

    function openRenameModal(mode, trackId) {
        renameMode = mode;
        renameTargetId = trackId;
        renameInput.value = '';

        if (mode === 'rename') {
            const pl = state.playlists.find(p => p.id === trackId);
            renameModalTitle.textContent = 'Rename Playlist';
            renameInput.value = pl ? pl.name : '';
        } else {
            renameModalTitle.textContent = 'New Playlist';
        }

        renameOverlay.style.display = 'flex';
        setTimeout(() => renameInput.focus(), 100);
    }

    renameClose.addEventListener('click', closeRenameModal);
    renameOverlay.addEventListener('click', (e) => { if (e.target === renameOverlay) closeRenameModal(); });

    renameConfirm.addEventListener('click', confirmRename);
    renameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmRename(); });

    function confirmRename() {
        const name = renameInput.value.trim();
        if (!name) return;

        if (renameMode === 'rename') {
            const pl = state.playlists.find(p => p.id === renameTargetId);
            if (pl) { pl.name = name; saveState(); renderPlaylistsPanel(); if (state.currentPlaylistId === renameTargetId) currentPlTitle.textContent = name; }
        } else {
            // Create new playlist
            const newPl = { id: 'pl-' + Date.now(), name, trackIds: [] };
            if (renameMode === 'create-and-add' && renameTargetId) {
                newPl.trackIds.push(renameTargetId);
            }
            state.playlists.push(newPl);
            saveState();
            renderPlaylistsPanel();
            switchPlaylist(newPl.id);
        }

        closeRenameModal();
    }

    function closeRenameModal() {
        renameOverlay.style.display = 'none';
        renameMode = null;
        renameTargetId = null;
    }

    // ============================================================
    // ADD TO PLAYLIST MODAL
    // ============================================================
    function openAddToPlaylistModal(trackId) {
        contextTrackId = trackId;
        const track = state.allTracks.find(t => t.id === trackId);
        if (!track) return;

        modalTrackName.textContent = `"${track.title}" by ${track.artist}`;
        modalPlaylistList.innerHTML = '';

        if (state.playlists.length === 0) {
            const empty = document.createElement('li');
            empty.style.cssText = 'padding:1rem;text-align:center;color:var(--text-muted);font-size:0.85rem;';
            empty.textContent = 'No playlists yet. Create one below!';
            modalPlaylistList.appendChild(empty);
        } else {
            state.playlists.forEach(pl => {
                const alreadyAdded = pl.trackIds.includes(trackId);
                const li = document.createElement('li');
                li.className = `modal-pl-item ${alreadyAdded ? 'already-added' : ''}`;
                li.innerHTML = `
                    <i class="ph ph-playlist"></i>
                    <span>${escapeHTML(pl.name)}</span>
                    <span class="modal-pl-count">${pl.trackIds.length} tracks</span>
                    ${alreadyAdded ? '<i class="ph ph-check" style="color:var(--primary);margin-left:auto;"></i>' : ''}
                `;
                if (!alreadyAdded) {
                    li.addEventListener('click', () => {
                        addTrackToPlaylist(trackId, pl.id);
                        closeModal();
                    });
                }
                modalPlaylistList.appendChild(li);
            });
        }

        modalOverlay.style.display = 'flex';
    }

    function addTrackToPlaylist(trackId, playlistId) {
        const pl = state.playlists.find(p => p.id === playlistId);
        if (pl && !pl.trackIds.includes(trackId)) {
            pl.trackIds.push(trackId);
            saveState();
            renderPlaylistsPanel();
            if (state.currentPlaylistId === playlistId) renderTrackList();
        }
    }

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    function closeModal() { modalOverlay.style.display = 'none'; }

    // ============================================================
    // SIDEBAR OPTIONS (Rename/Delete current playlist)
    // ============================================================
    sidebarOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = sidebarOptionsBtn.getBoundingClientRect();
        showPlOptionsMenu(state.currentPlaylistId, rect.left, rect.bottom + 4);
    });

    function showPlOptionsMenu(playlistId, x, y) {
        closeAllMenus();
        plOptionsMenu.style.display = 'block';
        positionMenu(plOptionsMenu, x, y);

        ctxRenamePlaylist.onclick = () => {
            closePlOptionsMenu();
            openRenameModal('rename', playlistId);
        };
        ctxDeletePlaylist.onclick = () => {
            closePlOptionsMenu();
            deletePlaylist(playlistId);
        };
    }

    function closePlOptionsMenu() { plOptionsMenu.style.display = 'none'; }

    function deletePlaylist(playlistId) {
        state.playlists = state.playlists.filter(p => p.id !== playlistId);
        if (state.currentPlaylistId === playlistId) switchPlaylist('all');
        saveState();
        renderPlaylistsPanel();
    }

    // ============================================================
    // TRACK CONTEXT MENU
    // ============================================================
    function showTrackContextMenu(trackId, x, y) {
        closeAllMenus();
        contextTrackId = trackId;
        contextMenu.style.display = 'block';
        positionMenu(contextMenu, x, y);

        // Show/hide "Remove from playlist" based on context
        const inNamedPlaylist = state.currentPlaylistId !== 'all';
        ctxRemoveFromPl.style.display = inNamedPlaylist ? 'flex' : 'none';
    }

    ctxAddToPlaylist.addEventListener('click', () => {
        closeAllMenus();
        openAddToPlaylistModal(contextTrackId);
    });

    ctxRemoveFromPl.addEventListener('click', () => {
        closeAllMenus();
        if (state.currentPlaylistId !== 'all') {
            const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
            if (pl) {
                pl.trackIds = pl.trackIds.filter(id => id !== contextTrackId);
                saveState();
                renderPlaylistsPanel();
                renderTrackList();
            }
        }
    });

    ctxDeleteTrack.addEventListener('click', () => {
        closeAllMenus();
        deleteTrackFromLibrary(contextTrackId);
    });

    function deleteTrackFromLibrary(trackId) {
        // Revoke blob
        if (blobURLs[trackId]) { URL.revokeObjectURL(blobURLs[trackId]); delete blobURLs[trackId]; }
        // Remove from all playlists
        state.playlists.forEach(pl => { pl.trackIds = pl.trackIds.filter(id => id !== trackId); });
        // Remove from library
        state.allTracks = state.allTracks.filter(t => t.id !== trackId);

        if (state.currentTrackId === trackId) {
            const queue = getCurrentQueue();
            pauseAudio();
            if (queue.length > 0) loadTrack(queue[0].id);
            else resetPlayer();
        }
        saveState();
        renderPlaylistsPanel();
        renderTrackList();
    }

    // ============================================================
    // CONTEXT MENU HELPERS
    // ============================================================
    function positionMenu(menu, x, y) {
        menu.style.left = x + 'px';
        menu.style.top  = y + 'px';
        // Keep within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right  > window.innerWidth)  menu.style.left = (x - rect.width)  + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top  = (y - rect.height) + 'px';
    }

    function closeAllMenus() {
        contextMenu.style.display = 'none';
        plOptionsMenu.style.display = 'none';
    }

    document.addEventListener('click', closeAllMenus);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAllMenus(); closeModal(); closeRenameModal(); } });

    // ============================================================
    // RESET PLAYER
    // ============================================================
    function resetPlayer() {
        audio.src = '';
        state.currentTrackId = null;
        trackTitle.textContent = 'No Track Selected';
        trackArtist.textContent = 'Upload music to begin';
        genreBadge.style.display = 'none';
        albumArt.classList.remove('spinning');
        visualizer.classList.remove('active');
        playIcon.textContent = '▶';
        state.isPlaying = false;
        updateProgress(0, 0);
        currentTimeEl.textContent = '0:00';
        totalTimeEl.textContent = '0:00';
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        switch (e.code) {
            case 'Space':      e.preventDefault(); state.isPlaying ? pauseAudio() : playAudio(); break;
            case 'ArrowRight': if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
            case 'ArrowLeft':  if (audio.duration) audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
            case 'ArrowUp':    volumeSlider.value = Math.min(+volumeSlider.value + 0.05, 1).toFixed(2); volumeSlider.dispatchEvent(new Event('input')); break;
            case 'ArrowDown':  volumeSlider.value = Math.max(+volumeSlider.value - 0.05, 0).toFixed(2); volumeSlider.dispatchEvent(new Event('input')); break;
            case 'KeyN':       skipNext(); break;
            case 'KeyM':       muteBtn.click(); break;
        }
    });

    // ============================================================
    // UTILITIES
    // ============================================================
    function formatTime(secs) {
        if (!secs || isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================================
    // START
    // ============================================================
    init();
});
