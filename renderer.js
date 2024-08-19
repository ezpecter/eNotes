//renderer.js
let notes = [];
let sortable;
let categories = new Set(['General', 'Trabajo', 'Personal']);
let actionHistory = [];
let currentHistoryIndex = -1;
let redoHistoryIndex = -1;
let isHighlighted

let NOTES_FILE;

window.electron.getNotesFilePath().then(filePath => {
    NOTES_FILE = filePath;
    console.log('Notes file path:', NOTES_FILE);
    loadNotes();
}).catch(error => {
    console.error('Error getting notes file path:', error);
});


async function saveNotes() {
    if (!NOTES_FILE) {
        console.error('NOTES_FILE is not defined');
        return;
    }
    try {
        console.log('Saving notes to:', NOTES_FILE);
        await window.electron.fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
        // ... resto del código ...
    } catch (error) {
        console.error('Error saving notes:', error);
    }
        notes.forEach(note => {
        const noteElement = document.querySelector(`.note[data-id="${note.id}"]`);
        if (noteElement) {
            note.backgroundColor = noteElement.style.backgroundColor;
        }
    });
    try {
        console.log('Saving notes to:', notes);
        await window.electron.fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
        localStorage.setItem('categories', JSON.stringify(Array.from(categories)));
        console.log('Notes saved successfully.');
    } catch (error) {
        console.error('Error saving notes:', error);
    }

}

function updateCategoryFilter() {
    const categoryFilter = document.getElementById('category-filter');
    categoryFilter.innerHTML = '<option value="all">Todas las categorías</option>';
    Array.from(categories).sort().forEach(category => {
        categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
    });
    
    let removeCategoryBtn = document.getElementById('remove-category');
    if (removeCategoryBtn) {
        removeCategoryBtn.addEventListener('click', removeCategory);
    }
}


