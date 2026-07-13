Status: resolved
Blocked by: None

## Description
Implement the ZIP compression and decompression wrapper functions using `JSZip` to support `.rosz` files.
A `.rosz` file is a ZIP archive containing a single `.ros` XML file inside.
Specifically:
- Implement `compressXmlToRosz(fileName, xmlText)`: returns a Promise resolving to a Blob that represents the zipped `.rosz` file. The archive must contain a single file named `[fileName].ros` with the content of `xmlText`.
- Implement `decompressRoszToXml(fileBlob)`: takes a File/Blob, checks if it's a ZIP archive (by file extension or magic bytes). If it is a ZIP, decompresses the archive, extracts the first `.ros` file, and returns its text content. If it is already raw XML (a `.ros` file), returns the text content directly without decompressing.

We will put these functions inside `src/utils/rosterSerialization.js`.

## Acceptance Criteria
- [ ] `compressXmlToRosz` successfully zips XML string into a ZIP Blob.
- [ ] `decompressRoszToXml` successfully extracts XML string from a zipped Blob.
- [ ] `decompressRoszToXml` handles raw unzipped XML files correctly by returning their text content.
- [ ] All unit tests in `src/utils/rosterSerialization.test.js` for ZIP handling pass.

## Comments
- Implemented compressXmlToRosz and decompressRoszToXml using JSZip in src/utils/rosterSerialization.js, fully verified via unit tests.
