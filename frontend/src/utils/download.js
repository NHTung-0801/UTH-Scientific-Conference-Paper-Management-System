// src/utils/download.js

export function downloadBlob(blob, filename = "download") {
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

export function getFilenameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) return null;

  let matches = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (matches?.[1]) {
    try {
      return decodeURIComponent(matches[1]);
    } catch (_) {}
  }

  matches = /filename="?([^"]+)"?/i.exec(contentDisposition);
  if (matches?.[1]) return matches[1];

  return null;
}