async function loadNotes() {

    if (!NOTES_FILE) {
        console.error('NOTES_FILE is not defined');
        return;
    }
    try {
        console.log('Loading notes from:', NOTES_FILE);
        const data = await window.electron.fs.readFile(NOTES_FILE, 'utf8');
        // ... resto del código ...
    } catch (error) {
        console.error('Error loading notes:', error);
    }

    try {
        console.log('Loading notes from:', NOTES_FILE);
        const data = await window.electron.fs.readFile(NOTES_FILE, 'utf8');
        notes = JSON.parse(data);
        console.log('Loaded notes:', notes);

        const savedCategories = localStorage.getItem('categories');
        if (savedCategories) {
            categories = new Set(JSON.parse(savedCategories));
        } else {
            categories = new Set(['General']);
        }
        notes.forEach(note => {
            categories.add(note.category);
            if (!note.hasOwnProperty('subNotes')) {
                note.subNotes = [];
            }
            if (note.isHighlighted === undefined) {
                note.isHighlighted = false;  // Asegúrate de que todas las notas tengan este campo
            }
            if (note.highlightColor === undefined) {
                note.highlightColor = note.isHighlighted ? note.color : null;
            }
            console.log('Processed note:', note);
        });
        updateCategoryFilter();
        renderNotes();
        updateNotesColors(document.body.classList.contains('dark-mode'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Notes file not found, creating a new one.');
            await saveNotes();
            createNote('Esta es una nota de ejemplo');
        } else {
            console.error('Error loading notes:', error);
        }
    }
}
function createNote(text = 'Nueva nota', color = '#ffeb3b', category = 'General', dueDate = null) {
    const note = { 
        id: Date.now(), 
        text, 
        color, 
        category, 
        completed: false, 
        dueDate, 
        selected: false,
        subNotes: [],
        isHighlighted: false,
        highlightColor: null  // Nuevo campo para guardar el color de destacado
    };

    notes.push(note);
    addToHistory({
        action: 'create',
        note: {...note}
    });
    console.log('Note created:', note);
    console.log('Current notes array:', notes);
    renderNotes();
    saveNotes();
}

function addSubNote(parentId, text = '', color = '#ffeb3b') {
    const parentNote = notes.find(note => note.id === parentId);
    if (parentNote) {
        const subNote = { id: Date.now(), text, color: parentNote.color, completed: false };
        if (!parentNote.subNotes) {
            parentNote.subNotes = [];
        }
        parentNote.subNotes.push(subNote);
        addToHistory({
            action: 'createSubNote',
            parentId,
            subNote: {...subNote}
        });
        updateNoteSelectionUI();
        saveNotes();
    }
}

function renderNotes(notesToRender = notes) {
    console.log('Rendering notes, count:', notesToRender.length);
    const container = document.getElementById('notes-container');
    console.log('Container:', container);
    container.innerHTML = '';
    notesToRender.forEach(note => {
        console.log('Rendering notes:', notesToRender);
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        noteElement.setAttribute('data-id', note.id);
        if (note.selected) {
            noteElement.classList.add('selected');
        }
        if (note.completed) {
            noteElement.style.opacity = '0.5';
             noteElement.querySelector('.note-text').style.textDecoration = 'line-through';
        }
        if (note.isHighlighted) {
            noteElement.style.backgroundColor = note.color;
            noteElement.style.color = getContrastColor(note.color);
        } else {
            noteElement.style.backgroundColor = '';
            noteElement.style.color = '';
        }
        if (note.isHighlighted) {
            applyNoteHighlight(noteElement, note);
        } else {
            removeNoteHighlight(noteElement);
        }
        console.log('Rendered note:', note);
        noteElement.innerHTML = `
        <div class="color-indicator" style="background-color: ${note.completed ? '#808080' : note.color}"></div>
        <div class="note-content">
            <div class="note-category" contenteditable="true">${note.category}</div>
            <div class="note-text" contenteditable="true">${note.text}</div>
            ${note.dueDate ? `<div class="note-due-date">Fecha límite: ${formatDate(note.dueDate)}</div>` : ''}
            <div class="sub-notes-container"></div>
        </div>
        <input type="color" class="color-picker" value="${note.color}">
        <input type="date" class="due-date-picker" value="${note.dueDate || ''}">
    `;
        container.appendChild(noteElement);
        noteElement.style.backgroundColor = note.backgroundColor || '';
        noteElement.style.color = note.backgroundColor ? getContrastColor(note.backgroundColor) : '';
        noteElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e);
        });

        const noteTextElement = noteElement.querySelector('.note-text');
        
        const colorIndicator = noteElement.querySelector('.color-indicator');
colorIndicator.addEventListener('click', (e) => {
    e.stopPropagation(); // Previene que el clic se propague a la nota
    toggleNoteColor(noteElement, note);
});

        // Nuevo event listener para 'keydown'
        noteTextElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.target.blur();
                const noteId = parseInt(noteElement.getAttribute('data-id'));
                const note = notes.find(n => n.id === noteId);
                if (note) {
                    const oldText = note.text;
                    note.text = e.target.innerText;
                    addToHistory({
                        action: 'editNote',
                        noteId: noteId,
                        oldText: oldText,
                        newText: note.text
                    });
                    updateNoteSelectionUI();
                    saveNotes();
                }
            }
        });

        // Nuevo event listener para 'input'
        noteTextElement.addEventListener('input', (e) => {
            const noteId = parseInt(noteElement.getAttribute('data-id'));
            const note = notes.find(n => n.id === noteId);
            if (note) {
                note.text = e.target.innerText;
                updateNoteSelectionUI();
                saveNotes();
            }
        });

        noteElement.querySelector('.note-category').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
                const newCategory = e.target.textContent.trim();
                if (newCategory && newCategory !== note.category) {
                    const oldCategory = note.category;
                    note.category = newCategory;
                    categories.add(newCategory);
                    updateCategoryFilter();
                    
                    addToHistory({
                        action: 'editCategory',
                        noteId: note.id,
                        oldCategory: oldCategory,
                        newCategory: newCategory
                    });
                    updateNoteSelectionUI();
                    saveNotes();
                }
            }
        });
        
        noteElement.querySelector('.note-category').addEventListener('blur', (e) => {
            const newCategory = e.target.textContent.trim();
            if (newCategory && newCategory !== note.category) {
                const oldCategory = note.category;
                note.category = newCategory;
                categories.add(newCategory);
                updateCategoryFilter();
                
                addToHistory({
                    action: 'editCategory',
                    noteId: note.id,
                    oldCategory: oldCategory,
                    newCategory: newCategory
                });
                updateNoteSelectionUI();
                saveNotes();
            }
        });

        const subNotesContainer = noteElement.querySelector('.sub-notes-container');
        console.log('Sub-notes container:', subNotesContainer);
        note.subNotes.forEach(subNote => {
            const subNoteElement = document.createElement('div');
            subNoteElement.className = `sub-note ${subNote.completed ? 'completed' : ''}`;
            subNoteElement.setAttribute('data-id', subNote.id);
            subNoteElement.innerHTML = `
                <div class="sub-note-color" style="background-color: ${subNote.color}"></div>
                <div class="sub-note-text" contenteditable="true">${subNote.text}</div>
            `;
            subNotesContainer.appendChild(subNoteElement);
            console.log('Added sub-note:', subNote);

            if (subNote.completed) {
                subNoteElement.style.opacity = '0.5';
                subNoteElement.querySelector('.sub-note-text').style.textDecoration = 'line-through';
            }

            subNoteElement.querySelector('.sub-note-text').addEventListener('input', (e) => {
                subNote.text = e.target.innerText;
                updateNoteSelectionUI();
                saveNotes();
            });

            subNoteElement.querySelector('.sub-note-text').addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                    const oldText = subNote.text;
                    subNote.text = e.target.innerText;
                    addToHistory({
                        action: 'editSubNote',
                        noteId: note.id,
                        subNoteId: subNote.id,
                        oldText: oldText,
                        newText: subNote.text
                    });
                    updateNoteSelectionUI();
                    saveNotes();
                }
            });

            subNoteElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e);
            });
            subNoteElement.__subNoteData = subNote;
            subNoteElement.setAttribute('data-id', subNote.id);
        });

        new Sortable(subNotesContainer, {
            group: 'subNotes',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const fromNoteId = parseInt(evt.from.closest('.note').getAttribute('data-id'));
                const toNoteId = parseInt(evt.to.closest('.note').getAttribute('data-id'));
                const subNoteId = parseInt(evt.item.getAttribute('data-id'));
                const newIndex = evt.newIndex;

                moveSubNote(fromNoteId, toNoteId, subNoteId, newIndex);

                console.log('Moving subnote:', { fromNoteId, toNoteId, subNoteId, newIndex });
            }
        });
    });

    console.log('Finished rendering notes');

    if (sortable) {
        sortable.destroy();
    }
    sortable = new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.sub-note',
        onEnd: function (evt) {
            const noteElements = Array.from(container.querySelectorAll('.note'));
            notes = noteElements.map(el => notes.find(note => note.id === parseInt(el.getAttribute('data-id'))));
            updateNoteSelectionUI();
            saveNotes();
        }
    });
}

