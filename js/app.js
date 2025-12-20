
// GLOBAL ERROR TRAP - captures syntax/runtime errors and shows them on screen
window.onerror = function (msg, url, line, col, error) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed; top:0; left:0; width:100%; z-index:9999; background:red; color:white; padding:20px; font-family:monospace; white-space:pre-wrap;';
    div.textContent = `CRITICAL ERROR:\n${msg}\nLine: ${line}:${col}\nURL: ${url}\nError: ${error ? error.stack : 'N/A'}`;
    document.body.appendChild(div);
    return false;
};

// Catch Async Errors
window.addEventListener('unhandledrejection', function (event) {
    window.onerror("Unhandled Promise Rejection: " + event.reason, "Async", 0, 0, event.reason);
});

// State
const state = {
    data: null,
    graphData: { nodes: [], links: [] },
    currentLang: 'CN',
    currentView: 'mindmap',
    sidebarPinned: true,
    filters: {
        chapter: 'all',
        req: 'all',
        search: ''
    },
    colors: [
        '#ef476f', '#ffd166', '#06d6a0', '#118ab2',
        '#073b4c', '#9d4edd', '#ff9f1c', '#f72585'
    ],
    reqColors: {
        '识记': '#4cc9f0',
        '领会': '#4361ee',
        '简单应用': '#f72585',
        '综合应用': '#e63946'
    },
    expandedNodes: new Set(['root'])
};

// DOM Elements Container
const els = {
    app: null,
    graphContainer: null,
    waterfallContainer: null,
    waterfallList: null,
    chapterNav: null,
    chapterList: null,
    sidebarDetail: null,
    openSidebarBtn: null,
    closeNavBtn: null,
    pinNavBtn: null,
    controls: {},
    detail: {}
};

let Graph = null;

// Helper
function safeTitle(title) {
    if (!title) return '';
    if (title.indexOf('《') !== -1) {
        const parts = title.split('《');
        if (parts.length > 1) {
            return parts[1].split('》')[0];
        }
    }
    return title;
}

// Main Init
document.addEventListener('DOMContentLoaded', () => {
    try {
        els.app = document.getElementById('app');
        els.graphContainer = document.getElementById('graph-container');
        els.waterfallContainer = document.getElementById('waterfall-container');
        els.waterfallList = document.getElementById('waterfall-list');
        els.chapterNav = document.getElementById('chapter-nav');
        els.chapterList = document.getElementById('chapter-list');
        els.sidebarDetail = document.getElementById('detail-sidebar');
        els.openSidebarBtn = document.getElementById('open-sidebar-btn');
        els.closeNavBtn = document.getElementById('close-nav');
        els.pinNavBtn = document.getElementById('pin-nav');
        
        // Mobile check: Unpin by default
        if (window.innerWidth <= 768) {
            state.sidebarPinned = false;
        }

        if (state.sidebarPinned) {
            document.body.classList.add('pinned');
            if (els.pinNavBtn) els.pinNavBtn.classList.add('active');
            if (els.chapterNav) els.chapterNav.classList.remove('closed');
            if (els.openSidebarBtn) els.openSidebarBtn.classList.add('hidden');
        } else {
            // Ensure closed on start if not pinned
            if (els.chapterNav) els.chapterNav.classList.add('closed');
        }

        els.controls = {
            search: document.getElementById('search-input'),
            // filterChapter: document.getElementById('filter-chapter'), // Removed
            // filterReq: document.getElementById('filter-req'), // Removed
            langToggle: document.getElementById('lang-toggle'),
            viewMindmap: document.querySelector('[data-view="mindmap"]'),
            viewWaterfall: document.querySelector('[data-view="waterfall"]'), // exportBtn removed
            btnReset: document.getElementById('btn-reset'),
            btnZoomIn: document.getElementById('btn-zoom-in'),
            btnZoomOut: document.getElementById('btn-zoom-out')
        };

        els.detail = {
            title: document.getElementById('detail-title'),
            id: document.getElementById('detail-id'),
            req: document.getElementById('detail-req'),
            defEn: document.getElementById('detail-def-en'),
            defCn: document.getElementById('detail-def-cn'),
            exEn: document.getElementById('detail-ex-en'),
            exCn: document.getElementById('detail-ex-cn')
        };

        if (!els.detail.title) {
            throw new Error("Critical UI elements missing (detail view). Check HTML.");
        }

        initApp();
    } catch (e) {
        throw new Error("DOM Binding Failed: " + e.message);
    }
});

