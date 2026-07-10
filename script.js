// ==========================================
// CONFIGURATION FIREBASE (POUR LE MULTIJOUEUR)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA-PpJIS12iljNZXaehqWNy4ksvEETc-WE",
    authDomain: "lscpd-board.firebaseapp.com",
    projectId: "lscpd-board",
    storageBucket: "lscpd-board.firebasestorage.app",
    messagingSenderId: "604800478466",
    appId: "1:604800478466:web:195aa1d95391eee43ea61b",
    measurementId: "G-JCTWN4CH2B"
};

// Si tu as bien mis ta clé, Firebase s'activera !
let db = null;
if (firebaseConfig.apiKey !== "TON_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}
// ==========================================

const board = document.getElementById('board');
const linesContainer = document.getElementById('lines-container');
const toolbar = document.getElementById('toolbar');

const addTextBtn = document.getElementById('add-text-btn');
const addNoteBtn = document.getElementById('add-note-btn');
const addPhotoBtn = document.getElementById('add-photo-btn');
const linkBtn = document.getElementById('link-btn');
const moveAllBtn = document.getElementById('move-all-btn');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');

const loginBtn = document.getElementById('login-btn');
const adminBtn = document.getElementById('admin-btn');
const logoutBtn = document.getElementById('logout-btn');
const adminModal = document.getElementById('admin-modal');
const adminCloseBtn = document.getElementById('admin-close-btn');
const adminCaseList = document.getElementById('admin-case-list');

const photoModal = document.getElementById('photo-modal');
const photoUrlInput = document.getElementById('photo-url');
const photoCaptionInput = document.getElementById('photo-caption');
const photoCancelBtn = document.getElementById('photo-cancel');
const photoConfirmBtn = document.getElementById('photo-confirm');

const zoomSlider = document.getElementById('zoom-slider');
const boardContent = document.getElementById('board-content');
const caseNameInput = document.getElementById('case-name-input');
const loadCaseBtn = document.getElementById('load-case-btn');
const newCaseBtn = document.getElementById('new-case-btn');
const renameCaseBtn = document.getElementById('rename-case-btn');

let currentZoom = 0.8;
let currentCaseId = localStorage.getItem('lscpd_last_case') || '';
let unsubscribeSnapshot = null;
let isFirstLoad = true;

let editingItemId = null;
let activeTextareaId = null;

let items = [];
let links = [];

let isLinkingMode = false;
let linkStartItem = null;
let isMovingAll = false;

let draggedItem = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragStartX = 0;
let dragStartY = 0;

let isEditor = false;
let isAdmin = false;

function focusOnContent() {
    if (items.length === 0) {
        board.scrollLeft = 2000 - window.innerWidth / 2;
        board.scrollTop = 2000 - window.innerHeight / 2;
        return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    items.forEach(item => {
        if (item.x < minX) minX = item.x;
        if (item.y < minY) minY = item.y;
        if (item.x + 350 > maxX) maxX = item.x + 350;
        if (item.y + 350 > maxY) maxY = item.y + 350;
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    currentZoom = 0.8;
    if (zoomSlider) zoomSlider.value = currentZoom;
    boardContent.style.setProperty('--zoom', currentZoom);

    board.scrollLeft = (centerX * currentZoom) - (window.innerWidth / 2);
    board.scrollTop = (centerY * currentZoom) - (window.innerHeight / 2);
}

function loadData() {
    isFirstLoad = true;
    // Nettoyage visuel avant changement
    items = [];
    links = [];
    boardContent.querySelectorAll('.board-item').forEach(el => el.remove());
    renderLines();

    if (!currentCaseId) {
        console.log("Aucun dossier sélectionné au démarrage.");
        return;
    }

    if (db) {
        console.log(`Firebase activé ! Écoute du dossier: ${currentCaseId}`);
        if (unsubscribeSnapshot) unsubscribeSnapshot();

        unsubscribeSnapshot = db.collection('lscpd').doc(currentCaseId).onSnapshot((doc) => {
            try {
                if (doc.exists) {
                    const data = doc.data();
                    console.log("Données reçues de Firebase:", data);
                    items = data.items || [];
                    links = data.links || [];

                    items.forEach(item => {
                        try {
                            const el = document.getElementById(item.id);
                            if (el) {
                                if (!draggedItem || draggedItem.data.id !== item.id) {
                                    el.style.left = item.x + 'px';
                                    el.style.top = item.y + 'px';
                                }

                                if (item.type === 'note' && activeTextareaId !== item.id) {
                                    const ta = el.querySelector('textarea');
                                    if (ta && ta.value !== (item.content || '')) {
                                        ta.value = item.content || '';
                                        ta.style.height = 'auto';
                                        ta.style.height = (ta.scrollHeight) + 'px';
                                    }
                                    if (ta && ta.style.textAlign !== (item.align || 'left')) {
                                        ta.style.textAlign = item.align || 'left';
                                    }
                                } else if (item.type === 'photo') {
                                    const img = el.querySelector('img');
                                    const caption = el.querySelector('.caption');
                                    if (img && img.src !== item.url) img.src = item.url;
                                    if (caption && caption.innerText !== (item.caption || '')) caption.innerText = item.caption || '';
                                }
                            } else {
                                renderItem(item);
                            }
                        } catch (itemErr) {
                            console.error("Erreur sur l'item", item, itemErr);
                        }
                    });

                    const currentIds = items.map(i => i.id);
                    boardContent.querySelectorAll('.board-item').forEach(el => {
                        if (!currentIds.includes(el.id)) el.remove();
                    });

                    setTimeout(() => {
                        renderLines();
                        if (isFirstLoad) {
                            focusOnContent();
                            isFirstLoad = false;
                        }
                    }, 100);
                } else {
                    console.log("Le document n'existe pas encore. Nouveau dossier !");
                }
            } catch (err) {
                console.error("Erreur fatale dans onSnapshot:", err);
            }
        });
    } else {
        console.log(`Mode Solo (Local). Dossier: ${currentCaseId}`);
        const savedData = localStorage.getItem(`lscpd_board_${currentCaseId}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            items = data.items || [];
            links = data.links || [];
            items.forEach(renderItem);
            setTimeout(() => {
                renderLines();
                if (isFirstLoad) {
                    focusOnContent();
                    isFirstLoad = false;
                }
            }, 100);
        }
    }
}

function updateAuthUI() {
    document.querySelectorAll('.editor-only').forEach(el => {
        el.style.display = isEditor ? (el.tagName === 'BUTTON' ? 'inline-flex' : 'flex') : 'none';
    });
    if (loginBtn) loginBtn.classList.toggle('hidden', isEditor);
    if (adminBtn) adminBtn.classList.toggle('hidden', !isAdmin);
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !isEditor);
}

function init() {
    const savedRole = localStorage.getItem('lscpd_role');
    if (savedRole === 'detective') {
        isEditor = true;
        isAdmin = false;
    } else if (savedRole === 'admin') {
        isEditor = true;
        isAdmin = true;
    } else {
        isEditor = false;
        isAdmin = false;
    }
    
    updateAuthUI();

    if (caseNameInput) {
        caseNameInput.value = currentCaseId;
    }

    loadData();

    if (zoomSlider) {
        zoomSlider.addEventListener('input', (e) => {
            currentZoom = parseFloat(e.target.value);
            boardContent.style.setProperty('--zoom', currentZoom);
        });
    }
}

const pinColors = [
    ['#ef4444', '#991b1b'], // Rouge
    ['#3b82f6', '#1e3a8a'], // Bleu
    ['#22c55e', '#166534'], // Vert
    ['#eab308', '#854d0e'], // Jaune
    ['#a855f7', '#581c87'], // Violet
    ['#f97316', '#9a3412'], // Orange
];
const getRandomPin = () => pinColors[Math.floor(Math.random() * pinColors.length)];

if (loadCaseBtn) {
    loadCaseBtn.addEventListener('click', () => {
        const newCase = caseNameInput.value.trim();
        if (newCase === '_config') {
            alert("Nom de dossier réservé par le système !");
            return;
        }
        if (newCase) {
            currentCaseId = newCase;
            localStorage.setItem('lscpd_last_case', currentCaseId);
            loadData();
        }
    });
}

if (newCaseBtn) {
    newCaseBtn.addEventListener('click', () => {
        if(!isEditor) return;
        const newCaseName = prompt("Nom de la NOUVELLE enquête (ex: Gang_Vagos) :");
        if (newCaseName && newCaseName.trim() === '_config') {
            alert("Nom de dossier réservé par le système !");
            return;
        }
        if (newCaseName && newCaseName.trim() !== '') {
            currentCaseId = newCaseName.trim();
            localStorage.setItem('lscpd_last_case', currentCaseId);
            caseNameInput.value = currentCaseId;
            loadData();
        }
    });
}

if (renameCaseBtn) {
    renameCaseBtn.addEventListener('click', () => {
        if (!isEditor) return;
        const newCaseName = prompt("Nouveau nom pour ce dossier :", currentCaseId);
        if (newCaseName && newCaseName.trim() !== '' && newCaseName !== currentCaseId) {
            const oldCaseId = currentCaseId;
            currentCaseId = newCaseName.trim();
            localStorage.setItem('lscpd_last_case', currentCaseId);
            caseNameInput.value = currentCaseId;

            saveData(); // Sauvegarde le tableau dans le nouveau document

            if (db) {
                db.collection('lscpd').doc(oldCaseId).delete().catch(e => console.error(e));
            } else {
                localStorage.removeItem(`lscpd_board_${oldCaseId}`);
            }

            loadData(); // Recharge sur le nouveau document
        }
    });
}

const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const pass = prompt("Veuillez entrer votre mot de passe :");
        if (!pass) return;
        
        if (!db) {
            alert("Erreur : Impossible de contacter la base de données.");
            return;
        }

        try {
            // On essaie d'abord de se connecter en Détective
            try {
                await firebase.auth().signInWithEmailAndPassword('detective@lscpd.local', pass).catch(() => firebase.auth().signInWithEmailAndPassword('detective@lscpd.com', pass));
                isEditor = true;
                isAdmin = false;
                localStorage.setItem('lscpd_role', 'detective');
                updateAuthUI();
                loadData();
                alert("Connexion réussie. Mode Détective (Édition) activé !");
                return;
            } catch (errDetective) {
                // Si ça rate, on essaie en Super Admin
                try {
                    await firebase.auth().signInWithEmailAndPassword('admin@lscpd.local', pass).catch(() => firebase.auth().signInWithEmailAndPassword('admin@lscpd.com', pass));
                    isEditor = true;
                    isAdmin = true;
                    localStorage.setItem('lscpd_role', 'admin');
                    updateAuthUI();
                    loadData();
                    alert("Connexion réussie. Mode Super Admin activé !");
                    return;
                } catch (errAdmin) {
                    // Si les deux échouent, on affiche la vraie erreur Firebase
                    if (errAdmin.code === 'auth/user-not-found' || errAdmin.code === 'auth/wrong-password') {
                        alert("Mot de passe incorrect.");
                    } else if (errAdmin.code === 'auth/unauthorized-domain') {
                        alert("Erreur de sécurité : Tu dois autoriser le domaine 'sadoj-kuro.github.io' dans ton panel Firebase (Authentication > Paramètres > Domaines autorisés).");
                    } else {
                        alert(`Erreur Firebase détaillée :\n\n${errDetective.message}\n\n${errAdmin.message}`);
                    }
                }
            }
        } catch (e) {
            console.error("Erreur Firebase Auth : ", e);
            alert("Erreur de connexion au système d'authentification.");
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        isEditor = false;
        isAdmin = false;
        localStorage.removeItem('lscpd_role');
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().signOut();
        }
        updateAuthUI();
        loadData();
        alert("Déconnexion réussie. Mode Lecture Seule activé.");
    });
}

if (adminBtn) {
    adminBtn.addEventListener('click', () => {
        if (!isAdmin) return;
        adminModal.classList.remove('hidden');
        loadAdminCases();
    });
}

if (adminCloseBtn) {
    adminCloseBtn.addEventListener('click', () => {
        adminModal.classList.add('hidden');
    });
}

function loadAdminCases() {
    if (!db) {
        adminCaseList.innerHTML = '<p style="color: #ef4444; text-align: center;">Firebase non configuré. Mode local uniquement.</p>';
        return;
    }

    adminCaseList.innerHTML = '<p style="color: #666; text-align: center;">Chargement des dossiers...</p>';

    db.collection('lscpd').get().then(snapshot => {
        if (snapshot.empty) {
            adminCaseList.innerHTML = '<p style="color: #aaa; text-align: center;">Aucun dossier trouvé dans la base de données.</p>';
            return;
        }

        adminCaseList.innerHTML = '';
        snapshot.forEach(doc => {
            const caseId = doc.id;
            if (caseId === '_config') return; // Ne pas afficher la config dans la liste des enquêtes
            
            const data = doc.data();
            const itemCount = (data.items || []).length;

            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.padding = '8px';
            div.style.borderBottom = '1px solid #333';

            const info = document.createElement('div');
            info.innerHTML = `<strong style="color: #fff;">${caseId}</strong> <span style="color: #aaa; font-size: 0.8rem;">(${itemCount} éléments)</span>`;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn';
            delBtn.style.backgroundColor = '#ef4444';
            delBtn.style.padding = '4px 8px';
            delBtn.style.fontSize = '0.8rem';
            delBtn.innerHTML = '🗑️ Supprimer';

            delBtn.onclick = () => {
                if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'enquête "${caseId}" ?`)) {
                    db.collection('lscpd').doc(caseId).delete().then(() => {
                        div.remove();
                        if (currentCaseId === caseId) {
                            currentCaseId = '';
                            if (caseNameInput) caseNameInput.value = '';
                            localStorage.removeItem('lscpd_last_case');
                            loadData();
                        }
                    }).catch(err => alert("Erreur de suppression: " + err));
                }
            };

            div.appendChild(info);
            div.appendChild(delBtn);
            adminCaseList.appendChild(div);
        });
    }).catch(err => {
        adminCaseList.innerHTML = `<p style="color: #ef4444; text-align: center;">Erreur: ${err}</p>`;
    });
}