function setupNoteSelection() {
    const container = document.getElementById('notes-container');
    container.addEventListener('click', (e) => {
        const noteElement = e.target.closest('.note');
        const subNoteElement = e.target.closest('.sub-note');

        if (subNoteElement) {
            handleSubNoteSelection(subNoteElement);
        } else if (noteElement) {
            handleNoteSelection(noteElement);
        }
    });
}

function toggleNoteColor(noteElement, note) {
    note.isHighlighted = !note.isHighlighted;
    if (note.isHighlighted) {
        note.highlightColor = note.color;
        applyNoteHighlight(noteElement, note);
    } else {
        note.highlightColor = null;
        removeNoteHighlight(noteElement);
    }
    console.log('Note highlight toggled:', note);
    saveNotes();
}

function applyNoteHighlight(noteElement, note) {
    noteElement.style.backgroundColor = note.highlightColor;
    noteElement.style.color = getContrastColor(note.highlightColor);
    noteElement.classList.add('highlighted');

    // Cambiar el color del indicador
    const colorIndicator = noteElement.querySelector('.color-indicator');
    if (colorIndicator) {
        colorIndicator.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#333333' : '#FFFFFF';
    }

    // Ajustar el color del texto para la categoría y la fecha
    const categoryElement = noteElement.querySelector('.note-category');
    const dueDateElement = noteElement.querySelector('.note-due-date');
    
    if (categoryElement) {
        categoryElement.style.color = getContrastColor(note.highlightColor);
    }
    if (dueDateElement) {
        dueDateElement.style.color = getContrastColor(note.highlightColor);
    }
}

function removeNoteHighlight(noteElement) {
    noteElement.style.backgroundColor = '';
    noteElement.style.color = '';
    noteElement.classList.remove('highlighted');

    // Restaurar el color original del indicador
    const colorIndicator = noteElement.querySelector('.color-indicator');
    if (colorIndicator) {
        const noteId = parseInt(noteElement.getAttribute('data-id'));
        const note = notes.find(n => n.id === noteId);
        if (note) {
            colorIndicator.style.backgroundColor = note.color;
        }
    }

    // Restaurar el color del texto para la categoría y la fecha
    const categoryElement = noteElement.querySelector('.note-category');
    const dueDateElement = noteElement.querySelector('.note-due-date');
    
    if (categoryElement) {
        categoryElement.style.color = '';
    }
    if (dueDateElement) {
        dueDateElement.style.color = '';
    }
}

// Función auxiliar para determinar el color de texto basado en el contraste
function getContrastColor(hexColor) {
    // Convierte el color hex a RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Calcula la luminosidad
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retorna blanco o negro dependiendo de la luminosidad
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function handleNoteSelection(noteElement) {
    const noteId = parseInt(noteElement.getAttribute('data-id'));
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.selected = !note.selected;
        noteElement.classList.toggle('selected');
        saveNotes();
    }
}

function handleSubNoteSelection(subNoteElement) {
    const noteElement = subNoteElement.closest('.note');
    const noteId = parseInt(noteElement.getAttribute('data-id'));
    const subNoteId = parseInt(subNoteElement.getAttribute('data-id'));
    const note = notes.find(n => n.id === noteId);
    if (note) {
        const subNote = note.subNotes.find(sn => sn.id === subNoteId);
        if (subNote) {
            subNote.selected = !subNote.selected;
            subNoteElement.classList.toggle('selected');
            saveNotes();
        }
    }
}

function setupDeselect() {
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.note') && !event.target.closest('#floating-menu')) {
            let selectionChanged = false;
            notes.forEach(note => {
                if (note.selected) {
                    note.selected = false;
                    selectionChanged = true;
                }
                if (note.subNotes) {
                    note.subNotes.forEach(subNote => {
                        if (subNote.selected) {
                            subNote.selected = false;
                            selectionChanged = true;
                        }
                    });
                }
            });
            if (selectionChanged) {
                updateNoteSelectionUI();
            }
        }
    });
}

function updateNoteSelectionUI() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    notes.forEach(note => {
        const noteElement = document.querySelector(`.note[data-id="${note.id}"]`);
        if (noteElement) {
            if (note.isHighlighted) {
                applyNoteHighlight(noteElement, note);
            } else {
                removeNoteHighlight(noteElement);
                noteElement.style.backgroundColor = isDarkMode ? '#444' : '#fff';
                noteElement.style.color = isDarkMode ? '#fff' : '#000';
            }

            // Actualizar subnotas
            note.subNotes.forEach(subNote => {
                const subNoteElement = noteElement.querySelector(`.sub-note[data-id="${subNote.id}"]`);
                if (subNoteElement) {
                    subNoteElement.style.backgroundColor = isDarkMode ? '#333' : '#f5f5f5';
                    subNoteElement.style.color = isDarkMode ? '#fff' : '#000';
                    if (subNote.completed) {
                        subNoteElement.style.opacity = '0.5';
                        subNoteElement.querySelector('.sub-note-text').style.textDecoration = 'line-through';
                    } else {
                        subNoteElement.style.opacity = '1';
                        subNoteElement.querySelector('.sub-note-text').style.textDecoration = 'none';
                    }
                }
            });
        }
    });
}


function moveSubNote(fromNoteId, toNoteId, subNoteId, newIndex) {
    console.log('moveSubNote called with:', { fromNoteId, toNoteId, subNoteId, newIndex });
    const fromNote = notes.find(note => note.id === fromNoteId);
    const toNote = notes.find(note => note.id === toNoteId);
    console.log('From note:', fromNote);
    console.log('To note:', toNote);
    const subNoteIndex = fromNote.subNotes.findIndex(subNote => subNote.id === subNoteId);
    console.log('Sub-note index:', subNoteIndex);
    const [movedSubNote] = fromNote.subNotes.splice(subNoteIndex, 1);
    console.log('Moved sub-note:', movedSubNote);

    if (fromNoteId === toNoteId) {
        console.log('Reordering within the same note');
        fromNote.subNotes.splice(newIndex, 0, movedSubNote);
    } else {
        console.log('Moving to another note');
        toNote.subNotes.splice(newIndex, 0, movedSubNote);
    }

    console.log('Updated notes:', notes);
    saveNotes();
}