async function initApp() {
    try {
        const res = await fetch('data.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error("Fetch failed: " + res.status);
        state.data = await res.json();

        if (state.data && state.data.chapters) {
            state.data.chapters.forEach(c => state.expandedNodes.add(`c-${c.id}`));
        } else {
            throw new Error("Invalid Data Structure");
        }

        processGraphData();
        initUI();

        if (typeof ForceGraph !== 'function') {
            throw new Error("ForceGraph library not loaded. Check internet connection.");
        }

        renderGraph();
        renderWaterfall();
        updateBilingualUI();

        if (els.openSidebarBtn) els.openSidebarBtn.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        if (els.app) {
            els.app.innerHTML = `<div style="padding:40px; color:white; font-size:18px;">
                <h2>Application Error</h2>
                <p>${e.message}</p>
             </div>`;
        }
    }
}

function processGraphData() {
    const nodes = [];
    const links = [];

    nodes.push({ id: 'root', name: 'Linguistics', val: 30, color: '#ffffff', type: 'root' });

    state.data.chapters.forEach((chapter, idx) => {
        const chapterColor = state.colors[idx % state.colors.length];
        const chapterId = `c-${chapter.id}`;

        nodes.push({
            id: chapterId,
            name: chapter.title,
            name_en: `Chapter ${chapter.id}`,
            name_cn: `第${chapter.id}章`,
            shortName: `C${chapter.id}`,
            val: 20,
            color: chapterColor,
            type: 'chapter',
            raw: chapter
        });

        links.push({ source: 'root', target: chapterId });

        chapter.sections.forEach((sec, sIdx) => {
            const secId = `s-${chapter.id}-${sec.id}`;
            const secTitleSimple = sec.title.split('（')[0] || sec.title;

            nodes.push({
                id: secId,
                name: sec.title,
                name_en: sec.title.replace(/[\u4e00-\u9fa5]/g, '').replace(/[（）()]/g, '').trim(),
                name_cn: secTitleSimple,
                val: 12,
                color: chapterColor,
                type: 'section',
                chapterId: chapter.id,
                sectionIdx: sIdx + 1,
                raw: sec
            });
            links.push({ source: chapterId, target: secId });

            sec.knowledgePoints.forEach(kp => {
                const reqColor = state.reqColors[kp.requirement] || '#cccccc';
                const initials = (kp.title_en || 'KP').split(' ')
                    .map(w => w[0])
                    .filter(c => /[A-Z]/.test(c))
                    .join('')
                    .substring(0, 3);

                // FIX: Ensure globally unique ID
                const uniqueKpId = `kp-${chapter.id}-${kp.id}`;

                nodes.push({
                    id: uniqueKpId,
                    name: kp.title_cn,
                    name_en: kp.title_en,
                    name_cn: kp.title_cn,
                    initials: initials,
                    val: 8,
                    color: reqColor,
                    type: 'point',
                    raw: kp,
                    chapterId: chapter.id,
                    sectionIdx: sIdx + 1,
                    sectionTitle: secTitleSimple,
                    sectionIdFull: secId
                });
                links.push({ source: secId, target: uniqueKpId });
            });
        });
    });

    state.graphData = { nodes, links };
}

function getFilteredGraphData() {
    let { nodes, links } = state.graphData;

    // 1. Global Filters
    nodes = nodes.filter(n => {
        if (n.type === 'root') return true;

        const matchChapter = state.filters.chapter === 'all' || n.chapterId == state.filters.chapter;
        // console.log(`Node ${n.id} Ch:${n.chapterId} Filter:${state.filters.chapter} Match:${matchChapter}`);
        if (!matchChapter) return false;

        if (n.type === 'point') {
            const matchSearch = state.filters.search === '' ||
                n.name_cn.includes(state.filters.search) ||
                n.name_en.toLowerCase().includes(state.filters.search.toLowerCase());

            const matchReq = state.filters.req === 'all' || (n.raw && n.raw.requirement === state.filters.req);

            return matchSearch && matchReq;
        }
        return true;
    });

    // 2. Collapse Logic
    const visibleNodeIds = new Set(['root']);

    if (state.expandedNodes.has('root')) {
        nodes.forEach(n => {
            if (n.type === 'chapter') {
                if (state.filters.chapter === 'all' || n.raw.id == state.filters.chapter) {
                    visibleNodeIds.add(n.id);
                }
            }
        });
    }

    // Now iteratively add children of visible & expanded nodes
    for (let i = 0; i < 3; i++) {
        links.forEach(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;

            if (visibleNodeIds.has(sId) && state.expandedNodes.has(sId)) {
                if (nodes.find(n => n.id === tId)) {
                    visibleNodeIds.add(tId);
                }
            }
        });
    }

    const finalNodes = nodes.filter(n => visibleNodeIds.has(n.id));
    const finalLinks = links.filter(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return visibleNodeIds.has(sId) && visibleNodeIds.has(tId);
    });

    return { nodes: finalNodes, links: finalLinks };
}