const getCenterPos = (offset) => ({
    x: (board.scrollLeft + window.innerWidth / 2) / currentZoom - offset + (Math.random() * 50 - 25),
    y: (board.scrollTop + window.innerHeight / 2) / currentZoom - offset + (Math.random() * 50 - 25)
});

if (addTextBtn) {
    addTextBtn.addEventListener('click', () => {
        if (!isEditor) return;
        if (!currentCaseId) return alert("Veuillez d'abord entrer un nom de dossier et cliquer sur Charger !");
        
        const id = generateId();
        const pos = getCenterPos(100);
        const item = {
            id,
            type: 'floating-text',
            x: pos.x,
            y: pos.y,
            content: 'Nouveau Texte',
            rotation: Math.random() * 4 - 2,
            textColor: ['#ffffff', '#fca5a5', '#86efac', '#93c5fd', '#fde047'][Math.floor(Math.random() * 5)]
        };
        items.push(item);
        renderItem(item);
        saveData();
    });
}

if (addNoteBtn) {
    addNoteBtn.addEventListener('click', () => {
        if (!isEditor) return;
        if (!currentCaseId) {
            alert("Veuillez d'abord entrer un nom de dossier et cliquer sur Charger !");
            return;
        }
        
        const colors = [
            { bg: '#fef08a', border: '#fde047' }, // Jaune
            { bg: '#bfdbfe', border: '#93c5fd' }, // Bleu
            { bg: '#bbf7d0', border: '#86efac' }, // Vert
            { bg: '#fecdd3', border: '#fda4af' }, // Rose
            { bg: '#fed7aa', border: '#fdba74' }  // Orange
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const id = generateId();
        const pos = getCenterPos(100);
        const item = {
            id,
            type: 'note',
            x: pos.x,
            y: pos.y,
            content: '',
            rotation: Math.random() * 6 - 3,
            pinColor: getRandomPin(),
            bgColor: color.bg,
            borderColor: color.border
        };
        items.push(item);
        renderItem(item);
        saveData();
    });
}

if (addPhotoBtn) {
    addPhotoBtn.addEventListener('click', () => openPhotoModal());
}

function openPhotoModal(itemId = null) {
    if (!isEditor) return;
    if (!currentCaseId) {
        alert("Veuillez d'abord entrer un nom de dossier et cliquer sur Charger !");
        return;
    }
    editingItemId = itemId;
    const modalTitle = document.querySelector('#photo-modal h3');

    if (itemId) {
        const item = items.find(i => i.id === itemId);
        photoUrlInput.value = item.url || '';
        photoCaptionInput.value = item.caption || '';
        modalTitle.innerText = "Modifier la Photo";
        photoConfirmBtn.innerText = "Sauvegarder";
    } else {
        photoUrlInput.value = '';
        photoCaptionInput.value = '';
        modalTitle.innerText = "Ajouter une Photo (Preuve)";
        photoConfirmBtn.innerText = "Ajouter au tableau";
    }

    photoModal.classList.remove('hidden');
    photoUrlInput.focus();
}

if (photoCancelBtn) {
    photoCancelBtn.addEventListener('click', () => {
        photoModal.classList.add('hidden');
    });
}

if (photoConfirmBtn) {
    photoConfirmBtn.addEventListener('click', () => {
        const url = photoUrlInput.value.trim();
        if (!url) return;

        if (editingItemId) {
            const item = items.find(i => i.id === editingItemId);
            if (item) {
                item.url = url;
                item.caption = photoCaptionInput.value.trim();
            }
        } else {
            const id = generateId();
            const pos = getCenterPos(125);
            const item = {
                id,
                type: 'photo',
                x: pos.x,
                y: pos.y,
                url: url,
                caption: photoCaptionInput.value.trim(),
                rotation: Math.random() * 6 - 3,
                pinColor: getRandomPin()
            };
            items.push(item);
        }

        boardContent.querySelectorAll('.board-item').forEach(el => el.remove());
        items.forEach(renderItem);
        renderLines();

        saveData();
        photoModal.classList.add('hidden');
    });
}

if (linkBtn) {
    linkBtn.addEventListener('click', () => {
        if (!isEditor) return;
        isLinkingMode = !isLinkingMode;
        linkBtn.classList.toggle('active', isLinkingMode);
        document.body.classList.toggle('linking-mode', isLinkingMode);
        linkStartItem = null;
        if (isLinkingMode && isMovingAll) {
            isMovingAll = false;
            if (moveAllBtn) moveAllBtn.classList.remove('active');
        }
    });
}

if (moveAllBtn) {
    moveAllBtn.addEventListener('click', () => {
        if (!isEditor) return;
        isMovingAll = !isMovingAll;
        moveAllBtn.classList.toggle('active', isMovingAll);
        if (isMovingAll && isLinkingMode) {
            isLinkingMode = false;
            linkBtn.classList.remove('active');
            document.body.classList.remove('linking-mode');
            linkStartItem = null;
        }
    });
}

function renderItem(item) {
    const el = document.createElement('div');
    el.id = item.id;
    el.className = `board-item ${item.type}`;
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.setProperty('--rot', item.rotation || 0);
    if (item.pinColor) {
        el.style.setProperty('--pin-c1', item.pinColor[0]);
        el.style.setProperty('--pin-c2', item.pinColor[1]);
    }
    if (item.bgColor) el.style.backgroundColor = item.bgColor;
    if (item.borderColor) el.style.borderColor = item.borderColor;
    if (item.textColor) el.style.color = item.textColor;

    if (isEditor) {
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '×';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteItem(item.id);
        };
        el.appendChild(delBtn);

        const colorBtn = document.createElement('button');
        colorBtn.className = 'edit-btn';
        colorBtn.innerHTML = '🎨';
        colorBtn.style.left = '5px';
        colorBtn.style.right = 'auto';
        colorBtn.title = "Changer la couleur de la punaise";
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            const currentItem = items.find(i => i.id === item.id) || item;
            let currentIndex = pinColors.findIndex(p => currentItem.pinColor && p[0] === currentItem.pinColor[0]);
            let nextIndex = (currentIndex + 1) % pinColors.length;
            currentItem.pinColor = pinColors[nextIndex];
            el.style.setProperty('--pin-c1', currentItem.pinColor[0]);
            el.style.setProperty('--pin-c2', currentItem.pinColor[1]);
            saveData();
        };
        el.appendChild(colorBtn);

        if (item.type === 'photo') {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.innerHTML = '✏️';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openPhotoModal(item.id);
            };
            el.appendChild(editBtn);
        } else if (item.type === 'note') {
            const alignBtn = document.createElement('button');
            alignBtn.className = 'edit-btn';
            alignBtn.innerHTML = '≡';
            alignBtn.title = "Centrer / Aligner à gauche";
            alignBtn.onclick = (e) => {
                e.stopPropagation();
                const currentItem = items.find(i => i.id === item.id) || item;
                currentItem.align = currentItem.align === 'center' ? 'left' : 'center';
                const ta = el.querySelector('textarea');
                if (ta) ta.style.textAlign = currentItem.align;
                saveData();
            };
            el.appendChild(alignBtn);
        }
    }

    if (item.type === 'note' || item.type === 'floating-text') {
        const textarea = document.createElement('textarea');
        textarea.value = item.content;
        textarea.spellcheck = false;
        
        if (item.type === 'floating-text') {
            textarea.placeholder = "Tapez un titre...";
        } else {
            textarea.placeholder = "Écrire une note...";
            textarea.style.textAlign = item.align || 'left';
        }
        
        if (!isEditor) textarea.readOnly = true;

        textarea.onfocus = () => activeTextareaId = item.id;
        textarea.onblur = () => {
            activeTextareaId = null;
            if (textarea.value !== item.content) {
                item.content = textarea.value;
                saveData();
            }
        };

        // Auto-resize et sauvegarde temps réel
        textarea.oninput = (e) => {
            if (!isEditor) return;
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            item.content = e.target.value;
            saveData();
            renderLines();
        };

        textarea.addEventListener('mousedown', (e) => {
            if (!isLinkingMode && isEditor) e.stopPropagation();
        });

        el.appendChild(textarea);
        
        // Initial resize
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }, 0);
    } else if (item.type === 'photo') {
        const img = document.createElement('img');
        img.src = item.url;
        img.draggable = false;
        el.appendChild(img);

        if (item.caption) {
            const cap = document.createElement('div');
            cap.className = 'caption';
            cap.innerText = item.caption;
            el.appendChild(cap);
        }
    }

    if (isEditor) {
        el.addEventListener('mousedown', (e) => handleItemMouseDown(e, item, el));
    }
    boardContent.appendChild(el);
}

