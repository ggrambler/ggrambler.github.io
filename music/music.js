/* =========================================================
   OBSIDIAN LOCAL MUSIC PLAYER
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const CONFIG = {
  TRACKS_FOLDER: "./tracks",
  COVERS_FOLDER: "./covers",
  DEFAULT_COVER: "./muisc.jpg",
  STORAGE_PREFIX: "obsidianMusic"
};



/* =========================================================
   DOM
   ========================================================= */

const audio = document.getElementById("audioPlayer");

const trackList = document.getElementById("trackList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const libraryCount = document.getElementById("libraryCount");
const emptyState = document.getElementById("emptyState");

const currentTitle = document.getElementById("currentTitle");
const currentArtist = document.getElementById("currentArtist");
const currentAlbum = document.getElementById("currentAlbum");

const coverImage = document.getElementById("coverImage");

const currentTimeText = document.getElementById("currentTime");
const durationText = document.getElementById("duration");
const seekBar = document.getElementById("seekBar");

const playButton = document.getElementById("playButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");

const shuffleButton = document.getElementById("shuffleButton");
const repeatButton = document.getElementById("repeatButton");

const favoriteButton = document.getElementById("favoriteButton");
const favoritesOnlyButton =
  document.getElementById("favoritesOnlyButton");

const volumeBar = document.getElementById("volumeBar");

const nextSong = document.getElementById("nextSong");
const streamStatus = document.getElementById("streamStatus");

const downloadButton =
  document.getElementById("downloadButton");



/* =========================================================
   STATE
   ========================================================= */

let tracks = [];
let visibleTracks = [];

let currentIndex = -1;

let shuffle = false;

/*
  repeatMode:
    off
    all
    one
*/

let repeatMode = "off";

let favoritesOnly = false;

let favorites = new Set(
  JSON.parse(
    localStorage.getItem(
      `${CONFIG.STORAGE_PREFIX}:favorites`
    ) || "[]"
  )
);



/* =========================================================
   LOAD LIBRARY
   ========================================================= */

async function loadTracks() {

  try {

    const response = await fetch("./tracks.json");

    if (!response.ok) {
      throw new Error(
        `tracks.json failed: ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "tracks.json must contain an array."
      );
    }


    tracks = data.map(
      (track, index) => ({

        ...track,

        index,

        id: String(
          track.id ?? index + 1
        ),

        title:
          track.title ||
          `Track ${index + 1}`,

        artist:
          track.artist || "",

        album:
          track.album || "",

        cover:
          track.cover || ""

      })
    );


    visibleTracks = [...tracks];


    restoreVolume();
    restorePlayerSettings();

    renderTracks();

    libraryCount.textContent =
      `${tracks.length} tracks · ${favorites.size} favourites`;


    restoreLastTrack();

  }

  catch (error) {

    console.error(
      "Music library error:",
      error
    );

    libraryCount.textContent =
      "Failed to load music";

    trackList.innerHTML = `

      <div class="empty-state">

        Failed to load tracks.json.

      </div>

    `;

  }

}



/* =========================================================
   FILE URL
   ========================================================= */

function getAudioURL(track) {

  /*
    Full remote URL support, just in case.
  */

  if (
    track.file.startsWith("http://") ||
    track.file.startsWith("https://")
  ) {

    return track.file;

  }


  /*
    Important for your filenames:

    01 - IGOR'S THEME.flac

    becomes something like:

    ./tracks/01%20-%20IGOR'S%20THEME.flac
  */

  const safePath = track.file

    .split("/")

    .map(
      part =>
        encodeURIComponent(part)
    )

    .join("/");


  return `${CONFIG.TRACKS_FOLDER}/${safePath}`;

}



/* =========================================================
   COVER URL
   ========================================================= */

function getCoverURL(track) {
    return CONFIG.DEFAULT_COVER;
}

/* =========================================================
   RENDER LIBRARY
   ========================================================= */

function renderTracks() {

  trackList.innerHTML = "";


  emptyState.classList.toggle(
    "hidden",
    visibleTracks.length !== 0
  );


  const fragment =
    document.createDocumentFragment();


  visibleTracks.forEach(
    track => {

      const row =
        document.createElement("div");


      row.className =
        "track-row";


      row.dataset.trackId =
        track.id;


      if (
        tracks[currentIndex]?.id ===
        track.id
      ) {

        row.classList.add(
          "current"
        );

      }


      const favorite =
        favorites.has(
          track.id
        );


      row.innerHTML = `

        <span class="track-number">

          ${track.index + 1}

        </span>


        <div class="track-main">

          <span class="track-title">

            ${escapeHTML(track.title)}

          </span>

        </div>


        <span class="track-artist">

          ${escapeHTML(track.artist)}

        </span>


        <span class="track-album">

          ${escapeHTML(track.album)}

        </span>


        <button
          class="
            favorite-row
            ${favorite ? "active" : ""}
          "
          data-favorite="${escapeHTML(track.id)}"
          type="button"
          title="Favourite"
        >

          ${favorite ? "♥" : "♡"}

        </button>

      `;



      /*
        Click track
      */

      row.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              "[data-favorite]"
            )
          ) {

            return;

          }


          const realIndex =
            tracks.findIndex(
              item =>
                item.id ===
                track.id
            );


          selectTrack(
            realIndex,
            true
          );

        }
      );



      /*
        Favourite button
      */

      const favouriteButton =
        row.querySelector(
          "[data-favorite]"
        );


      favouriteButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          toggleFavorite(
            track.id
          );

        }
      );


      fragment.appendChild(
        row
      );

    }
  );


  trackList.appendChild(
    fragment
  );


  libraryCount.textContent =

    `${tracks.length} tracks · ${favorites.size} favourites`;

}



/* =========================================================
   SELECT TRACK
   ========================================================= */

function selectTrack(
  index,
  autoplay = false,
  resumePosition = 0
) {

  if (
    index < 0 ||
    index >= tracks.length
  ) {

    return;

  }


  const track =
    tracks[index];

    downloadButton.disabled = false;


  currentIndex =
    index;

  audio.src = getAudioURL(track);
  streamStatus.textContent =
    `Loading ${track.file}`;

  currentTitle.textContent = track.title;
  currentArtist.textContent = track.artist || "Unknown Artist";
  currentAlbum.textContent = track.album || "";


  coverImage.src = getCoverURL(track);
  coverImage.onerror =
    () => {
      coverImage.src =
        CONFIG.DEFAULT_COVER;
    };

  currentTimeText.textContent ="0:00";
  durationText.textContent ="0:00";
  seekBar.value = 0;

  updateFavoriteButton();
  updateNextSong();
  renderTracks();
  setupMediaSession(track);

  saveCurrentTrack(
    track.id,
    resumePosition
  );


  if (
    resumePosition > 0
  ) {

    audio.addEventListener(
      "loadedmetadata",
      () => {

        if (
          resumePosition <
          audio.duration
        ) {

          audio.currentTime =
            resumePosition;

        }

      },
      {
        once: true
      }
    );

  }



  if (autoplay) {

    audio
      .play()
      .catch(
        error => {

          console.warn(
            "Playback failed:",
            error
          );

        }
      );

  }

}



/* =========================================================
   PLAY / PAUSE
   ========================================================= */

function togglePlay() {

  if (
    currentIndex === -1
  ) {

    if (
      tracks.length > 0
    ) {

      selectTrack(
        0,
        true
      );

    }

    return;

  }



  if (
    audio.paused
  ) {

    audio
      .play()
      .catch(
        console.warn
      );

  }

  else {

    audio.pause();

  }

}



/* =========================================================
   NEXT TRACK
   ========================================================= */

function nextTrack() {

  if (
    tracks.length === 0
  ) {

    return;

  }



  /*
    Repeat current song
  */

  if (
    repeatMode === "one"
  ) {

    audio.currentTime = 0;

    audio
      .play()
      .catch(
        console.warn
      );

    return;

  }



  let nextIndex;



  /*
    Shuffle
  */

  if (shuffle) {

    if (
      tracks.length === 1
    ) {

      nextIndex = 0;

    }

    else {

      do {

        nextIndex =
          Math.floor(
            Math.random() *
            tracks.length
          );

      }

      while (
        nextIndex ===
        currentIndex
      );

    }

  }

  else {

    nextIndex =
      currentIndex + 1;

  }



  /*
    End of library
  */

  if (
    nextIndex >=
    tracks.length
  ) {

    if (
      repeatMode === "all"
    ) {

      nextIndex = 0;

    }

    else {

      audio.pause();

      audio.currentTime =
        0;

      return;

    }

  }



  selectTrack(
    nextIndex,
    true
  );

}



/* =========================================================
   PREVIOUS TRACK
   ========================================================= */

function previousTrack() {

  if (
    tracks.length === 0
  ) {

    return;

  }



  /*
    Spotify-style behaviour:

    if song is already >4 seconds,
    previous restarts song.
  */

  if (
    audio.currentTime > 4
  ) {

    audio.currentTime =
      0;

    return;

  }



  let previousIndex =
    currentIndex - 1;



  if (
    previousIndex < 0
  ) {

    previousIndex =

      repeatMode === "all"

      ?

      tracks.length - 1

      :

      0;

  }



  selectTrack(
    previousIndex,
    true
  );

}



/* =========================================================
   SEARCH
   ========================================================= */

function filterTracks() {

  const query =

    searchInput.value
      .trim()
      .toLowerCase();



  visibleTracks =
    tracks.filter(
      track => {

        const title =
          (
            track.title || ""
          )
            .toLowerCase();


        const artist =
          (
            track.artist || ""
          )
            .toLowerCase();


        const album =
          (
            track.album || ""
          )
            .toLowerCase();



        const matchesText =

          !query ||

          title.includes(query) ||

          artist.includes(query) ||

          album.includes(query);



        const matchesFavorites =

          !favoritesOnly ||

          favorites.has(
            track.id
          );



        return (

          matchesText &&
          matchesFavorites

        );

      }
    );


  sortTracks();

}



/* =========================================================
   SORT
   ========================================================= */

function sortTracks() {

  const type =
    sortSelect.value;



  if (
    type === "default" ||
    type === "index"
  ) {

    visibleTracks.sort(
      (a, b) =>
        a.index -
        b.index
    );

  }

  else {

    visibleTracks.sort(
      (a, b) =>

        String(
          a[type] || ""
        )

          .localeCompare(

            String(
              b[type] || ""
            ),

            undefined,

            {
              sensitivity: "base"
            }

          )

    );

  }


  renderTracks();

}



/* =========================================================
   FAVORITES
   ========================================================= */

function toggleFavorite(id) {

  if (
    favorites.has(id)
  ) {

    favorites.delete(
      id
    );

  }

  else {

    favorites.add(
      id
    );

  }



  localStorage.setItem(

    `${CONFIG.STORAGE_PREFIX}:favorites`,

    JSON.stringify(
      [...favorites]
    )

  );


  updateFavoriteButton();

  filterTracks();

}



function updateFavoriteButton() {

  if (
    currentIndex === -1
  ) {

    favoriteButton.textContent =
      "♡ Favourite";

    favoriteButton.classList.remove(
      "active"
    );

    return;

  }



  const id =
    tracks[currentIndex].id;


  const active =
    favorites.has(id);



  favoriteButton.classList.toggle(
    "active",
    active
  );


  favoriteButton.textContent =

    active

    ?

    "♥ Favourite"

    :

    "♡ Favourite";

}



/* =========================================================
   FAVORITES FILTER
   ========================================================= */

favoritesOnlyButton.addEventListener(
  "click",
  () => {

    favoritesOnly =
      !favoritesOnly;


    favoritesOnlyButton.classList.toggle(
      "active",
      favoritesOnly
    );


    favoritesOnlyButton.textContent =

      favoritesOnly

      ?

      "♥"

      :

      "♡";


    filterTracks();

  }
);



/* =========================================================
   SHUFFLE
   ========================================================= */

shuffleButton.addEventListener(
  "click",
  () => {

    shuffle =
      !shuffle;


    shuffleButton.classList.toggle(
      "active",
      shuffle
    );


    localStorage.setItem(

      `${CONFIG.STORAGE_PREFIX}:shuffle`,

      String(shuffle)

    );

  }
);



/* =========================================================
   REPEAT
   ========================================================= */

repeatButton.addEventListener(
  "click",
  () => {

    if (
      repeatMode === "off"
    ) {

      repeatMode =
        "all";

    }

    else if (
      repeatMode === "all"
    ) {

      repeatMode =
        "one";

    }

    else {

      repeatMode =
        "off";

    }



    updateRepeatUI();



    localStorage.setItem(

      `${CONFIG.STORAGE_PREFIX}:repeat`,

      repeatMode

    );


    updateNextSong();

  }
);



function updateRepeatUI() {

  repeatButton.classList.toggle(

    "active",

    repeatMode !== "off"

  );


  repeatButton.textContent =

    repeatMode === "one"

    ?

    "↻¹"

    :

    "↻";


  repeatButton.title =

    repeatMode === "off"

    ?

    "Repeat off"

    :

    repeatMode === "all"

    ?

    "Repeat all"

    :

    "Repeat one";

}



/* =========================================================
   UP NEXT
   ========================================================= */

function updateNextSong() {

  if (
    currentIndex === -1
  ) {

    nextSong.textContent =
      "—";

    return;

  }



  if (
    repeatMode === "one"
  ) {

    const current =
      tracks[currentIndex];


    nextSong.textContent =

      `${current.title} — repeat`;

    return;

  }



  let nextIndex =
    currentIndex + 1;



  if (
    nextIndex >=
    tracks.length
  ) {

    if (
      repeatMode === "all"
    ) {

      nextIndex = 0;

    }

    else {

      nextSong.textContent =
        "End of library";

      return;

    }

  }



  const track =
    tracks[nextIndex];


  nextSong.textContent =

    `${track.title}`

    +

    (
      track.artist

      ?

      ` — ${track.artist}`

      :

      ""
    );

}



/* =========================================================
   AUDIO EVENTS
   ========================================================= */

audio.addEventListener(
  "loadstart",
  () => {

    streamStatus.textContent =
      "Loading track…";

  }
);



audio.addEventListener(
  "canplay",
  () => {

    streamStatus.textContent =
      "Ready";

  }
);



audio.addEventListener(
  "waiting",
  () => {

    streamStatus.textContent =
      "Buffering…";

  }
);



audio.addEventListener(
  "playing",
  () => {

    streamStatus.textContent =
      "Playing";

  }
);



audio.addEventListener(
  "error",
  () => {

    streamStatus.textContent =
      "Unable to play this file";

    console.error(
      "Audio error:",
      audio.error
    );

  }
);



audio.addEventListener(
  "play",
  () => {

    playButton.textContent =
      "❚❚";


    if (
      "mediaSession" in navigator
    ) {

      navigator
        .mediaSession
        .playbackState =
        "playing";

    }

  }
);



audio.addEventListener(
  "pause",
  () => {

    playButton.textContent =
      "▶";


    if (
      "mediaSession" in navigator
    ) {

      navigator
        .mediaSession
        .playbackState =
        "paused";

    }

  }
);



audio.addEventListener(
  "loadedmetadata",
  () => {

    durationText.textContent =

      formatTime(
        audio.duration
      );

  }
);



audio.addEventListener(
  "timeupdate",
  () => {

    currentTimeText.textContent =

      formatTime(
        audio.currentTime
      );



    if (
      Number.isFinite(
        audio.duration
      )

      &&

      audio.duration > 0
    ) {

      seekBar.value =

        (
          audio.currentTime /
          audio.duration
        )

        *

        1000;

    }



    /*
      Save listening position
    */

    const track =
      tracks[currentIndex];


    if (track) {

      saveCurrentTrack(
        track.id,
        audio.currentTime
      );

    }



    /*
      Windows/browser media progress
    */

    if (
      "mediaSession" in navigator

      &&

      Number.isFinite(
        audio.duration
      )

      &&

      audio.duration > 0
    ) {

      try {

        navigator
          .mediaSession
          .setPositionState({

            duration:
              audio.duration,

            playbackRate:
              audio.playbackRate,

            position:
              Math.min(
                audio.currentTime,
                audio.duration
              )

          });

      }

      catch {

        // Some browsers don't support this.

      }

    }

  }
);



audio.addEventListener(
  "ended",
  nextTrack
);



/* =========================================================
   SEEK
   ========================================================= */

seekBar.addEventListener(
  "input",
  () => {

    if (
      !Number.isFinite(
        audio.duration
      )

      ||

      audio.duration <= 0
    ) {

      return;

    }


    audio.currentTime =

      (
        Number(
          seekBar.value
        )
        /
        1000
      )

      *

      audio.duration;

  }
);



/* =========================================================
   VOLUME
   ========================================================= */

volumeBar.addEventListener(
  "input",
  () => {

    audio.volume =
      Number(
        volumeBar.value
      );


    localStorage.setItem(

      `${CONFIG.STORAGE_PREFIX}:volume`,

      String(
        audio.volume
      )

    );

  }
);



function restoreVolume() {

  const savedVolume =
    Number(

      localStorage.getItem(
        `${CONFIG.STORAGE_PREFIX}:volume`
      )

    );



  if (
    Number.isFinite(
      savedVolume
    )

    &&

    savedVolume >= 0

    &&

    savedVolume <= 1
  ) {

    audio.volume =
      savedVolume;


    volumeBar.value =
      savedVolume;

  }

  else {

    audio.volume =
      Number(
        volumeBar.value
      );

  }

}



/* =========================================================
   SAVE / RESTORE PLAYER
   ========================================================= */

function saveCurrentTrack(
  id,
  position
) {

  localStorage.setItem(

    `${CONFIG.STORAGE_PREFIX}:current`,

    JSON.stringify({

      id,

      position

    })

  );

}



function restoreLastTrack() {

  try {

    const data =
      JSON.parse(

        localStorage.getItem(

          `${CONFIG.STORAGE_PREFIX}:current`

        )

      );


    if (
      !data ||
      !data.id
    ) {

      return;

    }


    const index =
      tracks.findIndex(
        track =>
          track.id ===
          String(data.id)
      );


    if (
      index === -1
    ) {

      return;

    }


    selectTrack(
      index,
      false,
      Number(
        data.position || 0
      )
    );


    streamStatus.textContent =
      "Previous track ready";

  }

  catch {

    // Ignore corrupted localStorage.

  }

}



function restorePlayerSettings() {

  shuffle =

    localStorage.getItem(

      `${CONFIG.STORAGE_PREFIX}:shuffle`

    )

    === "true";


  shuffleButton.classList.toggle(
    "active",
    shuffle
  );



  const savedRepeat =
    localStorage.getItem(

      `${CONFIG.STORAGE_PREFIX}:repeat`

    );


  if (
    [
      "off",
      "all",
      "one"
    ].includes(
      savedRepeat
    )
  ) {

    repeatMode =
      savedRepeat;

  }


  updateRepeatUI();

}



/* =========================================================
   BUTTON EVENTS
   ========================================================= */

playButton.addEventListener(
  "click",
  togglePlay
);


nextButton.addEventListener(
  "click",
  nextTrack
);


previousButton.addEventListener(
  "click",
  previousTrack
);



favoriteButton.addEventListener(
  "click",
  () => {

    if (
      currentIndex !== -1
    ) {

      toggleFavorite(
        tracks[currentIndex].id
      );

    }

  }
);



searchInput.addEventListener(
  "input",
  filterTracks
);



sortSelect.addEventListener(
  "change",
  filterTracks
);



/* =========================================================
   MEDIA SESSION API
   ========================================================= */

function setupMediaSession(
  track
) {

  if (
    !(
      "mediaSession"
      in navigator
    )
  ) {

    return;

  }


  const artwork = [];


  if (
    track.cover
  ) {

    artwork.push({

      src:
        getCoverURL(track),

      sizes:
        "512x512"

    });

  }



  navigator.mediaSession.metadata =

    new MediaMetadata({

      title:
        track.title,

      artist:
        track.artist || "",

      album:
        track.album || "",

      artwork

    });

}



if (
  "mediaSession"
  in navigator
) {

  try {

    navigator
      .mediaSession
      .setActionHandler(
        "play",
        () =>
          audio.play()
      );


    navigator
      .mediaSession
      .setActionHandler(
        "pause",
        () =>
          audio.pause()
      );


    navigator
      .mediaSession
      .setActionHandler(
        "nexttrack",
        nextTrack
      );


    navigator
      .mediaSession
      .setActionHandler(
        "previoustrack",
        previousTrack
      );


    navigator
      .mediaSession
      .setActionHandler(
        "seekbackward",
        event => {

          audio.currentTime =

            Math.max(

              0,

              audio.currentTime -
              (
                event.seekOffset ||
                10
              )

            );

        }
      );


    navigator
      .mediaSession
      .setActionHandler(
        "seekforward",
        event => {

          audio.currentTime =

            Math.min(

              audio.duration ||
              Infinity,

              audio.currentTime +
              (
                event.seekOffset ||
                10
              )

            );

        }
      );

  }

  catch {

    // Some Media Session actions
    // are not available everywhere.

  }

}



/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    const tag =
      document
        .activeElement
        ?.tagName;


    /*
      Don't trigger shortcuts while
      typing into search etc.
    */

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {

      return;

    }



    /*
      SPACE
      play / pause
    */

    if (
      event.code === "Space"
    ) {

      event.preventDefault();

      togglePlay();

    }



    /*
      RIGHT
      +5 sec
    */

    else if (
      event.key ===
      "ArrowRight"
    ) {

      audio.currentTime =

        Math.min(

          audio.duration ||
          Infinity,

          audio.currentTime +
          5

        );

    }



    /*
      LEFT
      -5 sec
    */

    else if (
      event.key ===
      "ArrowLeft"
    ) {

      audio.currentTime =

        Math.max(

          0,

          audio.currentTime -
          5

        );

    }



    /*
      N = next
    */

    else if (
      event.key
        .toLowerCase()
      ===
      "n"
    ) {

      nextTrack();

    }



    /*
      P = previous
    */

    else if (
      event.key
        .toLowerCase()
      ===
      "p"
    ) {

      previousTrack();

    }

  }
);


function formatTime(
  seconds
) {

  if (
    !Number.isFinite(
      seconds
    )

    ||

    seconds < 0
  ) {

    return "0:00";

  }


  const minutes =
    Math.floor(
      seconds / 60
    );


  const remainingSeconds =
    Math.floor(
      seconds % 60
    );


  return (

    `${minutes}:`

    +

    String(
      remainingSeconds
    )
      .padStart(
        2,
        "0"
      )

  );

}



function escapeHTML(
  value = ""
) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}
function downloadCurrentTrack() {

  if (currentIndex === -1) {
    return;
  }

  const track =
    tracks[currentIndex];

  const url =
    getAudioURL(track);


  const link =
    document.createElement("a");

  link.href = url;

  /*
    Keep the actual filename:
    09 Nights.mp3
    01 - IGOR'S THEME.flac
    etc.
  */

  link.download =
    track.file;

  document.body.appendChild(link);

  link.click();

  link.remove();
}
downloadButton.addEventListener(
  "click",
  downloadCurrentTrack
);


loadTracks();