function initUI() {

    // Chip Buttons
    const chips = document.querySelectorAll('.chip-btn');
    chips.forEach(btn => {
        btn.addEventListener('click', () => {
            const req = btn.getAttribute('data-req');
            if (state.filters.req === req) {
                // Toggle off
                state.filters.req = 'all';
                btn.classList.remove('active');
            } else {
                // Toggle on
                state.filters.req = req;
                chips.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            updateView();
        });
    });

    if (els.controls.langToggle) els.controls.langToggle.addEventListener('click', toggleLang);
    if (els.controls.viewMindmap) els.controls.viewMindmap.addEventListener('click', () => switchView('mindmap'));
    if (els.controls.viewWaterfall) els.controls.viewWaterfall.addEventListener('click', () => switchView('waterfall'));

    // Waterfall Background Click
    if (els.waterfallContainer) {
        els.waterfallContainer.addEventListener('click', () => {
            if (els.sidebarDetail) els.sidebarDetail.classList.add('hidden');
        });
    }

    if (els.controls.btnReset) {
        els.controls.btnReset.addEventListener('click', () => {
            if (Graph) {
                Graph.zoomToFit(400);
                state.filters.search = '';
                els.controls.search.value = '';

                // Reset chips
                state.filters.req = 'all';
                chips.forEach(b => b.classList.remove('active'));

                updateView();
            }
        });
    }

    if (els.controls.btnZoomIn) els.controls.btnZoomIn.addEventListener('click', () => { if (Graph) Graph.zoom(Graph.zoom() * 1.2, 200); });
    if (els.controls.btnZoomOut) els.controls.btnZoomOut.addEventListener('click', () => { if (Graph) Graph.zoom(Graph.zoom() / 1.2, 200); });

    if (els.openSidebarBtn) {
        els.openSidebarBtn.addEventListener('click', () => {
            els.chapterNav.classList.remove('closed');
            els.openSidebarBtn.classList.add('hidden');
        });
    }

    if (els.closeNavBtn) {
        els.closeNavBtn.addEventListener('click', () => {
            els.chapterNav.classList.add('closed');
            els.openSidebarBtn.classList.remove('hidden');
            if (state.sidebarPinned) togglePin();
        });
    }

    if (els.pinNavBtn) els.pinNavBtn.addEventListener('click', togglePin);

    if (document.getElementById('close-detail')) {
        document.getElementById('close-detail').addEventListener('click', () => {
            els.sidebarDetail.classList.add('hidden');
        });
    }

    if (els.controls.exportBtn) {
        els.controls.exportBtn.addEventListener('click', () => {
            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
                script.onload = () => { exportImage(); };
                document.head.appendChild(script);
            } else {
                exportImage();
            }
        });
    }
}

function togglePin() {
    state.sidebarPinned = !state.sidebarPinned;
    if (state.sidebarPinned) {
        document.body.classList.add('pinned');
        els.pinNavBtn.classList.add('active');
        els.chapterNav.classList.remove('closed');
        els.openSidebarBtn.classList.add('hidden');
    } else {
        document.body.classList.remove('pinned');
        els.pinNavBtn.classList.remove('active');
    }
}