function applyColorToSelectedNotes(color) {
    const selectedNotes = notes.filter(note => note.selected);
    const selectedSubNotes = notes.flatMap(note => 
        note.subNotes.filter(subNote => subNote.selected)
    );

    if (selectedNotes.length > 0) {
        selectedNotes.forEach(note => {
            note.color = color;
        });
    }

    if (selectedSubNotes.length > 0) {
        selectedSubNotes.forEach(subNote => {
            subNote.color = color;
        });
    }

    if (selectedNotes.length > 0 || selectedSubNotes.length > 0) {
        renderNotes();
        saveNotes();
    } else {
        alert('Por favor, seleccione al menos una nota o subnota.');
    }
}

function deleteNote(notesToDelete = null) {
    if (!notesToDelete) {
        notesToDelete = notes.filter(note => note.selected);
        // Añadir subnotas seleccionadas a la lista de eliminación
        notes.forEach(note => {
            if (note.subNotes) {
                note.subNotes = note.subNotes.filter(subNote => !subNote.selected);
            }
        });
    }
    if (notesToDelete.length === 0) return;

    const deletedNotes = notesToDelete.map(note => ({...note}));
    notes = notes.filter(note => !notesToDelete.includes(note));

    addToHistory({
        action: 'delete',
        notes: deletedNotes
    });

    renderNotes();
    saveNotes();
}

function toggleCompleted() {
    const selectedNotes = notes.filter(note => note.selected);
    if (selectedNotes.length === 0) return;

    const toggledNotes = selectedNotes.map(note => ({...note, completed: !note.completed}));

    addToHistory({
        action: 'toggle',
        notes: toggledNotes.map(note => ({...note, completed: !note.completed}))
    });

    notes = notes.map(note => {
        if (selectedNotes.includes(note)) {
            return {...note, completed: !note.completed};
        }
        if (note.subNotes) {
            note.subNotes = note.subNotes.map(subNote => 
                subNote.selected ? {...subNote, completed: !subNote.completed} : subNote
            );
        }
        return note;
    });

    renderNotes();
    saveNotes();
}

function deleteSubNote(parentNote, subNote) {
    parentNote.subNotes = parentNote.subNotes.filter(sn => sn !== subNote);
    updateNoteSelectionUI();
    saveNotes();
}

function toggleItemCompleted(note, subNote = null) {
    if (subNote) {
        subNote.completed = !subNote.completed;
        addToHistory({
            action: 'toggleSubNoteCompleted',
            noteId: note.id,
            subNoteId: subNote.id,
            previousState: { completed: !subNote.completed }
        });
    } else {
        note.completed = !note.completed;
        addToHistory({
            action: 'toggleNoteCompleted',
            noteId: note.id,
            previousState: { completed: !note.completed }
        });
    }
    renderNotes();
    saveNotes();
}

function rgbToHex(rgb) {
    return '#' + rgb.match(/\d+/g).map(x => (+x).toString(16).padStart(2, '0')).join('');
}

function showContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const isSubNote = e.target.closest('.sub-note') !== null;
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    
    if (isSubNote) {
        contextMenu.innerHTML = `
            <div class="context-menu-item" id="delete-subnote">Eliminar subnota</div>
            <div class="context-menu-item" id="mark-subnote">Marcar subnota como completada</div>
        `;
    } else {
        contextMenu.innerHTML = `
            <div class="context-menu-item" id="delete-note">Eliminar nota</div>
            <div class="context-menu-item" id="mark-note">Marcar nota como completada</div>
        `;
    }
    
    document.body.appendChild(contextMenu);
    
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;
    
    if (isSubNote) {
        const deleteSubNote = contextMenu.querySelector('#delete-subnote');
        const markSubNote = contextMenu.querySelector('#mark-subnote');
        
        deleteSubNote.addEventListener('click', () => {
            const subNote = e.target.closest('.sub-note');
            const noteElement = subNote.closest('.note');
            const noteId = parseInt(noteElement.getAttribute('data-id'));
            const note = notes.find(n => n.id === noteId);
            const subNoteIndex = note.subNotes.findIndex(sn => sn === subNote.__subNoteData);
            const deletedSubNote = note.subNotes.splice(subNoteIndex, 1)[0];
            
            addToHistory({
                action: 'deleteSubNote',
                noteId: noteId,
                subNote: deletedSubNote,
                index: subNoteIndex
            });
            
            renderNotes();
            saveNotes();
        });
        
        markSubNote.addEventListener('click', () => {
            const subNote = e.target.closest('.sub-note');
            const noteElement = subNote.closest('.note');
            const noteId = parseInt(noteElement.getAttribute('data-id'));
            const note = notes.find(n => n.id === noteId);
            const subNoteIndex = note.subNotes.findIndex(sn => sn === subNote.__subNoteData);
            if (subNoteIndex !== -1) {
                const previousState = {...note.subNotes[subNoteIndex]};
                note.subNotes[subNoteIndex].completed = !note.subNotes[subNoteIndex].completed;
                
                addToHistory({
                    action: 'toggleSubNoteCompleted',
                    noteId: noteId,
                    subNoteIndex: subNoteIndex,
                    previousState: previousState
                });
                
                renderNotes();
                saveNotes();
            }
        });
    } else {
        const deleteNote = contextMenu.querySelector('#delete-note');
        const markNote = contextMenu.querySelector('#mark-note');
        
        deleteNote.addEventListener('click', () => {
            const noteElement = e.target.closest('.note');
            const noteId = parseInt(noteElement.getAttribute('data-id'));
            const noteToDelete = notes.find(note => note.id === noteId);
            notes = notes.filter(note => note.id !== noteId);
            addToHistory({
                action: 'delete',
                notes: [noteToDelete]
            });
            renderNotes();
            saveNotes();
        });
        
        markNote.addEventListener('click', () => {
            const noteElement = e.target.closest('.note');
            const noteId = parseInt(noteElement.getAttribute('data-id'));
            const note = notes.find(n => n.id === noteId);
            const previousState = {...note};
            note.completed = !note.completed;
            addToHistory({
                action: 'toggle',
                notes: [previousState]
            });
            renderNotes();
            saveNotes();
        });
    }
    
    document.addEventListener('click', function removeMenu(event) {
        if (!contextMenu.contains(event.target)) {
            contextMenu.remove();
            document.removeEventListener('click', removeMenu);
        }
    });
}