function deleteItem(id) {
    if (!isEditor) return;
    items = items.filter(i => i.id !== id);
    links = links.filter(l => l.from !== id && l.to !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    renderLines();
    saveData();
}

function handleItemMouseDown(e, item, el) {
    const currentItem = items.find(i => i.id === item.id) || item;

    if (isMovingAll) {
        draggedItem = { data: 'ALL' };
        dragOffsetX = e.clientX;
        dragOffsetY = e.clientY;
        return;
    }

    if (isLinkingMode) {
        if (!linkStartItem) {
            linkStartItem = currentItem;
            el.style.boxShadow = '0 0 0 3px #3b82f6';
        } else {
            if (linkStartItem.id !== currentItem.id) {
                const exists = links.find(l =>
                    (l.from === linkStartItem.id && l.to === currentItem.id) ||
                    (l.to === linkStartItem.id && l.from === currentItem.id)
                );
                if (!exists) {
                    links.push({ from: linkStartItem.id, to: currentItem.id });
                    renderLines();
                    saveData();
                }
            }
            document.getElementById(linkStartItem.id).style.boxShadow = '';
            linkStartItem = null;
        }
        return;
    }

    draggedItem = { data: currentItem, el: el };
    dragOffsetX = e.clientX;
    dragOffsetY = e.clientY;
    dragStartX = currentItem.x;
    dragStartY = currentItem.y;
    el.style.zIndex = 50;
}

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let scrollStartX = 0;
let scrollStartY = 0;

board.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const zoomStep = 0.05;
        if (e.deltaY < 0) {
            currentZoom = Math.min(2.0, currentZoom + zoomStep);
        } else {
            currentZoom = Math.max(0.3, currentZoom - zoomStep);
        }
        if (zoomSlider) zoomSlider.value = currentZoom;
        boardContent.style.setProperty('--zoom', currentZoom);
    }
}, { passive: false });

