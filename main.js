(function () {
    const stage = document.getElementById('stage');
    const slides = Array.from(document.querySelectorAll('.slide'));
    const progressFill = document.getElementById('progressFill');
    const slideCounter = document.getElementById('slideCounter');
    const sectionNav = document.getElementById('sectionNav');
    const editToggle = document.getElementById('editToggle');
    const editorPanel = document.getElementById('editorPanel');
    const closeEditor = document.getElementById('closeEditor');
    const selectionLabel = document.getElementById('selectionLabel');
    const textControl = document.getElementById('textControl');
    const textColor = document.getElementById('textColor');
    const fontSize = document.getElementById('fontSize');
    const textAlign = document.getElementById('textAlign');
    const imageInput = document.getElementById('imageInput');
    const offsetX = document.getElementById('offsetX');
    const offsetY = document.getElementById('offsetY');
    const boxWidth = document.getElementById('boxWidth');
    const boxHeight = document.getElementById('boxHeight');
    const cornerRadius = document.getElementById('cornerRadius');
    const themeSage = document.getElementById('themeSage');
    const themeGold = document.getElementById('themeGold');
    const saveEdits = document.getElementById('saveEdits');
    const resetSlide = document.getElementById('resetSlide');
    const resetAll = document.getElementById('resetAll');
    const exportHtml = document.getElementById('exportHtml');

    const STORAGE_VERSION = 2;
    const STORAGE_KEYS = {
        slide: 'inclusiveAcademicSlide',
        edits: 'inclusiveAcademicEdits',
        theme: 'inclusiveAcademicTheme'
    };
    const embeddedState = window.INCLUSIVE_ACADEMIC_EMBEDDED_STATE || null;
    const originalSlideSnapshots = slides.map(slide => createSlideSnapshot(slide));

    let current = Math.min(getInitialSlideIndex(), slides.length - 1);
    let editMode = false;
    let selected = null;
    let drag = null;
    let resize = null;
    let slideFiveAnimated = false;

    function getScale() {
        const transform = getComputedStyle(stage).transform;
        if (!transform || transform === 'none') return 1;
        const match = transform.match(/matrix\(([^,]+)/);
        return match ? parseFloat(match[1]) : 1;
    }

    function scaleStage() {
        const isCover = current === 0;
        stage.classList.toggle('cover-fit', isCover);
        if (isCover) {
            stage.style.transform = '';
            return;
        }
        const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        stage.style.transform = `scale(${scale})`;
    }

    function buildSectionNav() {
        const seen = new Map();
        slides.forEach((slide, index) => {
            const section = slide.dataset.section || `slide-${index}`;
            if (!seen.has(section)) seen.set(section, index);
        });
        sectionNav.innerHTML = '';
        seen.forEach((firstSlide, section) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'nav-dot';
            dot.title = section;
            dot.setAttribute('aria-label', `Go to ${section}`);
            dot.addEventListener('click', () => showSlide(firstSlide));
            sectionNav.appendChild(dot);
        });
    }

    function updateSectionNav() {
        const activeSection = slides[current].dataset.section;
        const sections = [];
        slides.forEach(slide => {
            if (!sections.includes(slide.dataset.section)) sections.push(slide.dataset.section);
        });
        Array.from(sectionNav.children).forEach((dot, index) => {
            dot.classList.toggle('active', sections[index] === activeSection);
        });
    }

    function animateCount(el, duration) {
        const target = parseFloat(el.dataset.count || '0');
        const decimals = parseInt(el.dataset.decimals || '0', 10);
        const start = performance.now();
        function tick(now) {
            const pct = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - pct, 3);
            el.textContent = (target * eased).toFixed(decimals);
            if (pct < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function resetStats() {
        slideFiveAnimated = false;
        document.querySelectorAll('#barChart .bar-fill').forEach(bar => { bar.style.transition = 'none'; bar.style.width = '0%'; });
        document.querySelectorAll('#barChart .count-up, .stat-number .count-up').forEach(el => { el.textContent = '0'; });
        requestAnimationFrame(() => document.querySelectorAll('#barChart .bar-fill').forEach(bar => { bar.style.transition = ''; }));
    }

    function animateStats() {
        if (slideFiveAnimated) return;
        slideFiveAnimated = true;
        const stat = document.querySelector('.stat-number .count-up');
        if (stat) setTimeout(() => animateCount(stat, 1600), 400);
        const fills = document.querySelectorAll('#barChart .bar-fill');
        const barCounts = document.querySelectorAll('#barChart .count-up');
        fills.forEach((bar, index) => {
            setTimeout(() => {
                bar.style.width = `${bar.dataset.width || 0}%`;
                if (barCounts[index]) animateCount(barCounts[index], 1000);
            }, 600 + index * 200);
        });
    }

    function showSlide(index) {
        const previous = current;
        current = Math.max(0, Math.min(index, slides.length - 1));
        slides.forEach((slide, idx) => slide.classList.toggle('active', idx === current));
        document.body.classList.toggle('controls-on-light', slides[current].classList.contains('slide-light'));
        try { writeStorage(STORAGE_KEYS.slide, String(current)); } catch (e) { }
        progressFill.style.width = `${((current + 1) / slides.length) * 100}%`;
        slideCounter.textContent = `${current + 1} / ${slides.length}`;
        updateSectionNav();
        if ((previous === 0) !== (current === 0)) scaleStage();
        document.body.style.background = getComputedStyle(slides[current]).backgroundColor;
        if (current === 2) animateStats();
        if (previous === 2 && current !== 2) resetStats();
        clearSelection();
    }

    window.showSlide = showSlide;

    function selectElement(el) {
        if (!editMode || !el) return;
        clearSelection();
        selected = el;
        selected.classList.add('selected-edit');
        if (selected.classList.contains('img-frame') && !selected.querySelector('.edit-handle')) {
            const handle = document.createElement('div');
            handle.className = 'edit-handle';
            selected.appendChild(handle);
        }
        syncPanel();
    }

    function clearSelection() {
        if (selected) selected.classList.remove('selected-edit');
        selected = null;
        syncPanel();
    }

    function syncPanel() {
        const hasSelection = Boolean(selected);
        selectionLabel.textContent = hasSelection ? describeSelection(selected) : 'No element selected';
        const isImage = hasSelection && selected.classList.contains('img-frame');
        const isText = hasSelection && !isImage;
        textControl.disabled = !isText;
        textColor.disabled = !isText;
        fontSize.disabled = !isText;
        textAlign.disabled = !isText;
        imageInput.disabled = !isImage;
        offsetX.disabled = !hasSelection;
        offsetY.disabled = !hasSelection;
        boxWidth.disabled = !hasSelection;
        boxHeight.disabled = !hasSelection;
        cornerRadius.disabled = !hasSelection;
        if (!hasSelection) {
            textControl.value = '';
            fontSize.value = '';
            textAlign.value = '';
            offsetX.value = 0;
            offsetY.value = 0;
            boxWidth.value = '';
            boxHeight.value = '';
            return;
        }
        const cs = getComputedStyle(selected);
        textControl.value = isText ? selected.innerText : '';
        textColor.value = rgbToHex(cs.color) || '#ffffff';
        fontSize.value = isText ? Math.round(parseFloat(cs.fontSize)) : '';
        textAlign.value = isText ? cs.textAlign : '';
        offsetX.value = parseInt(selected.dataset.editX || '0', 10);
        offsetY.value = parseInt(selected.dataset.editY || '0', 10);
        boxWidth.value = Math.round(selected.getBoundingClientRect().width / getScale());
        boxHeight.value = Math.round(selected.getBoundingClientRect().height / getScale());
        cornerRadius.value = parseInt(cs.borderRadius || '4', 10) || 0;
    }

    function describeSelection(el) {
        if (el.classList.contains('img-frame')) return 'Image frame selected';
        const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
        return text ? `Text: ${text.slice(0, 34)}${text.length > 34 ? '…' : ''}` : 'Text element selected';
    }

    function rgbToHex(value) {
        const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return '';
        return '#' + [match[1], match[2], match[3]].map(v => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
    }

    function setOffset(el, x, y) {
        el.dataset.editX = String(Math.round(x));
        el.dataset.editY = String(Math.round(y));
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    function applyPanelValue() {
        if (!selected) return;
        if (!selected.classList.contains('img-frame')) {
            selected.innerText = textControl.value;
            if (textColor.value) selected.style.color = textColor.value;
            if (fontSize.value) selected.style.fontSize = `${fontSize.value}px`;
            selected.style.textAlign = textAlign.value || '';
        }
        const x = parseFloat(offsetX.value || selected.dataset.editX || '0');
        const y = parseFloat(offsetY.value || selected.dataset.editY || '0');
        setOffset(selected, x, y);
        if (boxWidth.value) selected.style.width = `${boxWidth.value}px`;
        if (boxHeight.value) selected.style.height = `${boxHeight.value}px`;
        selected.style.borderRadius = `${cornerRadius.value}px`;
    }

    function setEditableState(enabled) {
        document.querySelectorAll('.editable-text').forEach(el => {
            if (enabled) {
                el.setAttribute('contenteditable', 'true');
                el.setAttribute('spellcheck', 'false');
            } else {
                el.removeAttribute('contenteditable');
                el.removeAttribute('spellcheck');
            }
        });
    }

    function enableEditMode() {
        editMode = true;
        setEditableState(true);
        document.body.classList.add('edit-mode');
        editorPanel.classList.add('open');
        editToggle.textContent = 'Exit Edit';
        document.querySelectorAll('.img-frame').forEach(frame => {
            if (!frame.querySelector('.edit-handle')) {
                const handle = document.createElement('div');
                handle.className = 'edit-handle';
                frame.appendChild(handle);
            }
        });
    }

    function disableEditMode() {
        editMode = false;
        setEditableState(false);
        document.body.classList.remove('edit-mode');
        editorPanel.classList.remove('open');
        editToggle.textContent = 'Visual Edit';
        clearSelection();
    }

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function writeStorage(key, value) {
        localStorage.setItem(key, value);
    }

    function getInitialSlideIndex() {
        const state = readSavedState();
        if (state && Number.isFinite(state.current)) return Math.max(0, Math.floor(state.current));
        if (embeddedState && Number.isFinite(embeddedState.current)) return Math.max(0, Math.floor(embeddedState.current));
        const stored = parseInt(readStorage(STORAGE_KEYS.slide) || '0', 10);
        return Number.isFinite(stored) ? Math.max(0, stored) : 0;
    }

    function cleanClassName(value) {
        return String(value || '')
            .split(/\s+/)
            .filter(Boolean)
            .filter(name => name !== 'active' && name !== 'selected-edit')
            .join(' ');
    }

    function cleanRuntimeDom(root) {
        root.querySelectorAll('[contenteditable]').forEach(el => {
            el.removeAttribute('contenteditable');
            el.removeAttribute('spellcheck');
        });
        root.querySelectorAll('.edit-handle').forEach(el => el.remove());
        root.querySelectorAll('.selected-edit').forEach(el => el.classList.remove('selected-edit'));
        root.querySelectorAll('#barChart .bar-fill').forEach(el => {
            el.style.width = '';
            el.style.transition = '';
        });
        root.querySelectorAll('#barChart .count-up, .stat-number .count-up').forEach(el => {
            el.textContent = '0';
        });
    }

    function cleanSlideHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        cleanRuntimeDom(tmp);
        return tmp.innerHTML;
    }

    function getAttributes(el) {
        return Array.from(el.attributes).reduce((attrs, attr) => {
            attrs[attr.name] = attr.value;
            return attrs;
        }, {});
    }

    function createSlideSnapshot(slide) {
        const clone = slide.cloneNode(true);
        cleanRuntimeDom(clone);
        clone.classList.remove('active');
        return {
            attrs: getAttributes(clone),
            html: clone.innerHTML
        };
    }

    function cloneSlideSnapshot(snapshot) {
        return {
            attrs: Object.assign({}, snapshot.attrs),
            html: snapshot.html
        };
    }

    function normalizeSlideSnapshot(entry, index) {
        const fallback = cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (typeof entry === 'string') {
            fallback.html = cleanSlideHtml(entry);
            return validateSlideSnapshot(fallback, index);
        }
        if (!entry || typeof entry !== 'object') return fallback;
        const snapshot = cloneSlideSnapshot(fallback);
        if (entry.attrs && typeof entry.attrs === 'object') {
            snapshot.attrs = Object.assign({}, fallback.attrs, entry.attrs);
        } else if (typeof entry.className === 'string') {
            snapshot.attrs.class = entry.className;
        }
        if (typeof entry.html === 'string') snapshot.html = cleanSlideHtml(entry.html);
        if (typeof entry.innerHTML === 'string') snapshot.html = cleanSlideHtml(entry.innerHTML);
        snapshot.attrs.class = cleanClassName(snapshot.attrs.class || fallback.attrs.class);
        return validateSlideSnapshot(snapshot, index);
    }

    function validateSlideSnapshot(snapshot, index) {
        const html = snapshot.html || '';
        if (index === 2 && !html.includes('id="barChart"')) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 3 && (html.includes('Fig. 1') || !html.includes('user-pyramid-svg'))) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 8 && !html.includes('data-framework-version="7"')) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 9 && !html.includes('images/图一.png')) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 10 && (!html.includes('images/图八.png') || html.includes('img-frame contain profile-image'))) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 11 && (!html.includes('images/图二.png') || !html.includes('images/图三.png') || !html.includes('finding-slide-expanded') || (html.match(/side-white-pad/g) || []).length < 2)) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 12 && (!html.includes('images/图四.png') || !html.includes('images/图五.png') || !html.includes('finding-slide-expanded') || (html.match(/side-white-pad/g) || []).length < 2)) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 13 && !html.includes('relation-images')) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 15 && (!html.includes('images/图六.png') || !html.includes('side-white-pad') || !html.includes('conclusion-insights') || html.includes('M31 17l2.1'))) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        if (index === 16 && html.includes('images/图七.png')) return cloneSlideSnapshot(originalSlideSnapshots[index]);
        return snapshot;
    }

    function normalizeState(value) {
        if (!value) return null;
        const sourceId = value && typeof value.sourceId === 'string' ? value.sourceId : 'inclusive-design-academic-web';
        const currentSlide = value && Number.isFinite(value.current) ? value.current : null;
        const theme = value && value.theme && typeof value.theme === 'object' ? value.theme : null;
        const rawSlides = Array.isArray(value) ? value : Array.isArray(value.slides) ? value.slides : null;
        if (!rawSlides || rawSlides.length !== slides.length) return null;
        return {
            version: STORAGE_VERSION,
            sourceId,
            current: currentSlide,
            theme,
            slides: rawSlides.map((entry, index) => normalizeSlideSnapshot(entry, index))
        };
    }

    function readLocalState() {
        const saved = readStorage(STORAGE_KEYS.edits);
        if (!saved) return null;
        try {
            return normalizeState(JSON.parse(saved));
        } catch (e) {
            return null;
        }
    }

    function readSavedState() {
        const localState = readLocalState();
        if (embeddedState && embeddedState.skipLocalStorage) {
            if (localState && localState.sourceId && localState.sourceId === embeddedState.sourceId) return localState;
            return null;
        }
        const normalizedEmbeddedState = normalizeState(embeddedState);
        if (normalizedEmbeddedState) {
            if (localState && localState.sourceId && localState.sourceId === normalizedEmbeddedState.sourceId) return localState;
            return normalizedEmbeddedState;
        }
        return localState;
    }

    function getStorageSourceId() {
        return embeddedState && typeof embeddedState.sourceId === 'string' ? embeddedState.sourceId : 'inclusive-design-academic-web';
    }

    function buildCurrentState(sourceId = getStorageSourceId()) {
        return {
            version: STORAGE_VERSION,
            sourceId,
            current,
            theme: {
                sage: themeSage.value,
                gold: themeGold.value
            },
            slides: slides.map(slide => createSlideSnapshot(slide))
        };
    }

    function applySlideSnapshot(slide, snapshot) {
        Array.from(slide.attributes).forEach(attr => slide.removeAttribute(attr.name));
        Object.entries(snapshot.attrs).forEach(([name, value]) => slide.setAttribute(name, value));
        slide.innerHTML = snapshot.html;
    }

    function saveState() {
        try {
            const state = buildCurrentState();
            writeStorage(STORAGE_KEYS.edits, JSON.stringify(state));
            writeStorage(STORAGE_KEYS.theme, JSON.stringify(state.theme));
            saveEdits.textContent = '\u2713 Saved';
            setTimeout(() => { saveEdits.textContent = 'Save Local'; }, 1500);
        } catch (e) {
            alert('Save failed: ' + e.message);
        }
    }

    function loadState() {
        const state = readSavedState();
        if (state) {
            slides.forEach((slide, index) => applySlideSnapshot(slide, state.slides[index]));
            if (!embeddedState) {
                try { writeStorage(STORAGE_KEYS.edits, JSON.stringify(state)); } catch (e) { }
            }
            if (state.theme) {
                if (state.theme.sage) themeSage.value = state.theme.sage;
                if (state.theme.gold) themeGold.value = state.theme.gold;
            }
        }
        if (embeddedState && (!state || !state.theme) && embeddedState.theme) {
            if (embeddedState.theme.sage) themeSage.value = embeddedState.theme.sage;
            if (embeddedState.theme.gold) themeGold.value = embeddedState.theme.gold;
        }
        if (!embeddedState && (!state || !state.theme)) {
            const theme = readStorage(STORAGE_KEYS.theme);
            if (theme) {
                try {
                    const parsed = JSON.parse(theme);
                    if (parsed.sage) themeSage.value = parsed.sage;
                    if (parsed.gold) themeGold.value = parsed.gold;
                } catch (e) { }
            }
        }
        applyTheme();
    }

    function applyTheme() {
        document.documentElement.style.setProperty('--sage-600', themeSage.value);
        document.documentElement.style.setProperty('--gold-400', themeGold.value);
    }

    async function readTextAsset(path, fallbackSelector) {
        try {
            const response = await fetch(path);
            if (response.ok) return await response.text();
        } catch (e) { }
        const fallback = document.querySelector(fallbackSelector);
        if (fallback) return fallback.textContent || '';
        throw new Error(`Unable to read ${path}`);
    }

    function serializeScriptData(value) {
        return JSON.stringify(value)
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
    }

    function isExportableAssetUrl(value) {
        const url = String(value || '').trim();
        return Boolean(url)
            && !url.startsWith('#')
            && !/^(data:|blob:|https?:|mailto:|javascript:)/i.test(url);
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    async function replaceStyleUrls(styleText, resolveAsset) {
        const matches = Array.from(String(styleText || '').matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g));
        let result = styleText;
        for (const match of matches) {
            const assetUrl = match[2].trim();
            if (!isExportableAssetUrl(assetUrl)) continue;
            const embeddedUrl = await resolveAsset(assetUrl);
            result = result.split(match[0]).join(`url("${embeddedUrl}")`);
        }
        return result;
    }

    async function embedLocalAssets(root) {
        const cache = new Map();
        const resolveAsset = async url => {
            const assetUrl = String(url || '').trim();
            if (!isExportableAssetUrl(assetUrl)) return assetUrl;
            const cacheKey = new URL(assetUrl, location.href).href;
            if (!cache.has(cacheKey)) {
                cache.set(cacheKey, fetch(assetUrl)
                    .then(response => {
                        if (!response.ok) throw new Error(`Unable to read ${assetUrl}`);
                        return response.blob();
                    })
                    .then(blobToDataUrl)
                    .catch(() => assetUrl));
            }
            return cache.get(cacheKey);
        };

        await Promise.all(Array.from(root.querySelectorAll('img[src]')).map(async img => {
            const src = img.getAttribute('src');
            if (isExportableAssetUrl(src)) img.setAttribute('src', await resolveAsset(src));
        }));

        await Promise.all(Array.from(root.querySelectorAll('[style]')).map(async el => {
            const style = el.getAttribute('style');
            if (style && style.includes('url(')) el.setAttribute('style', await replaceStyleUrls(style, resolveAsset));
        }));
    }

    async function exportCurrentHtml() {
        exportHtml.textContent = 'Exporting…';
        exportHtml.disabled = true;
        try {
            const [cssText, jsText] = await Promise.all([
                readTextAsset('styles.css', 'style[data-export-styles]'),
                readTextAsset('main.js', 'script[data-export-main]')
            ]);

            const state = buildCurrentState(`inclusive-design-academic-web-export-${Date.now()}`);
            const exportState = Object.assign({}, state, { skipLocalStorage: true });
            const clone = document.documentElement.cloneNode(true);
            const cloneBody = clone.querySelector('body');
            if (cloneBody) {
                cloneBody.classList.remove('edit-mode');
                cloneBody.removeAttribute('style');
            }
            cleanRuntimeDom(clone);
            const panel = clone.querySelector('#editorPanel');
            if (panel) panel.classList.remove('open');
            const toggle = clone.querySelector('#editToggle');
            if (toggle) toggle.textContent = 'Visual Edit';
            const stageEl = clone.querySelector('#stage');
            if (stageEl) {
                stageEl.style.transform = '';
                stageEl.classList.remove('cover-fit');
            }
            const cloneSlides = Array.from(clone.querySelectorAll('.slide'));
            cloneSlides.forEach((slide, index) => {
                applySlideSnapshot(slide, state.slides[index]);
                slide.classList.toggle('active', index === state.current);
            });
            const cloneExport = clone.querySelector('#exportHtml');
            if (cloneExport) {
                cloneExport.textContent = 'Export HTML';
                cloneExport.removeAttribute('disabled');
            }
            const cloneSave = clone.querySelector('#saveEdits');
            if (cloneSave) cloneSave.textContent = 'Save Local';

            await embedLocalAssets(clone);

            clone.querySelectorAll('style[data-export-styles]').forEach(el => el.remove());
            const styleEl = document.createElement('style');
            styleEl.setAttribute('data-export-styles', '');
            styleEl.textContent = cssText;
            const cssLinks = Array.from(clone.querySelectorAll('link[rel="stylesheet"][href*="styles.css"]'));
            if (cssLinks.length) {
                cssLinks[0].replaceWith(styleEl);
                cssLinks.slice(1).forEach(el => el.remove());
            } else {
                clone.querySelector('head')?.appendChild(styleEl);
            }

            clone.querySelectorAll('script').forEach(el => el.remove());
            const stateScript = document.createElement('script');
            stateScript.setAttribute('data-export-state', '');
            stateScript.textContent = `window.INCLUSIVE_ACADEMIC_EMBEDDED_STATE = ${serializeScriptData(exportState)};`;
            const mainScript = document.createElement('script');
            mainScript.setAttribute('data-export-main', '');
            mainScript.textContent = jsText;
            clone.querySelector('body')?.appendChild(stateScript);
            clone.querySelector('body')?.appendChild(mainScript);

            let html = '<!DOCTYPE html>\n' + clone.outerHTML;

            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'inclusive-design-academic-web-edited.html';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 3000);
            exportHtml.textContent = '\u2713 Exported';
            setTimeout(() => { exportHtml.textContent = 'Export HTML'; exportHtml.disabled = false; }, 2000);
        } catch (e) {
            alert('Export failed: ' + e.message);
            exportHtml.textContent = 'Export HTML';
            exportHtml.disabled = false;
        }
    }

    document.getElementById('prevBtn').addEventListener('click', () => showSlide(current - 1));
    document.getElementById('nextBtn').addEventListener('click', () => showSlide(current + 1));
    document.addEventListener('click', e => {
        const jumpTarget = e.target.closest('[data-jump]');
        if (!jumpTarget || editMode) return;
        showSlide(parseInt(jumpTarget.dataset.jump, 10));
    });
    window.addEventListener('resize', scaleStage);

    document.addEventListener('keydown', e => {
        if (editMode && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); showSlide(current + 1); }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); showSlide(current - 1); }
        if (e.key === 'Home') showSlide(0);
        if (e.key === 'End') showSlide(slides.length - 1);
        if (e.key.toLowerCase() === 'e') editMode ? disableEditMode() : enableEditMode();
        if (e.key === 'Escape' && editMode) clearSelection();
    });

    editToggle.addEventListener('click', () => editMode ? disableEditMode() : enableEditMode());
    closeEditor.addEventListener('click', () => editorPanel.classList.remove('open'));

    editorPanel.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', e => {
        if (!editorPanel.classList.contains('open')) return;
        if (e.target === editToggle || editToggle.contains(e.target)) return;
        editorPanel.classList.remove('open');
    });

    const hoverZone = document.querySelector('.edit-hover-zone');
    [hoverZone, editToggle].filter(Boolean).forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (editMode) editorPanel.classList.add('open');
        });
    });

    stage.addEventListener('click', e => {
        if (!editMode) return;
        if (e.target.closest('.edit-handle')) return;
        const target = e.target.closest('.img-frame, .editable-text, .toc-card');
        if (target) selectElement(target);
        else clearSelection();
    }, true);

    stage.addEventListener('input', e => {
        if (!editMode) return;
        const target = e.target.closest('.editable-text');
        if (!target) return;
        if (selected !== target) selectElement(target);
        else syncPanel();
    });

    stage.addEventListener('mousedown', e => {
        if (!editMode) return;
        const handle = e.target.closest('.edit-handle');
        const frame = e.target.closest('.img-frame');
        const target = handle ? handle.parentElement : frame;
        if (!target) return;
        e.preventDefault();
        selectElement(target);
        const scale = getScale();
        if (handle) {
            resize = { el: target, sx: e.clientX / scale, sy: e.clientY / scale, w: target.offsetWidth, h: target.offsetHeight };
        } else {
            drag = { el: target, sx: e.clientX / scale, sy: e.clientY / scale, x: parseFloat(target.dataset.editX || '0'), y: parseFloat(target.dataset.editY || '0') };
        }
    }, true);

    document.addEventListener('mousemove', e => {
        const scale = getScale();
        if (drag) {
            const x = drag.x + (e.clientX / scale - drag.sx);
            const y = drag.y + (e.clientY / scale - drag.sy);
            setOffset(drag.el, x, y);
            if (drag.el === selected) syncPanel();
        }
        if (resize) {
            const w = Math.max(30, resize.w + (e.clientX / scale - resize.sx));
            const h = Math.max(30, resize.h + (e.clientY / scale - resize.sy));
            resize.el.style.width = `${Math.round(w)}px`;
            resize.el.style.height = `${Math.round(h)}px`;
            if (resize.el === selected) syncPanel();
        }
    });

    document.addEventListener('mouseup', () => { drag = null; resize = null; });

    [textControl, textColor, fontSize, textAlign, offsetX, offsetY, boxWidth, boxHeight, cornerRadius].forEach(input => {
        input.addEventListener('input', applyPanelValue);
    });

    imageInput.addEventListener('change', () => {
        if (!selected || !selected.classList.contains('img-frame') || !imageInput.files[0]) return;
        const reader = new FileReader();
        reader.onload = () => {
            const img = selected.querySelector('img');
            if (img) img.src = reader.result;
            imageInput.value = '';
        };
        reader.readAsDataURL(imageInput.files[0]);
    });

    themeSage.addEventListener('input', applyTheme);
    themeGold.addEventListener('input', applyTheme);
    saveEdits.addEventListener('click', saveState);
    resetSlide.addEventListener('click', () => {
        if (!confirm('Reset the current slide to the original file state?')) return;
        const state = buildCurrentState();
        state.slides[current] = cloneSlideSnapshot(originalSlideSnapshots[current]);
        try { writeStorage(STORAGE_KEYS.edits, JSON.stringify(state)); } catch (e) { }
        location.reload();
    });
    resetAll.addEventListener('click', () => {
        if (!confirm('Remove all saved local edits and theme settings?')) return;
        try {
            localStorage.removeItem(STORAGE_KEYS.edits);
            localStorage.removeItem(STORAGE_KEYS.theme);
        } catch (e) { }
        location.reload();
    });
    exportHtml.addEventListener('click', exportCurrentHtml);

    loadState();
    buildSectionNav();
    scaleStage();
    showSlide(current);
})();