function filterNotes(query) {
    const filteredNotes = notes.filter(note => 
        note.text.toLowerCase().includes(query.toLowerCase())
    );
    renderNotes(filteredNotes);
}

function filterNotesByCategory(category) {
    if (category === 'all') {
        renderNotes();
    } else {
        const filteredNotes = notes.filter(note => note.category === category);
        renderNotes(filteredNotes);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateNotesColors(isDarkMode);
}

function updateNotesColors(isDarkMode) {
    const noteElements = document.querySelectorAll('.note');
    const subNoteElements = document.querySelectorAll('.sub-note');
    
    noteElements.forEach(noteElement => {
        const noteId = parseInt(noteElement.getAttribute('data-id'));
        const note = notes.find(n => n.id === noteId);
        if (note && note.isHighlighted) {
            applyNoteHighlight(noteElement, note);
        } else {
            removeNoteHighlight(noteElement);
            noteElement.style.backgroundColor = isDarkMode ? '#444' : '#fff';
            noteElement.style.color = isDarkMode ? '#fff' : '#000';
            
            // Ajustar el color para categoría y fecha en modo no destacado
            const categoryElement = noteElement.querySelector('.note-category');
            const dueDateElement = noteElement.querySelector('.note-due-date');
            if (categoryElement) categoryElement.style.color = isDarkMode ? '#ddd' : '#333';
            if (dueDateElement) dueDateElement.style.color = isDarkMode ? '#ddd' : '#333';
        }
    });
    
    // Las subnotas no se ven afectadas por el destacado
    subNoteElements.forEach(subNoteElement => {
        subNoteElement.style.backgroundColor = isDarkMode ? '#333' : '#f5f5f5';
        subNoteElement.style.color = isDarkMode ? '#fff' : '#000';
    });
}

function promptRemoveCategory(categories) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('removeCategoryDialog');
        const form = dialog.querySelector('form');
        const select = dialog.querySelector('#removeCategorySelect');
        const cancelBtn = dialog.querySelector('#cancelRemoveBtn');
        
        // Limpiar y actualizar el select
        select.innerHTML = '';
        Array.from(categories).forEach(category => {
            if (category !== 'General') {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            }
        });
        
        form.onsubmit = (e) => {
            e.preventDefault();
            dialog.close(select.value);
        };
        
        cancelBtn.onclick = () => {
            dialog.close(null);
        };
        
        dialog.onclose = () => {
            resolve(dialog.returnValue);
        };
        
        dialog.showModal();
    });
}

async function removeCategory() {
    const dialog = document.getElementById('removeCategoryDialog');
    const select = dialog.querySelector('#removeCategorySelect');
    const form = dialog.querySelector('form');

    // Limpiar y actualizar el select
    select.innerHTML = '';
    Array.from(categories).sort().forEach(category => {
        if (category !== 'General') {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        }
    });

    return new Promise((resolve) => {
        form.onsubmit = (e) => {
            e.preventDefault();
            dialog.close(select.value);
        };

        dialog.querySelector('#cancelRemoveBtn').onclick = () => {
            dialog.close(null);
        };

        dialog.onclose = () => {
            const categoryToRemove = dialog.returnValue;
            if (categoryToRemove && categories.has(categoryToRemove)) {
                categories.delete(categoryToRemove);
                notes.forEach(note => {
                    if (note.category === categoryToRemove) {
                        note.category = 'General';
                    }
                });
                updateCategoryFilter();
                renderNotes();
                saveNotes();
            }
            resolve();
        };

        dialog.showModal();
    });
}

function cleanCategories() {
    categories = new Set(Array.from(categories).filter(cat => 
        typeof cat === 'string' && cat !== 'object Object' && cat !== '[object Object]'
    ));
    notes.forEach(note => {
        if (typeof note.category !== 'string' || note.category === 'object Object' || note.category === '[object Object]') {
            note.category = 'General';
        }
    });
    updateCategoryFilter();
    saveNotes();
}

