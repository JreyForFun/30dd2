document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileListElement = document.getElementById('file-list');
    const mergeBtn = document.getElementById('merge-btn');
    const clearBtn = document.getElementById('clear-btn');
    const fileCountSpan = document.getElementById('file-count');
    const totalSizeSpan = document.getElementById('total-size');
    const successMessage = document.getElementById('success-message');

    // State
    let filesData = []; // Array of { id, file, name, size, pageCount, pdfDoc }

    // Constants
    const MAX_FILES_MSG = 'Only PDF files are accepted.';

    // Initialize Event Listeners
    initEventListeners();

    function initEventListeners() {
        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        // Browse Button
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

        // Click on drop zone triggers input (optional, but good UX)
        dropZone.addEventListener('click', (e) => {
            if (e.target !== browseBtn && e.target !== fileInput) {
                fileInput.click();
            }
        });

        // Action Buttons
        mergeBtn.addEventListener('click', mergePDFs);
        clearBtn.addEventListener('click', clearAllFiles);
    }

    async function handleFiles(fileList) {
        successMessage.classList.add('hidden');
        const newFiles = Array.from(fileList).filter(file => file.type === 'application/pdf');

        if (newFiles.length === 0 && fileList.length > 0) {
            alert(MAX_FILES_MSG);
            return;
        }

        for (const file of newFiles) {
            await addFile(file);
        }

        updateUI();
    }

    async function addFile(file) {
        const id = Date.now() + Math.random().toString(36).substr(2, 9);

        try {
            // Load PDF for metadata and thumbnail using pdf.js
            const arrayBuffer = await file.arrayBuffer();
            const pdfData = new Uint8Array(arrayBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            const pdfDoc = await loadingTask.promise;

            const pageCount = pdfDoc.numPages;
            const thumbnail = await generateThumbnail(pdfDoc);

            filesData.push({
                id,
                file,
                name: file.name,
                size: formatSize(file.size),
                sizeBytes: file.size,
                pageCount,
                thumbnail,
                pdfData 
            });

        } catch (error) {
            console.error('Error loading PDF:', error);
            alert(`Failed to load ${file.name}. It might be corrupted.`);
        }
    }

    async function generateThumbnail(pdfDoc) {
        try {
            const page = await pdfDoc.getPage(1);
            const scale = 0.5; // Small thumbnail
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            return canvas.toDataURL();
        } catch (e) {
            console.error('Error generating thumbnail', e);
            return ''; // Fallback or placeholder could go here
        }
    }

    function removeFile(id) {
        filesData = filesData.filter(f => f.id !== id);
        updateUI();
    }

    function clearAllFiles() {
        filesData = [];
        updateUI();
        fileInput.value = '';
        successMessage.classList.add('hidden');
    }

    function updateUI() {
        renderFileList();
        updateStats();
        updateButtons();
    }

    function updateStats() {
        fileCountSpan.textContent = `${filesData.length} PDFs selected`;
        const totalBytes = filesData.reduce((acc, curr) => acc + curr.sizeBytes, 0);
        totalSizeSpan.textContent = `Total size: ${formatSize(totalBytes)}`;
    }

    function updateButtons() {
        mergeBtn.disabled = filesData.length < 2;
        if (filesData.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }

    function renderFileList() {
        fileListElement.innerHTML = '';

        filesData.forEach((data, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.draggable = true;
            item.setAttribute('data-id', data.id);
            item.setAttribute('data-index', index);

            item.innerHTML = `
                <div class="drag-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                </div>
                <img src="${data.thumbnail}" class="file-thumbnail" alt="Preview">
                <div class="file-info">
                    <div class="file-name" title="${data.name}">${data.name}</div>
                    <div class="file-meta">
                        <span>${data.size}</span>
                        <span>${data.pageCount} pages</span>
                    </div>
                </div>
                <button class="remove-btn" onclick="document.dispatchEvent(new CustomEvent('remove-file', { detail: '${data.id}' }))">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;

            // Drag events for reordering
            addDragEvents(item);

            fileListElement.appendChild(item);
        });
    }

    // Global listener for remove buttons since they are dynamic
    document.addEventListener('remove-file', (e) => {
        removeFile(e.detail);
    });

    // Reordering Logic
    let dragSrcEl = null;

    function addDragEvents(item) {
        item.addEventListener('dragstart', (e) => {
            dragSrcEl = item;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.getAttribute('data-index'));
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            const items = fileListElement.querySelectorAll('.file-item');
            items.forEach(i => i.classList.remove('over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
        });

        item.addEventListener('dragenter', function () {
            this.classList.add('over');
        });

        item.addEventListener('dragleave', function () {
            this.classList.remove('over');
        });

        item.addEventListener('drop', function (e) {
            e.stopPropagation();
            if (dragSrcEl !== this) {
                const srcIndex = parseInt(dragSrcEl.getAttribute('data-index'));
                const targetIndex = parseInt(this.getAttribute('data-index'));

                // Swap in array
                const header = filesData[srcIndex];
                filesData.splice(srcIndex, 1);
                filesData.splice(targetIndex, 0, header);

                // Re-render
                updateUI();
            }
            return false;
        });
    }

    async function mergePDFs() {
        if (filesData.length < 2) return;

        const originalBtnText = mergeBtn.innerText;
        mergeBtn.innerText = 'Merging...';
        mergeBtn.disabled = true;

        try {
            const PDFLib = window.PDFLib;
            if (!PDFLib) {
                throw new Error('PDF-LIB library not loaded. Please check your internet connection.');
            }
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (const data of filesData) {
                const arrayBuffer = await data.file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBytes = await mergedPdf.save();
            downloadPDF(pdfBytes, 'merged-document.pdf');

            successMessage.classList.remove('hidden');
        } catch (error) {
            console.error('Merge failed:', error);
            alert(`An error occurred while merging PDFs: ${error.message}`);
        } finally {
            mergeBtn.innerText = originalBtnText;
            mergeBtn.disabled = false;
        }
    }

    function downloadPDF(bytes, filename) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
});
