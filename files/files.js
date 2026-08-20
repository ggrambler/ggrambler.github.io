async function loadFiles() {
  const container = document.getElementById("file-list");

  try {
    const response = await fetch("./objects/files.json");

    if (!response.ok) {
      throw new Error("Could not load files.json");
    }

    const files = await response.json();

    container.innerHTML = "";

    files.forEach((file, index) => {
      const link = document.createElement("a");

      const objectNumber =
        "OBJ" + String(index + 1).padStart(2, "0");

      link.textContent = objectNumber;

      link.href =
        "./objects/" +
        file
          .split("/")
          .map(encodeURIComponent)
          .join("/");

      link.download = file;

      link.className = "file-link";
      link.title = file;

      container.appendChild(link);
    });

    if (files.length === 0) {
      container.textContent = "No files.";
    }

  } catch (error) {
    console.error(error);
    container.textContent = "Failed to load file list.";
  }
}

loadFiles();