function exportImage() {
    // 1. Show Loading Indicator
    const loading = document.createElement('div');
    loading.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); color: white;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        z-index: 9999; font-family: sans-serif;
    `;
    loading.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 20px;"></i>
                         <div style="font-size: 1.5rem;">Generating Image... Please wait.</div>`;
    document.body.appendChild(loading);

    // Give browser time to render loader
    setTimeout(() => {
        const isWaterfall = state.currentView === 'waterfall';
        let target, options;

        if (isWaterfall) {
            // Waterfall Capture
            target = els.waterfallContainer;

            // To capture full scroll height, we clone the node to avoid scroll/overflow constraints of the viewport
            // However, cloning loses the 'stars' background which is on #app/body. 
            // Better approach: temporarily style the container to auto height to expand fully.

            const originalStyles = {
                height: target.style.height,
                overflow: target.style.overflow,
                position: target.style.position
            };

            // Expand to full height
            target.style.height = 'auto';
            target.style.overflow = 'visible';
            target.style.position = 'relative'; // ensure z-index context

            // We also need to ensure the parent #app allows expansion? #app is height: 100% hidden.
            // If we only capture "target", html2canvas will restart the stacking context.
            // To keep the background, we might need a background color on the container if 'stars' are outside.
            // But let's verify if waterfall container has a background.
            // If we just capture 'target', we get the list content. If transparent, it might be weird.
            // Let's force a dark background on waterfall export to be safe and clean.

            options = {
                backgroundColor: '#050510', // Dark background to match theme
                scale: 2, // Better resolution
                scrollY: -window.scrollY,
                height: target.scrollHeight,
                windowHeight: target.scrollHeight
            };

            html2canvas(target, options).then(processCanvas).finally(() => {
                // Restore styles
                target.style.height = originalStyles.height;
                target.style.overflow = originalStyles.overflow;
                target.style.position = originalStyles.position;
                document.body.removeChild(loading);
            });

        } else {
            // Mind Map Capture (Canvas)
            // Just capture the body or app, usually fits viewport.
            options = {
                backgroundColor: '#050510',
                scale: 2
            };
            html2canvas(document.body, options).then(processCanvas).finally(() => {
                document.body.removeChild(loading);
            });
        }
    }, 100);
}