function showQuickColorPicker() {
    const favoriteColors = [
        'rgb(198, 60, 109)',
        'rgb(135, 70, 133)',
        'rgb(14, 112, 182)',
        'rgb(34, 132, 103)',
        'rgb(193, 161, 74)'
    ];

    const quickColorPicker = document.createElement('div');
    quickColorPicker.className = 'quick-color-picker';
    
    favoriteColors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.addEventListener('click', (e) => {
            e.stopPropagation(); // Detiene la propagación del evento
            applyColorToSelectedNotes(color);
            quickColorPicker.remove();
        });
        quickColorPicker.appendChild(colorOption);
    });

    // Agregar opción de color personalizado
    const customColorOption = document.createElement('div');
    customColorOption.className = 'color-option custom-color';
    customColorOption.innerHTML = '...';
    customColorOption.addEventListener('click', (e) => {
        e.stopPropagation(); // Detiene la propagación del evento
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.click();
        colorInput.addEventListener('change', (e) => {
            e.stopPropagation(); // Detiene la propagación del evento
            applyColorToSelectedNotes(e.target.value);
            quickColorPicker.remove();
        });
    });
    quickColorPicker.appendChild(customColorOption);

    const colorButton = document.getElementById('quick-color');
    const rect = colorButton.getBoundingClientRect();
    quickColorPicker.style.position = 'fixed';
    quickColorPicker.style.right = `${window.innerWidth - rect.left + 10}px`;
    quickColorPicker.style.top = `${rect.top + (rect.height - quickColorPicker.offsetHeight) / 2}px`;

    document.body.appendChild(quickColorPicker);

    // Ajustar la posición después de añadir al DOM
    setTimeout(() => {
        const pickerRect = quickColorPicker.getBoundingClientRect();
        if (pickerRect.left < 0) {
            quickColorPicker.style.right = `${window.innerWidth - rect.right - 10}px`;
        }
    }, 0);

    // Detener la propagación del evento en el quickColorPicker
    quickColorPicker.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', function removeQuickColorPicker(e) {
        if (!quickColorPicker.contains(e.target) && e.target.id !== 'quick-color') {
            quickColorPicker.remove();
            document.removeEventListener('click', removeQuickColorPicker);
        }
    });
}

function addTextEditingListeners(element) {
    element.addEventListener('keydown', (event) => {
        event.stopPropagation();
    });
}

function addToHistory(action) {
    actionHistory = actionHistory.slice(0, currentHistoryIndex + 1);
    actionHistory.push(action);
    currentHistoryIndex++;
    redoHistoryIndex = -1;
}

function undoLastAction() {
    if (currentHistoryIndex < 0) return;

    const lastAction = actionHistory[currentHistoryIndex];
    
    switch (lastAction.action) {
        case 'delete':
            notes = [...notes, ...lastAction.notes];
            break;
        case 'toggle':
            notes = notes.map(note => {
                const toggledNote = lastAction.notes.find(tn => tn.id === note.id);
                return toggledNote ? {...note, completed: toggledNote.completed} : note;
            });
            break;
        case 'create':
            notes = notes.filter(note => note.id !== lastAction.note.id);
            break;
        case 'createSubNote':
            const parentNote = notes.find(note => note.id === lastAction.parentId);
            if (parentNote) {
                parentNote.subNotes = parentNote.subNotes.filter(subNote => subNote.id !== lastAction.subNote.id);
            }
            break;
        case 'deleteSubNote':
            const noteToRestore = notes.find(note => note.id === lastAction.noteId);
            if (noteToRestore) {
                noteToRestore.subNotes.splice(lastAction.index, 0, lastAction.subNote);
            }
            break;
        case 'toggleSubNoteCompleted':
            const noteToToggle = notes.find(note => note.id === lastAction.noteId);
            if (noteToToggle) {
                noteToToggle.subNotes[lastAction.subNoteIndex] = {...lastAction.previousState};
            }
            break;
        case 'editSubNote':
            const noteToEdit = notes.find(note => note.id === lastAction.noteId);
            if (noteToEdit) {
                const subNoteToEdit = noteToEdit.subNotes.find(sn => sn.id === lastAction.subNoteId);
                if (subNoteToEdit) {
                    subNoteToEdit.text = lastAction.oldText;
                }
            }
            break;
        case 'editCategory':
            const noteToEditCategory = notes.find(n => n.id === lastAction.noteId);
            if (noteToEditCategory) {
                noteToEditCategory.category = lastAction.oldCategory;
                if (!notes.some(n => n.category === lastAction.newCategory)) {
                    categories.delete(lastAction.newCategory);
                }
                if (!categories.has(lastAction.oldCategory)) {
                    categories.add(lastAction.oldCategory);
                }
                updateCategoryFilter();
            }
            break;
            
    }

    currentHistoryIndex--;
    redoHistoryIndex = currentHistoryIndex;
    renderNotes();
    saveNotes();
}

function redoLastAction() {
    if (redoHistoryIndex >= actionHistory.length - 1) return;

    redoHistoryIndex++;
    const actionToRedo = actionHistory[redoHistoryIndex];

    switch (actionToRedo.action) {
        case 'delete':
            notes = notes.filter(note => !actionToRedo.notes.some(deletedNote => deletedNote.id === note.id));
            break;
        case 'toggle':
            notes = notes.map(note => {
                const toggledNote = actionToRedo.notes.find(tn => tn.id === note.id);
                return toggledNote ? {...note, completed: !toggledNote.completed} : note;
            });
            break;
        case 'create':
            notes.push(actionToRedo.note);
            break;
        case 'createSubNote':
            const parentNote = notes.find(note => note.id === actionToRedo.parentId);
            if (parentNote) {
                parentNote.subNotes.push(actionToRedo.subNote);
            }
            break;
        case 'deleteSubNote':
            const noteToDeleteFrom = notes.find(note => note.id === actionToRedo.noteId);
            if (noteToDeleteFrom) {
                noteToDeleteFrom.subNotes.splice(actionToRedo.index, 1);
            }
            break;
        case 'toggleSubNoteCompleted':
            const noteToToggle = notes.find(note => note.id === actionToRedo.noteId);
            if (noteToToggle) {
                noteToToggle.subNotes[actionToRedo.subNoteIndex].completed = !actionToRedo.previousState.completed;
            }
            break;
        case 'editSubNote':
            const noteToEdit = notes.find(note => note.id === actionToRedo.noteId);
            if (noteToEdit) {
                const subNoteToEdit = noteToEdit.subNotes.find(sn => sn.id === actionToRedo.subNoteId);
                if (subNoteToEdit) {
                    subNoteToEdit.text = actionToRedo.newText;
                }
            }
            break;
        case 'editCategory':
            const noteToRedoCategory = notes.find(n => n.id === actionToRedo.noteId);
            if (noteToRedoCategory) {
                noteToRedoCategory.category = actionToRedo.newCategory;
                categories.add(actionToRedo.newCategory);
                if (!notes.some(n => n.category === actionToRedo.oldCategory)) {
                    categories.delete(actionToRedo.oldCategory);
                }
                updateCategoryFilter();
            }
            break;
    }

    currentHistoryIndex = redoHistoryIndex;
    renderNotes();
    saveNotes();
}

