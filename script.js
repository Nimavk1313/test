document.addEventListener('DOMContentLoaded', () => {
    console.log('CanvasFlow Editor Initialized');

    const canvasIframe = document.getElementById('canvas');
    const layerList = document.getElementById('layer-list');

    // --- Toolbar Elements ---
    const richTextToolbar = document.getElementById('rich-text-toolbar');

    // --- Style Panel Elements ---
    const stylePanel = document.getElementById('style-panel');
    const noElementSelected = document.getElementById('no-element-selected');
    // Typography Section
    const typographyStyleSection = document.getElementById('typography-style-section');
    const fontSizeInput = document.getElementById('font-size-input');
    const colorInput = document.getElementById('color-input');
    // Button Section
    const buttonStyleSection = document.getElementById('button-style-section');
    const backgroundColorInput = document.getElementById('background-color-input');
    const buttonColorInput = document.getElementById('button-color-input');
    const paddingInput = document.getElementById('padding-input');
    const borderRadiusInput = document.getElementById('border-radius-input');
    // Image Section
    const imageStyleSection = document.getElementById('image-style-section');
    const imageSrcInput = document.getElementById('image-src-input');
    const imageAltInput = document.getElementById('image-alt-input');
    // Spacing Section
    const spacingStyleSection = document.getElementById('spacing-style-section');
    const marginTopInput = document.getElementById('margin-top-input');
    const marginRightInput = document.getElementById('margin-right-input');
    const marginBottomInput = document.getElementById('margin-bottom-input');
    const marginLeftInput = document.getElementById('margin-left-input');
    const paddingTopInput = document.getElementById('padding-top-input');
    const paddingRightInput = document.getElementById('padding-right-input');
    const paddingBottomInput = document.getElementById('padding-bottom-input');
    const paddingLeftInput = document.getElementById('padding-left-input');


    // --- Responsive View ---
    const desktopView = document.getElementById('desktop-view');
    const tabletView = document.getElementById('tablet-view');
    const mobileView = document.getElementById('mobile-view');
    const responsiveButtons = [desktopView, tabletView, mobileView];

    desktopView.addEventListener('click', () => setView('desktop'));
    tabletView.addEventListener('click', () => setView('tablet'));
    mobileView.addEventListener('click', () => setView('mobile'));

    function setView(view) {
        responsiveButtons.forEach(button => button.classList.remove('active'));
        let width = '100%';
        if (view === 'desktop') desktopView.classList.add('active');
        else if (view === 'tablet') { tabletView.classList.add('active'); width = '768px'; }
        else { mobileView.classList.add('active'); width = '375px'; }
        canvasIframe.style.width = width;
    }
    setView('desktop');

    canvasIframe.addEventListener('load', () => {
        const canvasDoc = canvasIframe.contentDocument;
        const canvasWin = canvasIframe.contentWindow;
        const canvasBody = canvasDoc.body;
        let selectedElement = null;

        // --- History Management (Command Pattern) ---
        const undoStack = [];
        const redoStack = [];

        function executeCommand(command) {
            command.execute();
            undoStack.push(command);
            redoStack.length = 0;
            updateLayersPanel();
            updateStylePanel(selectedElement);
        }

        function undo() {
            if (undoStack.length > 0) {
                const command = undoStack.pop();
                command.undo();
                redoStack.push(command);
                updateLayersPanel();
                updateStylePanel(selectedElement);
            }
        }

        function redo() {
            if (redoStack.length > 0) {
                const command = redoStack.pop();
                command.execute();
                undoStack.push(command);
                updateLayersPanel();
                updateStylePanel(selectedElement);
            }
        }

        const createCommand = (config) => ({ ...config });

        // --- Event Listeners ---
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
                const command = createCommand({
                    element: selectedElement, parent: selectedElement.parentNode, nextSibling: selectedElement.nextSibling,
                    execute: function() { this.parent.removeChild(this.element); },
                    undo: function() { this.parent.insertBefore(this.element, this.nextSibling); }
                });
                executeCommand(command);
                selectElement(null);
            }
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') { e.preventDefault(); undo(); }
                if (e.key === 'y') { e.preventDefault(); redo(); }
            }
        });

        // --- Drag and Drop Logic ---
        const elementsPanel = document.querySelector('#add-elements-panel');
        let draggedElement = null;
        const dropIndicator = canvasDoc.createElement('div');
        dropIndicator.className = 'drop-indicator';

        elementsPanel.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('element')) {
                e.dataTransfer.setData('application/json', JSON.stringify({ source: 'panel', type: e.target.dataset.type }));
            }
        });

        canvasBody.addEventListener('dragstart', (e) => {
            const target = e.target.closest('[data-cf-element]');
            if (target) {
                e.stopPropagation();
                draggedElement = target;
                e.dataTransfer.setData('application/json', JSON.stringify({ source: 'canvas', id: target.dataset.cfId }));
                setTimeout(() => { target.style.opacity = '0.5'; }, 0);
            }
        });

        canvasBody.addEventListener('dragend', () => {
            if (draggedElement) draggedElement.style.opacity = '1';
            draggedElement = null;
            if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
        });

        canvasBody.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dropTarget = e.target.closest('[data-cf-droptarget="true"]') || canvasBody;
            const elementTarget = e.target.closest('[data-cf-element]');

            if (dropTarget) {
                 if (elementTarget && elementTarget.parentNode === dropTarget) {
                    const rect = elementTarget.getBoundingClientRect();
                    const isNearTop = e.clientY < rect.top + rect.height / 2;
                     if (elementTarget !== draggedElement) {
                        elementTarget.parentNode.insertBefore(dropIndicator, isNearTop ? elementTarget : elementTarget.nextSibling);
                    }
                 } else {
                    // It's an empty drop target, or we are not over a specific element
                    dropTarget.appendChild(dropIndicator);
                 }
            }
        });

        canvasBody.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!dropIndicator.parentNode) return;
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            let command;
            if (data.source === 'panel') {
                const newElement = createElement(data.type);
                if (!newElement) return;
                command = createCommand({
                    element: newElement, parent: dropIndicator.parentNode, nextSibling: dropIndicator,
                    execute: function() { this.parent.insertBefore(this.element, this.nextSibling); },
                    undo: function() { this.parent.removeChild(this.element); }
                });
            } else if (data.source === 'canvas' && draggedElement) {
                command = createCommand({
                    element: draggedElement,
                    oldParent: draggedElement.parentNode, oldNextSibling: draggedElement.nextSibling,
                    newParent: dropIndicator.parentNode, newNextSibling: dropIndicator,
                    execute: function() { this.newParent.insertBefore(this.element, this.newNextSibling); },
                    undo: function() { this.oldParent.insertBefore(this.element, this.oldNextSibling); }
                });
            }
            if(command) executeCommand(command);
            dropIndicator.parentNode.removeChild(dropIndicator);
        });

        // --- Core Functions ---
        function createElement(type) {
            let element;
            switch (type) {
                case 'section': element = canvasDoc.createElement('section'); element.dataset.cfDroptarget = "true"; break;
                case 'container': element = canvasDoc.createElement('div'); element.className = 'container'; element.dataset.cfDroptarget = "true"; break;
                case 'heading': element = canvasDoc.createElement('h1'); element.textContent = 'Dynamic Heading'; break;
                case 'button': element = canvasDoc.createElement('button'); element.textContent = 'Click Me'; break;
                case 'image':
                    element = canvasDoc.createElement('img');
                    element.src = 'https://via.placeholder.com/400x200';
                    element.alt = 'Placeholder Image';
                    break;
                case 'richtext':
                    element = canvasDoc.createElement('div');
                    element.contentEditable = true;
                    element.innerHTML = `<p>This is a rich text block. You can edit this text directly.</p>`;
                    break;
                case 'columns':
                    const layout = prompt("Enter column layout (e.g., '2', '3', '50/50', '70/30'):", "2");
                    if (!layout) return null;
                    element = canvasDoc.createElement('div');
                    element.className = 'columns-wrapper';
                    const parts = layout.split('/');
                    if (parts.length === 2) {
                        const col1 = canvasDoc.createElement('div');
                        col1.className = 'column';
                        col1.style.flex = parts[0];
                        col1.dataset.cfElement = 'column';
                        col1.dataset.cfDroptarget = "true";
                        const col2 = canvasDoc.createElement('div');
                        col2.className = 'column';
                        col2.style.flex = parts[1];
                        col2.dataset.cfElement = 'column';
                        col2.dataset.cfDroptarget = "true";
                        element.appendChild(col1);
                        element.appendChild(col2);
                    } else {
                        const count = parseInt(layout, 10) || 2;
                        for(let i=0; i<count; i++) {
                            const col = canvasDoc.createElement('div');
                            col.className = 'column';
                            col.dataset.cfElement = 'column';
                            col.dataset.cfDroptarget = "true";
                            element.appendChild(col);
                        }
                    }
                    break;
                default: return null;
            }
            element.dataset.cfElement = type;
            element.dataset.cfId = `cf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            element.draggable = true;
            return element;
        }

        function selectElement(element) {
            if (selectedElement) selectedElement.classList.remove('selected');
            const oldSelectedLayer = layerList.querySelector('.selected');
            if(oldSelectedLayer) oldSelectedLayer.classList.remove('selected');

            richTextToolbar.style.display = 'none'; // Hide toolbar by default

            if (element) {
                selectedElement = element;
                selectedElement.classList.add('selected');
                const layerItem = [...layerList.children].find(li => li.dataset.cfId === selectedElement.dataset.cfId);
                if (layerItem) layerItem.classList.add('selected');

                if (element.dataset.cfElement === 'richtext') {
                    showRichTextToolbar(element);
                }
            } else {
                selectedElement = null;
            }
            updateStylePanel(selectedElement);
        }

        function updateStylePanel(element) {
            stylePanel.querySelectorAll('.style-section').forEach(s => s.style.display = 'none');
            if (element) {
                noElementSelected.style.display = 'none';
                const elementType = element.dataset.cfElement;
                const computedStyle = canvasWin.getComputedStyle(element);

                spacingStyleSection.style.display = 'block';
                marginTopInput.value = computedStyle.marginTop;
                marginRightInput.value = computedStyle.marginRight;
                marginBottomInput.value = computedStyle.marginBottom;
                marginLeftInput.value = computedStyle.marginLeft;
                paddingTopInput.value = computedStyle.paddingTop;
                paddingRightInput.value = computedStyle.paddingRight;
                paddingBottomInput.value = computedStyle.paddingBottom;
                paddingLeftInput.value = computedStyle.paddingLeft;

                if (elementType === 'heading') {
                    typographyStyleSection.style.display = 'block';
                    fontSizeInput.value = computedStyle.fontSize;
                    colorInput.value = rgbToHex(computedStyle.color);
                } else if (elementType === 'button') {
                    buttonStyleSection.style.display = 'block';
                    backgroundColorInput.value = rgbToHex(computedStyle.backgroundColor);
                    buttonColorInput.value = rgbToHex(computedStyle.color);
                    paddingInput.value = computedStyle.padding;
                    borderRadiusInput.value = computedStyle.borderRadius;
                } else if (elementType === 'image') {
                    imageStyleSection.style.display = 'block';
                    imageSrcInput.value = element.src;
                    imageAltInput.value = element.alt;
                }
            } else {
                noElementSelected.style.display = 'block';
            }
        }

        // --- Style Input Listeners ---
        const styleInputs = [
            { input: fontSizeInput, property: 'fontSize' }, { input: colorInput, property: 'color' },
            { input: backgroundColorInput, property: 'backgroundColor' }, { input: buttonColorInput, property: 'color' },
            { input: paddingInput, property: 'padding' }, { input: borderRadiusInput, property: 'borderRadius' },
            { input: marginTopInput, property: 'marginTop' }, { input: marginRightInput, property: 'marginRight' },
            { input: marginBottomInput, property: 'marginBottom' }, { input: marginLeftInput, property: 'marginLeft' },
            { input: paddingTopInput, property: 'paddingTop' }, { input: paddingRightInput, property: 'paddingRight' },
            { input: paddingBottomInput, property: 'paddingBottom' }, { input: paddingLeftInput, property: 'paddingLeft' },
        ];
        styleInputs.forEach(({input, property}) => {
            input.addEventListener('input', (e) => {
                if (!selectedElement) return;
                const value = e.target.value;
                const oldValue = selectedElement.style[property];
                const command = createCommand({
                    element: selectedElement, property, oldValue, value,
                    execute: function() { this.element.style[this.property] = this.value; },
                    undo: function() { this.element.style[this.property] = this.oldValue; }
                });
                executeCommand(command);
            });
        });
        const attributeInputs = [ { input: imageSrcInput, attribute: 'src' }, { input: imageAltInput, attribute: 'alt' } ];
        attributeInputs.forEach(({input, attribute}) => {
             input.addEventListener('input', (e) => {
                if (!selectedElement) return;
                const value = e.target.value;
                const oldValue = selectedElement.getAttribute(attribute);
                const command = createCommand({
                    element: selectedElement, attribute, oldValue, value,
                    execute: function() { this.element.setAttribute(this.attribute, this.value); },
                    undo: function() { this.element.setAttribute(this.attribute, this.oldValue); }
                });
                executeCommand(command);
            });
        });

        // --- Toolbar Logic ---
        function showRichTextToolbar(element) {
            const rect = element.getBoundingClientRect();
            const editorRect = canvasIframe.getBoundingClientRect();
            richTextToolbar.style.display = 'block';
            richTextToolbar.style.top = `${editorRect.top + rect.top - richTextToolbar.offsetHeight - 5}px`;
            richTextToolbar.style.left = `${editorRect.left + rect.left}px`;
        }
        richTextToolbar.addEventListener('mousedown', (e) => {
             e.preventDefault(); // Prevent loss of selection in the contenteditable
             const command = e.target.closest('button')?.dataset.command;
             if (command) {
                canvasDoc.execCommand(command, false, null);
             }
        });


        canvasBody.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            selectElement(e.target.closest('[data-cf-element]'));
        });

        function updateLayersPanel() {
            layerList.innerHTML = '';
            canvasBody.querySelectorAll('[data-cf-element]').forEach(el => {
                const li = document.createElement('li');
                const type = el.dataset.cfElement;
                li.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                li.dataset.cfId = el.dataset.cfId;
                if (el === selectedElement) li.classList.add('selected');

                const childrenContainer = document.createElement('ul');
                el.childNodes.forEach(child => {
                    if(child.nodeType === 1 && child.dataset && child.dataset.cfElement) {
                        const childLi = document.createElement('li');
                        const childType = child.dataset.cfElement;
                        childLi.textContent = childType.charAt(0).toUpperCase() + childType.slice(1);
                        childLi.dataset.cfId = child.dataset.cfId;
                        if (child === selectedElement) childLi.classList.add('selected');
                        childrenContainer.appendChild(childLi);
                    }
                });
                if (childrenContainer.hasChildNodes()) {
                    li.appendChild(childrenContainer);
                }
                layerList.appendChild(li);
            });
        }

        layerList.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetLi = e.target.closest('li');
            if (targetLi) {
                const el = canvasDoc.querySelector(`[data-cf-id="${targetLi.dataset.cfId}"]`);
                if (el) { selectElement(el); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            }
        });

        // --- Utils ---
        function rgbToHex(rgb) {
            if (!rgb) return '#000000';
            let match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!match) return rgb;
            function hex(x) { return ("0" + parseInt(x).toString(16)).slice(-2); }
            return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
        }

        // --- Initial Styles Injection ---
        const style = canvasDoc.createElement('style');
        style.innerHTML = `
            body { font-family: sans-serif; line-height: 1.5; margin: 0; }
            .selected { outline: 2px solid #1890ff !important; outline-offset: 2px; }
            [data-cf-element] { min-height: 20px; padding: 10px; }
            section[data-cf-element] { padding: 40px 20px; border: 1px dashed #ccc; }
            div.container[data-cf-element] { max-width: 1140px; margin: 0 auto; padding: 20px; border: 1px dashed #bbb; }
            h1[data-cf-element] { font-size: 2.5rem; }
            button[data-cf-element] {
                background-color: #1890ff; color: white; border: none; padding: 12px 24px;
                font-size: 1rem; border-radius: 5px; cursor: pointer;
            }
            img[data-cf-element] { max-width: 100%; height: auto; }
            div[data-cf-element="richtext"] { border: 1px dashed #ddd; }
            [contenteditable]:focus { outline: none; }
            .columns-wrapper { display: flex; gap: 20px; border: 1px dashed #999; padding: 10px; }
            .column { flex: 1; min-height: 50px; border: 1px dashed #ccc; padding: 10px; }
            [data-cf-element]:empty::before { content: attr(data-cf-element); color: #999; font-style: italic; }
        `;
        canvasDoc.head.appendChild(style);

        updateStylePanel(null); // Initial state
    });
});