board.addEventListener('mousedown', (e) => {
    if (e.target === board || e.target === boardContent || e.target === linesContainer || e.target.tagName === 'svg' || e.target.tagName === 'line') {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        scrollStartX = board.scrollLeft;
        scrollStartY = board.scrollTop;
        board.style.cursor = 'grabbing';
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        board.scrollLeft = scrollStartX - dx;
        board.scrollTop = scrollStartY - dy;
    }

    if (draggedItem && isEditor) {
        if (draggedItem.data === 'ALL') {
            const dx = (e.clientX - dragOffsetX) / currentZoom;
            const dy = (e.clientY - dragOffsetY) / currentZoom;

            items.forEach(item => {
                item.x += dx;
                item.y += dy;
                const el = document.getElementById(item.id);
                if (el) {
                    el.style.left = item.x + 'px';
                    el.style.top = item.y + 'px';
                }
            });

            dragOffsetX = e.clientX;
            dragOffsetY = e.clientY;
            renderLines();
        } else {
            const dx = (e.clientX - dragOffsetX) / currentZoom;
            const dy = (e.clientY - dragOffsetY) / currentZoom;
            const newX = dragStartX + dx;
            const newY = dragStartY + dy;

            draggedItem.data.x = newX;
            draggedItem.data.y = newY;
            draggedItem.el.style.left = newX + 'px';
            draggedItem.el.style.top = newY + 'px';
            renderLines();
        }
    }
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        board.style.cursor = 'default';
    }

    if (draggedItem && isEditor) {
        if (draggedItem.data !== 'ALL') {
            draggedItem.el.style.zIndex = 10;
        }
        draggedItem = null;
        saveData(); // Sauvegarde la nouvelle position
    }
});