function updateDueDates(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        console.error('Fecha inválida proporcionada');
        return;
    }

    let updatedCount = 0;
    notes.forEach(note => {
        if (note.selected) {
            note.dueDate = date.toISOString().split('T')[0];
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        saveNotes();
        renderNotes();
        console.log(`Se actualizaron las fechas de vencimiento de ${updatedCount} notas`);
    } else {
        console.log('No se seleccionaron notas para actualizar');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Fecha no válida';
    }
    return date.toLocaleDateString();
}


    function setupTooltips() {
        const buttons = document.querySelectorAll('[data-tooltip]');
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        document.body.appendChild(tooltip);
    
        buttons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                const title = e.target.getAttribute('data-tooltip');
                tooltip.textContent = title;
                tooltip.style.display = 'block';
                positionTooltip(e.target, tooltip);
            });
    
            button.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }
    
    

    function positionTooltip(target, tooltip) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 10;
    
        // Ajustar si el tooltip se sale de la pantalla
        if (left < 0) left = 0;
        if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width;
        if (top < 0) top = rect.bottom + 10;
    
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }


    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM fully loaded and parsed');
        loadNotes().then(() => {
            console.log('Notes loaded');
            cleanCategories();
            renderNotes();
            updateNotesColors(document.body.classList.contains('dark-mode'));
            setupNoteSelection(); // Añade esta línea
            setupDeselect(); // Añade esta línea
        });
    });

document.addEventListener('keydown', (event) => {
    // Verificar si el elemento activo es un elemento editable
    const isEditing = document.activeElement.isContentEditable || 
                      document.activeElement.tagName === 'INPUT' || 
                      document.activeElement.tagName === 'TEXTAREA';

    if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditing) {
        event.preventDefault();
        const selectedNotes = notes.filter(note => note.selected);
        if (selectedNotes.length > 0) {
            deleteNote(selectedNotes);
        } else {
            notes.forEach(note => {
                if (note.subNotes) {
                    const selectedSubNotes = note.subNotes.filter(subNote => subNote.selected);
                    if (selectedSubNotes.length > 0) {
                        note.subNotes = note.subNotes.filter(subNote => !subNote.selected);
                        renderNotes();
                        saveNotes();
                    }
                }
            });
        }
    } else if (event.ctrlKey && event.key === 'z') {
        undoLastAction();
    }
});

document.getElementById('add-note').addEventListener('click', () => {
    console.log('Add note button clicked');
    createNote();
});
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    loadNotes().then(() => {
        console.log('Notes loaded');
        cleanCategories();
        renderNotes();
        updateNotesColors(document.body.classList.contains('dark-mode'));
    });
});
document.getElementById('toggle-dark-mode').addEventListener('click', toggleDarkMode);
document.getElementById('set-due-date').addEventListener('click', (event) => {
    event.stopPropagation(); // Previene que el clic se propague al documento
    const selectedNotes = notes.filter(note => note.selected);
    if (selectedNotes.length > 0) {
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.position = 'fixed';
        dateInput.style.top = '50%';
        dateInput.style.left = '50%';
        dateInput.style.transform = 'translate(-50%, -50%)';
        dateInput.style.zIndex = '1000';
        document.body.appendChild(dateInput);

        // Usar setTimeout para asegurarse de que el input esté en el DOM antes de abrir el picker
        setTimeout(() => {
            dateInput.showPicker();
        }, 0);

        dateInput.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            updateDueDates(selectedDate);
            document.body.removeChild(dateInput);
        });

        // Añadir un evento para remover el input si se hace clic fuera de él
        function removeDateInput(e) {
            if (e.target !== dateInput && e.target !== event.target) {
                document.body.removeChild(dateInput);
                document.removeEventListener('click', removeDateInput);
            }
        }

        // Usar setTimeout para añadir el evento listener en el siguiente ciclo del event loop
        setTimeout(() => {
            document.addEventListener('click', removeDateInput);
        }, 0);
    } else {
        alert('Por favor, seleccione al menos una nota.');
    }
});
document.getElementById('add-subnote').addEventListener('click', () => {
    const selectedNotes = notes.filter(note => note.selected);
    if (selectedNotes.length === 1) {
        addSubNote(selectedNotes[0].id);
    } else {
        alert('Por favor, seleccione una sola nota para añadir una sub-nota.');
    }
});
document.getElementById('search').addEventListener('input', (e) => filterNotes(e.target.value));
document.getElementById('category-filter').addEventListener('change', (e) => filterNotesByCategory(e.target.value));
document.getElementById('quick-color').addEventListener('click', showQuickColorPicker);

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