function processCanvas(canvas) {
    const link = document.createElement('a');
    link.download = `linguistics_${state.currentView}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

function processFilterOptions() {
    // 3-Level Sidebar: Chapter -> Section -> Knowledge Point
    els.chapterList.innerHTML = '';
    if (!state.data) return;

    state.data.chapters.forEach(c => {
        const item = document.createElement('div');
        item.className = 'chapter-item';

        // Level 1: Chapter
        const btn = document.createElement('button');
        btn.className = 'chapter-btn';
        if (state.expandedNodes.has(`c-${c.id}`)) btn.classList.add('active');

        // Toggle Icon helper
        const updateChapterIcon = (collapsed) => {
            const icon = btn.querySelector('i');
            icon.className = collapsed ? 'fa-solid fa-folder' : 'fa-solid fa-folder-open';
        };

        btn.innerHTML = `<i class="fa-solid fa-folder"></i> 第${c.id}章`;
        btn.onclick = () => {
            const secList = item.querySelector('.section-list');
            if (secList) {
                const isHidden = secList.classList.toggle('hidden');
                updateChapterIcon(isHidden);
            }
            handleSidebarClick(`c-${c.id}`, 'chapter');
        };
        item.appendChild(btn);

        // Level 2: Section
        const secList = document.createElement('div');
        secList.className = 'section-list hidden';

        c.sections.forEach(s => {
            const secItem = document.createElement('div');
            secItem.className = 'section-item';

            const secBtn = document.createElement('button');
            secBtn.className = 'section-btn';
            const sTitle = s.title.split('（')[0] || s.title;

            // Toggle Icon helper for section
            const updateSectionIcon = (collapsed) => {
                const icon = secBtn.querySelector('i');
                icon.className = collapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down';
            };

            secBtn.innerHTML = `<i class="fa-solid fa-chevron-right"></i> ${sTitle}`;
            secBtn.onclick = (e) => {
                e.stopPropagation();
                const kpList = secItem.querySelector('.kp-list');
                if (kpList) {
                    const isHidden = kpList.classList.toggle('hidden');
                    updateSectionIcon(isHidden);
                }
                handleSidebarClick(`s-${c.id}-${s.id}`, 'section');
            };
            secItem.appendChild(secBtn);

            // Level 3: Knowledge Points
            const kpList = document.createElement('div');
            kpList.className = 'kp-list hidden';

            s.knowledgePoints.forEach(kp => {
                const kpBtn = document.createElement('button');
                kpBtn.className = 'kp-btn';

                const pTitle = state.currentLang === 'CN' ? kp.title_cn : (kp.title_en || kp.title_cn);
                const reqColor = state.reqColors[kp.requirement] || '#888';

                // Tech-style dot
                kpBtn.innerHTML = `<span class="kp-dot" style="background:${reqColor}"></span> ${pTitle}`;

                kpBtn.onclick = (e) => {
                    e.stopPropagation();
                    const uniqueKpId = `kp-${c.id}-${kp.id}`;
                    showDetail(kp, reqColor);
                    handleSidebarClick(uniqueKpId, 'point');

                    // Active state styling
                    document.querySelectorAll('.kp-btn').forEach(b => b.classList.remove('active'));
                    kpBtn.classList.add('active');
                };
                kpList.appendChild(kpBtn);
            });
            secItem.appendChild(kpList);

            secList.appendChild(secItem);
        });

        item.appendChild(secList);
        els.chapterList.appendChild(item);
    });
}

function renderGraph() {
    const elem = els.graphContainer;
    const { nodes, links } = getFilteredGraphData();

    Graph = ForceGraph()(elem)
        .graphData({ nodes, links })
        .backgroundColor('#050510')
        .nodeColor('color')
        .nodeVal('val')
        .linkColor(() => 'rgba(255,255,255,0.15)')
        .onNodeClick(handleNodeClick)
        .onBackgroundClick(() => {
            if (els.sidebarDetail) els.sidebarDetail.classList.add('hidden');
        })
        .enableNodeDrag(true)
        .enableZoomInteraction(true)
        .enablePanInteraction(true)
        .d3AlphaDecay(0.04)
        .d3VelocityDecay(0.3)
        .d3Force('charge', d3.forceManyBody().strength(node => {
            if (node.type === 'root') return -1000;
            if (node.type === 'chapter') return -800;
            return -250;
        }))
        .d3Force('collide', d3.forceCollide(node => Math.sqrt(node.val) * 4 + 15))
        .d3Force('radial', d3.forceRadial(node => {
            if (node.type === 'root') return 0;
            if (node.type === 'chapter') return 80;
            if (node.type === 'section') return 200;
            return 350;
        }, 0, 0).strength(0.15))
        .nodeCanvasObject((node, ctx, globalScale) => {
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

            const label = state.currentLang === 'CN' ? (node.name_cn || node.name) : (node.name_en || node.name);
            const fontSize = 12 / globalScale;

            // --- SCI-FI COLOR PALETTE ---
            let baseColor = node.color; // Use the inherent color for differentiation
            if (node.type === 'root') baseColor = '#ffffff';

            const isActive = state.expandedNodes.has(node.id);

            // --- DRAW NODE ---
            if (node.type === 'root') {
                // Nucleus - Glowing Core
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ffffff';
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Orbit Rings
                ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val + 8, 0, 2 * Math.PI);
                ctx.stroke();

            } else if (node.type === 'chapter') {
                // Hexagon (Tech Hub)
                ctx.shadowBlur = isActive ? 15 : 0;
                ctx.shadowColor = baseColor;

                ctx.fillStyle = 'rgba(5, 5, 16, 0.9)'; // Dark Fill
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Inner Tech Graphic
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val * 0.4, 0, 2 * Math.PI);
                ctx.fillStyle = baseColor;
                ctx.fill();

                // Rotating Ring Segment
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val + 3, -1, 1);
                ctx.strokeStyle = baseColor;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val + 3, Math.PI - 1, Math.PI + 1);
                ctx.stroke();

            } else if (node.type === 'section') {
                // Satellite
                ctx.fillStyle = baseColor;
                ctx.shadowBlur = isActive ? 10 : 0;
                ctx.shadowColor = baseColor;

                ctx.beginPath();
                ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Outer Ring
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 7, 0, 2 * Math.PI);
                ctx.stroke();

            } else {
                // Knowledge Point (Star/Particle)
                const reqColor = node.color; // Use requirement color
                ctx.fillStyle = reqColor;

                if (isActive) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = reqColor;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // Crosshair / Target reticle
                    ctx.strokeStyle = reqColor;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
                    ctx.stroke();
                } else {
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 2.5, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }

            // --- LABELS ---
            const showLabel = globalScale > 1.2 || node.type === 'root' || node.type === 'chapter' || isActive;

            if (showLabel) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const scaledFont = Math.max(10, fontSize);
                ctx.font = `${node.type === 'chapter' ? 'bold' : ''} ${scaledFont}px "Outfit", "Segoe UI", sans-serif`;

                let ly = node.y + node.val + 8;
                if (node.type === 'point') ly = node.y + 12;

                // Tech Text Style: No Box, just Glow & Shadow
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; // Stroke text for contrast
                ctx.strokeText(label, node.x, ly);

                // Reset shadow for fill
                ctx.shadowBlur = 0;
                // Text Color
                if (isActive) ctx.fillStyle = '#fff';
                else if (node.type === 'chapter') ctx.fillStyle = baseColor; // Use chapter color
                else ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

                ctx.fillText(label, node.x, ly);

                // Sub-label for Chapters (ID)
                if (node.type === 'chapter') {
                    ctx.font = `bold ${fontSize * 0.8}px monospace`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.fillText(`C${node.raw.id}`, node.x, node.y);
                }
            }
        });
}

// function updateView() { ... } replaced by debounced version below

function handleNodeClick(node) {
    try {
        if (node.type === 'point') {
            showDetail(node.raw, node.color);
            Graph.centerAt(node.x, node.y, 1000);
            Graph.zoom(3, 2000);
        } else {
            if (state.expandedNodes.has(node.id)) {
                state.expandedNodes.delete(node.id);
            } else {
                state.expandedNodes.add(node.id);
            }
            updateView();
            Graph.centerAt(node.x, node.y, 1000);
        }
    } catch (e) {
        window.onerror("Node Click Error: " + e.message, "app.js", 0, 0, e);
    }
}

function handleSidebarClick(id, type) {
    try {
        if (state.currentView === 'waterfall') {
            let anchorId = '';
            if (type === 'chapter') {
                anchorId = `wf-grid-${id.split('-')[1]}`;
            } else {
                const parts = id.split('-');
                anchorId = `wf-grid-${parts[1]}`;
            }
            const el = document.getElementById(anchorId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.parentElement.style.backgroundColor = '#333';
                setTimeout(() => el.parentElement.style.backgroundColor = '', 500);
            }
        } else {
            if (type !== 'point') state.expandedNodes.add(id);
            if (type === 'section') {
                const parts = id.split('-');
                state.expandedNodes.add(`c-${parts[1]}`);
            }
            updateView();
            setTimeout(() => {
                const node = Graph.graphData().nodes.find(n => n.id === id);
                if (node) {
                    Graph.centerAt(node.x, node.y, 1000);
                    Graph.zoom(type === 'chapter' ? 1.5 : 3, 2000);
                }
            }, 100);
        }

        if (!state.sidebarPinned) {
            els.chapterNav.classList.add('closed');
            els.openSidebarBtn.classList.remove('hidden');
        }
    } catch (e) {
        window.onerror("Sidebar Click Error: " + e.message, "app.js", 0, 0, e);
    }
}

function showDetail(data, color) {
    try {
        if (!els.detail || !els.detail.title) {
            throw new Error("Detail elements not initialized");
        }
        els.sidebarDetail.classList.remove('hidden');
        els.detail.title.style.borderLeft = `4px solid ${color}`;
        const isCN = state.currentLang === 'CN';
        els.detail.title.textContent = isCN ? data.title_cn : data.title_en;
        els.detail.id.textContent = `ID: ${data.id}`;
        els.detail.req.textContent = data.syllabus_req || data.requirement;
        els.detail.defEn.textContent = data.definition_en;
        els.detail.defCn.textContent = data.definition_cn;
        els.detail.exEn.textContent = data.example_en;
        els.detail.exCn.textContent = data.example_cn;
    } catch (e) {
        window.onerror("Show Detail Error: " + e.message, "app.js", 0, 0, e);
    }
}

function renderWaterfall() {
    try {
        const list = els.waterfallList;
        list.innerHTML = '';

        state.data.chapters.forEach((chapter, idx) => {
            const cColor = state.colors[idx % state.colors.length];
            const chapterSection = document.createElement('div');
            chapterSection.className = 'wf-chapter-section';
            const cTitle = safeTitle(chapter.title);
            const title = state.currentLang === 'CN' ?
                `第${chapter.id}章 ${cTitle}` :
                `Chapter ${chapter.id}`;

            chapterSection.innerHTML = `
                <div class="wf-chapter-header" style="border-left: 5px solid ${cColor}">
                    <h3>${title}</h3>
                </div>
                <div class="wf-grid" id="wf-grid-${chapter.id}"></div>
            `;
            list.appendChild(chapterSection);

            const grid = document.getElementById(`wf-grid-${chapter.id}`);
            const cPoints = [];
            chapter.sections.forEach(s => s.knowledgePoints.forEach(kp => {
                kp.tempSectionTitle = s.title.split('（')[0] || s.title;
                cPoints.push(kp);
            }));

            let hasPoints = false;
            cPoints.forEach(p => {
                const matchSearch = state.filters.search === '' ||
                    p.title_cn.includes(state.filters.search) ||
                    p.title_en.toLowerCase().includes(state.filters.search.toLowerCase());
                const matchReq = state.filters.req === 'all' || p.requirement === state.filters.req;
                if (!matchSearch || !matchReq) return;
                hasPoints = true;

                const card = document.createElement('div');
                card.className = 'wf-card';
                const rColor = state.reqColors[p.requirement] || '#ccc';
                card.style.borderTop = `3px solid ${rColor}`;
                const pTitle = state.currentLang === 'CN' ? p.title_cn : p.title_en;

                const sectionTag = `<span class="badge" style="background:#333; color:#aaa; margin-right:5px;">${p.tempSectionTitle}</span>`;

                card.innerHTML = `
                    <div class="wf-title">${pTitle}</div>
                    <div class="wf-meta">
                        ${sectionTag}
                        <span class="badge" style="background:${rColor}22; color:${rColor}">${p.requirement}</span>
                    </div>
                    <div class="wf-desc">${p.definition_cn}</div>
                `;
                card.onclick = (e) => {
                    e.stopPropagation();
                    showDetail(p, rColor);
                };
                grid.appendChild(card);
            });
            if (!hasPoints) chapterSection.style.display = 'none';
        });
    } catch (e) {
        window.onerror("Render Waterfall Error: " + e.message, "app.js", 0, 0, e);
    }
}


let viewUpdateTimer = null;

function updateView() {
    // Debounce to break the stack trace, preventing some extension hooks from crashing
    if (viewUpdateTimer) clearTimeout(viewUpdateTimer);
    viewUpdateTimer = setTimeout(() => {
        try {
            if (state.currentView === 'mindmap') {
                const newData = getFilteredGraphData();
                if (Graph) {
                    Graph.graphData(newData);
                } else {
                    console.warn("Graph instance not found during update");
                }
            } else {
                renderWaterfall();
            }
        } catch (e) {
            window.onerror("Update View Error: " + e.message, "app.js", 0, 0, e);
        }
    }, 10);
}

function updateBilingualUI() { processFilterOptions(); }
function toggleLang() { state.currentLang = state.currentLang === 'CN' ? 'EN' : 'CN'; updateBilingualUI(); updateView(); }

function switchView(view) {
    try {
        state.currentView = view;
        if (view === 'mindmap') {
            els.graphContainer.style.visibility = 'visible';
            els.waterfallContainer.classList.add('hidden');
            els.controls.viewMindmap.classList.add('active');
            els.controls.viewWaterfall.classList.remove('active');

            // Delay refresh to avoid layout trashing/race conditions
            setTimeout(() => {
                if (Graph && els.graphContainer) {
                    Graph.width(els.graphContainer.clientWidth);
                    Graph.height(els.graphContainer.clientHeight);
                }
            }, 50);

        } else {
            els.graphContainer.style.visibility = 'hidden';
            els.waterfallContainer.classList.remove('hidden');
            els.controls.viewMindmap.classList.remove('active');
            els.controls.viewWaterfall.classList.add('active');
            renderWaterfall();
        }
    } catch (e) {
        window.onerror("Switch View Error: " + e.message, "app.js", 0, 0, e);
    }
}
function adjustColor(color, amount) { return color; }