function renderLines() {
    linesContainer.innerHTML = `
        <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="context-stroke" />
            </marker>
        </defs>
    `;
    linesContainer.setAttribute('width', '4000');
    linesContainer.setAttribute('height', '4000');

    links.forEach(link => {
        const elFrom = document.getElementById(link.from);
        const elTo = document.getElementById(link.to);
        const itemFrom = items.find(i => i.id === link.from);
        const itemTo = items.find(i => i.id === link.to);

        if (elFrom && elTo && itemFrom && itemTo) {
            const x1 = itemFrom.x + elFrom.offsetWidth / 2;
            const y1 = itemFrom.y + 15; // Point d'attache au niveau de la punaise
            const x2 = itemTo.x + elTo.offsetWidth / 2;
            const y2 = itemTo.y + 15; // Point d'attache au niveau de la punaise

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // Courbe de Bézier avec un effet d'affaissement (sagging)
            const dx = x2 - x1;
            const dy = y2 - y1;
            // On ajoute un poids vers le bas pour faire l'effet d'une vraie ficelle
            const sag = Math.min(Math.abs(dx) * 0.2, 50); 
            const cx1 = x1 + dx * 0.33;
            const cy1 = y1 + dy * 0.33 + sag;
            const cx2 = x1 + dx * 0.66;
            const cy2 = y1 + dy * 0.66 + sag;
            
            const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
            
            // Couleur de la ficelle basée sur la couleur de la punaise de départ, sinon rouge
            let strokeColor = 'var(--string-color)';
            if (itemFrom.pinColor && itemFrom.pinColor[0]) {
                strokeColor = itemFrom.pinColor[0];
            }
            
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '4');
            path.setAttribute('marker-end', 'url(#arrowhead)');
            
            path.style.filter = 'drop-shadow(2px 4px 6px black)';

            if (isEditor) {
                path.style.pointerEvents = 'stroke';
                path.style.cursor = 'pointer';
                path.onclick = () => {
                    links = links.filter(l => l !== link);
                    renderLines();
                    saveData();
                };
            }

            linesContainer.appendChild(path);
        }
    });
}

window.addEventListener('resize', renderLines);
board.addEventListener('scroll', renderLines);

if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        if (!isEditor) return;
        saveData();
        if (!db) {
            alert('Tableau sauvegardé localement ! (Firebase non configuré, donc vous êtes le seul à le voir)');
        }
    });
}

if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        if (!isEditor) return;
        if (confirm('Voulez-vous vraiment vider tout le tableau ?')) {
            items = [];
            links = [];
            boardContent.querySelectorAll('.board-item').forEach(el => el.remove());
            renderLines();
            saveData();
        }
    });
}

function saveData() {
    if (isEditor && currentCaseId) {
        if (db) {
            // Sauvegarde dans Firebase avec le nom du dossier dynamique
            db.collection('lscpd').doc(currentCaseId).set({
                items: items,
                links: links
            }).catch(error => {
                console.error("Erreur de sauvegarde Firebase:", error);
            });
        } else {
            // Sauvegarde locale de secours par dossier
            localStorage.setItem(`lscpd_board_${currentCaseId}`, JSON.stringify({ items, links }));
        }
    }
}

init();
