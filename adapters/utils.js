// Shared adapter utilities

function chunkText(text, maxLen) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.substring(i, i + maxLen));
  }
  return chunks.length > 0 ? chunks : [text];
}

function truncateAtFileBoundary(diff, maxChars) {
  const FILE_HEADER = "diff --git ";
  const files = diff.split(FILE_HEADER).filter(Boolean);
  let result = "";
  for (const file of files) {
    const entry = FILE_HEADER + file;
    if (result.length + entry.length > maxChars) break;
    result += entry;
  }
  return result || diff.substring(0, maxChars);
}

async function fetchImageBuffer(imgUrl) {
  const res = await fetch(`http://localhost:${process.env.PORT || 3000}${imgUrl}`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { chunkText, truncateAtFileBoundary, fetchImageBuffer };