function undoLastAction() {
    if (currentHistoryIndex < 0) return;

    const lastAction = actionHistory[currentHistoryIndex];
    
    switch (lastAction.action) {
        case 'delete':
            notes = [...notes, ...lastAction.notes];
            break;
        case 'toggle':
            notes = notes.map(note => {
                const toggledNote = lastAction.notes.find(tn => tn.id === note.id);
                return toggledNote ? {...note, completed: toggledNote.completed} : note;
            });
            break;
        case 'create':
            notes = notes.filter(note => note.id !== lastAction.note.id);
            break;
        case 'createSubNote':
            const parentNote = notes.find(note => note.id === lastAction.parentId);
            if (parentNote) {
                parentNote.subNotes = parentNote.subNotes.filter(subNote => subNote.id !== lastAction.subNote.id);
            }
            break;
        case 'deleteSubNote':
            const noteToRestore = notes.find(note => note.id === lastAction.noteId);
            if (noteToRestore) {
                noteToRestore.subNotes.splice(lastAction.index, 0, lastAction.subNote);
            }
            break;
        case 'toggleSubNoteCompleted':
            const noteToToggle = notes.find(note => note.id === lastAction.noteId);
            if (noteToToggle) {
                noteToToggle.subNotes[lastAction.subNoteIndex] = {...lastAction.previousState};
            }
            break;
        case 'editSubNote':
            const noteToEdit = notes.find(note => note.id === lastAction.noteId);
            if (noteToEdit) {
                const subNoteToEdit = noteToEdit.subNotes.find(sn => sn.id === lastAction.subNoteId);
                if (subNoteToEdit) {
                    subNoteToEdit.text = lastAction.oldText;
                }
            }
            break;
        case 'editCategory':
            const noteToEditCategory = notes.find(n => n.id === lastAction.noteId);
            if (noteToEditCategory) {
                noteToEditCategory.category = lastAction.oldCategory;
                if (!notes.some(n => n.category === lastAction.newCategory)) {
                    categories.delete(lastAction.newCategory);
                }
                if (!categories.has(lastAction.oldCategory)) {
                    categories.add(lastAction.oldCategory);
                }
                updateCategoryFilter();
            }
            break;
    }

    currentHistoryIndex--;
    redoHistoryIndex = currentHistoryIndex;
    renderNotes();
    saveNotes();
}

function redoLastAction() {
    if (redoHistoryIndex >= actionHistory.length - 1) return;

    redoHistoryIndex++;
    const actionToRedo = actionHistory[redoHistoryIndex];

    switch (actionToRedo.action) {
        case 'delete':
            notes = notes.filter(note => !actionToRedo.notes.some(deletedNote => deletedNote.id === note.id));
            break;
        case 'toggle':
            notes = notes.map(note => {
                const toggledNote = actionToRedo.notes.find(tn => tn.id === note.id);
                return toggledNote ? {...note, completed: !toggledNote.completed} : note;
            });
            break;
        case 'create':
            notes.push(actionToRedo.note);
            break;
        case 'createSubNote':
            const parentNote = notes.find(note => note.id === actionToRedo.parentId);
            if (parentNote) {
                parentNote.subNotes.push(actionToRedo.subNote);
            }
            break;
        case 'deleteSubNote':
            const noteToDeleteFrom = notes.find(note => note.id === actionToRedo.noteId);
            if (noteToDeleteFrom) {
                noteToDeleteFrom.subNotes.splice(actionToRedo.index, 1);
            }
            break;
        case 'toggleSubNoteCompleted':
            const noteToToggle = notes.find(note => note.id === actionToRedo.noteId);
            if (noteToToggle) {
                noteToToggle.subNotes[actionToRedo.subNoteIndex].completed = !actionToRedo.previousState.completed;
            }
            break;
        case 'editSubNote':
            const noteToEdit = notes.find(note => note.id === actionToRedo.noteId);
            if (noteToEdit) {
                const subNoteToEdit = noteToEdit.subNotes.find(sn => sn.id === actionToRedo.subNoteId);
                if (subNoteToEdit) {
                    subNoteToEdit.text = actionToRedo.newText;
                }
            }
            break;
        case 'editCategory':
            const noteToRedoCategory = notes.find(n => n.id === actionToRedo.noteId);
            if (noteToRedoCategory) {
                noteToRedoCategory.category = actionToRedo.newCategory;
                categories.add(actionToRedo.newCategory);
                if (!notes.some(n => n.category === actionToRedo.oldCategory)) {
                    categories.delete(actionToRedo.oldCategory);
                }
                updateCategoryFilter();
            }
            break;
    }

    currentHistoryIndex = redoHistoryIndex;
    renderNotes();
    saveNotes();
}

// Modificar el event listener existente para incluir redoLastAction



    const floatingMenu = document.getElementById('floating-menu');
    const mainMenuButton = document.getElementById('main-menu-button');
    const menu = document.getElementById('menu');
    
    mainMenuButton.addEventListener('click', () => {
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            // Anima los botones del menú
            Array.from(menu.children).forEach((button, index) => {
                button.style.transform = 'scale(0)';
                button.style.opacity = '0';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                    button.style.opacity = '1';
                }, index * 50);
            });
        }
    });
    
    // Cerrar el menú si se hace clic fuera de él
    document.addEventListener('click', (event) => {
        if (!floatingMenu.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        setupTooltips();
        setupDeselect();

        // Otras funciones que se ejecutan al cargar el DOM
    });

loadNotes().then(() => {
    cleanCategories();
    renderNotes();
});